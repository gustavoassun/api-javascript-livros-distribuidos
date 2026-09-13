import { postgresPool, mysqlPool } from './connections.js';

const postgresSchema = `
  CREATE TABLE IF NOT EXISTS livros (
    id_livro INTEGER PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    isbn VARCHAR(20) NOT NULL UNIQUE,
    autor VARCHAR(150) NOT NULL,
    editora VARCHAR(100) NOT NULL,
    data_cadastro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS fila_replicacao (
    id SERIAL PRIMARY KEY,
    operacao VARCHAR(10) NOT NULL,
    id_livro INTEGER NOT NULL,
    payload JSON NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pendente',
    tentativas INTEGER NOT NULL DEFAULT 0,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processado_em TIMESTAMP,
    ultimo_erro TEXT
  );

  CREATE INDEX IF NOT EXISTS ix_fila_replicacao_status_criado_em_id
    ON fila_replicacao (status, criado_em, id);
`;

const replicationQueueMigration = `
  ALTER TABLE livros ALTER COLUMN id_livro DROP DEFAULT;

  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = 'fila_replicacao'
         AND column_name = 'dados'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = 'fila_replicacao'
         AND column_name = 'payload'
    ) THEN
      ALTER TABLE fila_replicacao RENAME COLUMN dados TO payload;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = 'fila_replicacao'
         AND column_name = 'dados'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = 'fila_replicacao'
         AND column_name = 'payload'
    ) THEN
      UPDATE fila_replicacao
         SET payload = COALESCE(payload::json, dados::json);
      ALTER TABLE fila_replicacao DROP COLUMN dados;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = 'fila_replicacao'
         AND column_name = 'payload'
    ) THEN
      ALTER TABLE fila_replicacao ADD COLUMN payload JSON;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = 'fila_replicacao'
         AND column_name = 'processado_em'
    ) THEN
      ALTER TABLE fila_replicacao ADD COLUMN processado_em TIMESTAMP;
    END IF;
  END $$;

  UPDATE fila_replicacao
     SET payload = json_build_object('id_livro', id_livro)
   WHERE payload IS NULL;

  UPDATE fila_replicacao
     SET status = 'pendente', processado_em = NULL
   WHERE status NOT IN ('pendente', 'processado');

  ALTER TABLE fila_replicacao
    ALTER COLUMN payload TYPE JSON USING payload::json,
    ALTER COLUMN payload SET NOT NULL,
    ALTER COLUMN status TYPE VARCHAR(20);

  ALTER TABLE fila_replicacao DROP COLUMN IF EXISTS atualizado_em;
  DROP INDEX IF EXISTS idx_fila_replicacao_status_id;

  CREATE INDEX IF NOT EXISTS ix_fila_replicacao_status_criado_em_id
    ON fila_replicacao (status, criado_em, id);
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
  await postgresPool.query(replicationQueueMigration);

  try {
    await mysqlPool.query(mysqlSchema);
  } catch (error) {
    console.warn('[replicacao] MySQL indisponivel na inicializacao:', error.message);
  }
}
