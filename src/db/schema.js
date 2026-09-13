import { postgresPool, mysqlPool } from './connections.js';

const postgresSchema = `
  CREATE TABLE IF NOT EXISTS livros (
    id_livro SERIAL PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    isbn VARCHAR(20) NOT NULL UNIQUE,
    autor VARCHAR(150) NOT NULL,
    editora VARCHAR(100) NOT NULL,
    data_cadastro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS fila_replicacao (
    id BIGSERIAL PRIMARY KEY,
    operacao VARCHAR(10) NOT NULL CHECK (operacao IN ('CREATE', 'UPDATE', 'DELETE')),
    id_livro INTEGER NOT NULL,
    dados JSONB,
    status VARCHAR(15) NOT NULL DEFAULT 'pendente',
    tentativas INTEGER NOT NULL DEFAULT 0,
    ultimo_erro TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_fila_replicacao_status_id
    ON fila_replicacao (status, id);
`;

const mysqlSchema = `
  CREATE TABLE IF NOT EXISTS livros (
    id_livro INT NOT NULL AUTO_INCREMENT,
    titulo VARCHAR(200) NOT NULL,
    isbn VARCHAR(20) NOT NULL UNIQUE,
    autor VARCHAR(150) NOT NULL,
    editora VARCHAR(100) NOT NULL,
    data_cadastro DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    data_atualizacao DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id_livro)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

export async function initializeDatabases() {
  await postgresPool.query(postgresSchema);
  await postgresPool.query(`
    UPDATE fila_replicacao
       SET status = 'pendente', atualizado_em = CURRENT_TIMESTAMP
     WHERE status = 'processando'
  `);

  try {
    await mysqlPool.query(mysqlSchema);
  } catch (error) {
    console.warn('[replicacao] MySQL indisponivel na inicializacao:', error.message);
  }
}
