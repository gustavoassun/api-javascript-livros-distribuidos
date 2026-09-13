import { postgresPool } from './connections.js';
import { AppError } from '../utils/app-error.js';

const bookColumns = `
  id_livro, titulo, isbn, autor, editora, data_cadastro, data_atualizacao
`;

async function enqueue(client, operation, bookId, data) {
  await client.query(
    `INSERT INTO fila_replicacao (operacao, id_livro, dados)
     VALUES ($1, $2, $3::jsonb)`,
    [operation, bookId, data ? JSON.stringify(data) : null]
  );
}

async function inTransaction(callback) {
  const client = await postgresPool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505' && error.constraint === 'livros_isbn_key') {
      throw new AppError(409, 'Ja existe um livro cadastrado com esse ISBN');
    }
    if (error.code === '23505') {
      throw new AppError(409, 'Conflito de identificador ou dado duplicado');
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function createBook(data) {
  return inTransaction(async (client) => {
    // Mantem a sequence correta caso a API Python tenha inserido IDs explicitos.
    await client.query('LOCK TABLE livros IN SHARE ROW EXCLUSIVE MODE');
    await client.query(`
      SELECT setval(
        pg_get_serial_sequence('livros', 'id_livro'),
        COALESCE(MAX(id_livro), 1),
        MAX(id_livro) IS NOT NULL
      ) FROM livros
    `);

    const result = await client.query(
      `INSERT INTO livros (titulo, isbn, autor, editora)
       VALUES ($1, $2, $3, $4)
       RETURNING ${bookColumns}`,
      [data.titulo, data.isbn, data.autor, data.editora]
    );
    const book = result.rows[0];
    await enqueue(client, 'CREATE', book.id_livro, book);
    return book;
  });
}

export async function listBooks() {
  const result = await postgresPool.query(
    `SELECT ${bookColumns} FROM livros ORDER BY id_livro`
  );
  return result.rows;
}

export async function findBookById(id) {
  const result = await postgresPool.query(
    `SELECT ${bookColumns} FROM livros WHERE id_livro = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function updateBook(id, data) {
  return inTransaction(async (client) => {
    const locked = await client.query(
      'SELECT id_livro FROM livros WHERE id_livro = $1 FOR UPDATE',
      [id]
    );
    if (locked.rowCount === 0) {
      throw new AppError(404, 'Livro nao encontrado');
    }

    const result = await client.query(
      `UPDATE livros
          SET titulo = $1, isbn = $2, autor = $3, editora = $4,
              data_atualizacao = CURRENT_TIMESTAMP
        WHERE id_livro = $5
        RETURNING ${bookColumns}`,
      [data.titulo, data.isbn, data.autor, data.editora, id]
    );
    const book = result.rows[0];
    await enqueue(client, 'UPDATE', id, book);
    return book;
  });
}

export async function deleteBook(id) {
  return inTransaction(async (client) => {
    const result = await client.query(
      `DELETE FROM livros WHERE id_livro = $1 RETURNING ${bookColumns}`,
      [id]
    );
    if (result.rowCount === 0) {
      throw new AppError(404, 'Livro nao encontrado');
    }
    await enqueue(client, 'DELETE', id, null);
    return result.rows[0];
  });
}

export async function countPendingReplication() {
  const result = await postgresPool.query(
    `SELECT COUNT(*)::int AS total
       FROM fila_replicacao
      WHERE status IN ('pendente', 'processando')`
  );
  return result.rows[0].total;
}
