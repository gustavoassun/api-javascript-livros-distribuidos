import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const schema = readFileSync(new URL('../docker/postgres/init.sql', import.meta.url), 'utf8');
const repository = readFileSync(
  new URL('../src/db/replication-repository.js', import.meta.url),
  'utf8'
);

test('fila de replicacao segue o contrato compartilhado com o Python', () => {
  assert.match(schema, /payload JSON NOT NULL/);
  assert.match(schema, /status VARCHAR\(20\) NOT NULL DEFAULT 'pendente'/);
  assert.match(schema, /processado_em TIMESTAMP/);
  assert.match(schema, /status, criado_em, id/);
  assert.doesNotMatch(schema, /\bdados\b/);
  assert.doesNotMatch(schema, /atualizado_em/);
});

test('worker utiliza apenas os estados pendente e processado', () => {
  assert.match(repository, /WHERE status = 'pendente'/);
  assert.match(repository, /status = 'processado'/);
  assert.match(repository, /event\.payload/);
  assert.doesNotMatch(repository, /processando/);
});
