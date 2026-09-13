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
