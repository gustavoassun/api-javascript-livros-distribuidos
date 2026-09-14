import { postgresPool } from './connections.js';
import { AppError } from '../utils/app-error.js';

const bookColumns = `
  id_livro, titulo, isbn, autor, editora, data_cadastro, data_atualizacao
`;

async function enqueue(client, operation, bookId, data) {
  await client.query(
    `INSERT INTO fila_replicacao (operacao, id_livro, payload)
     VALUES ($1, $2, $3::json)`,
    [operation, bookId, JSON.stringify(data)]
  );
}

async function ensureUniqueBook(client, data, excludedId = null) {
  const result = await client.query(
    `SELECT
       LOWER(BTRIM(titulo)) = LOWER(BTRIM($1)) AS titulo_duplicado,
       isbn = $2 AS isbn_duplicado
       FROM livros
      WHERE (LOWER(BTRIM(titulo)) = LOWER(BTRIM($1)) OR isbn = $2)
        AND ($3::integer IS NULL OR id_livro <> $3)
      LIMIT 1`,
    [data.titulo, data.isbn, excludedId]
  );

  const duplicate = result.rows[0];
  if (duplicate?.titulo_duplicado) {
    throw new AppError(409, 'Ja existe um livro cadastrado com esse titulo');
  }
  if (duplicate?.isbn_duplicado) {
    throw new AppError(409, 'Ja existe um livro cadastrado com esse ISBN');
  }
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
    // O PostgreSQL compartilhado nao gera IDs porque e a replica do backend Python.
    // O bloqueio serializa a escolha do proximo ID durante a escrita do JavaScript.
    await client.query('LOCK TABLE livros IN SHARE ROW EXCLUSIVE MODE');
    await ensureUniqueBook(client, data);

    const idResult = await client.query(
      'SELECT COALESCE(MAX(id_livro), 0) + 1 AS proximo_id FROM livros'
    );
    const nextId = Number(idResult.rows[0].proximo_id);

    const result = await client.query(
      `INSERT INTO livros (id_livro, titulo, isbn, autor, editora)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${bookColumns}`,
      [nextId, data.titulo, data.isbn, data.autor, data.editora]
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
      `SELECT ${bookColumns} FROM livros WHERE id_livro = $1 FOR UPDATE`,
      [id]
    );
    if (locked.rowCount === 0) {
      throw new AppError(404, 'Livro nao encontrado');
    }

    const currentBook = locked.rows[0];
    const updatedData = {
      titulo: data.titulo ?? currentBook.titulo,
      isbn: data.isbn ?? currentBook.isbn,
      autor: data.autor ?? currentBook.autor,
      editora: data.editora ?? currentBook.editora
    };

    await ensureUniqueBook(client, updatedData, id);

    const result = await client.query(
      `UPDATE livros
          SET titulo = $1, isbn = $2, autor = $3, editora = $4,
              data_atualizacao = CURRENT_TIMESTAMP
        WHERE id_livro = $5
        RETURNING ${bookColumns}`,
      [updatedData.titulo, updatedData.isbn, updatedData.autor, updatedData.editora, id]
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
    await enqueue(client, 'DELETE', id, result.rows[0]);
    return result.rows[0];
  });
}

export async function countPendingReplication() {
  const result = await postgresPool.query(
    `SELECT COUNT(*)::int AS total
       FROM fila_replicacao
      WHERE status = 'pendente'`
  );
  return result.rows[0].total;
}
