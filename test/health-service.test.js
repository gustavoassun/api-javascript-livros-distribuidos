import test from 'node:test';
import assert from 'node:assert/strict';
import { getHealth } from '../src/services/health-service.js';

const connected = async () => {};
const disconnected = async () => {
  const error = new Error('Banco indisponivel');
  error.code = 'ECONNREFUSED';
  throw error;
};

test('health retorna ok quando os dois bancos estao conectados e sem pendencias', async () => {
  const health = await getHealth({
    pingPostgres: connected,
    pingMysql: connected,
    countPendingReplication: async () => 0,
    timeoutMs: 100
  });

  assert.equal(health.httpStatus, 200);
  assert.equal(health.body.status, 'ok');
  assert.equal(health.body.banco_principal.conectado, true);
  assert.equal(health.body.banco_replica.conectado, true);
});

test('health retorna degradado quando o MySQL esta indisponivel', async () => {
  const health = await getHealth({
    pingPostgres: connected,
    pingMysql: disconnected,
    countPendingReplication: async () => 1,
    timeoutMs: 100
  });

  assert.equal(health.httpStatus, 200);
  assert.equal(health.body.status, 'degradado');
  assert.equal(health.body.banco_principal.conectado, true);
  assert.equal(health.body.banco_replica.conectado, false);
});

test('health retorna indisponivel e HTTP 503 quando o PostgreSQL cai', async () => {
  const health = await getHealth({
    pingPostgres: disconnected,
    pingMysql: connected,
    countPendingReplication: async () => 0,
    timeoutMs: 100
  });

  assert.equal(health.httpStatus, 503);
  assert.equal(health.body.status, 'indisponivel');
  assert.equal(health.body.banco_principal.conectado, false);
});
