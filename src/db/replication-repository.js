import { postgresPool, mysqlPool } from './connections.js';

export async function getNextPendingEvent() {
  const result = await postgresPool.query(`
    SELECT id, operacao, id_livro, payload, tentativas
      FROM fila_replicacao
     WHERE status = 'pendente'
     ORDER BY criado_em, id
     LIMIT 1
  `);
  return result.rows[0] ?? null;
}

export async function markEventDone(id) {
  await postgresPool.query(
    `UPDATE fila_replicacao
        SET status = 'processado',
            processado_em = CURRENT_TIMESTAMP,
            ultimo_erro = NULL
      WHERE id = $1`,
    [id]
  );
}

export async function markEventPending(id, error) {
  await postgresPool.query(
    `UPDATE fila_replicacao
        SET status = 'pendente',
            tentativas = tentativas + 1,
            ultimo_erro = $2
      WHERE id = $1`,
    [id, String(error.message ?? error).slice(0, 2000)]
  );
}

function mysqlDate(value) {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 23).replace('T', ' ');
}

export async function applyEventToMysql(event) {
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    if (event.operacao === 'DELETE') {
      await connection.execute('DELETE FROM livros WHERE id_livro = ?', [event.id_livro]);
    } else {
      const book = event.payload;
      await connection.execute(
        `INSERT INTO livros
          (id_livro, titulo, isbn, autor, editora, data_cadastro, data_atualizacao)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           titulo = VALUES(titulo),
           isbn = VALUES(isbn),
           autor = VALUES(autor),
           editora = VALUES(editora),
           data_cadastro = VALUES(data_cadastro),
           data_atualizacao = VALUES(data_atualizacao)`,
        [
          book.id_livro,
          book.titulo,
          book.isbn,
          book.autor,
          book.editora,
          mysqlDate(book.data_cadastro),
          mysqlDate(book.data_atualizacao)
        ]
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
