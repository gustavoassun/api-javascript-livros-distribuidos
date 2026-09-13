import { pingPostgres, pingMysql } from '../db/connections.js';
import { countPendingReplication } from '../db/book-repository.js';
import { config } from '../config.js';

function timeoutAfter(milliseconds) {
  return new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new Error('Tempo limite excedido')), milliseconds);
    timer.unref();
  });
}

async function isReachable(ping, timeoutMs) {
  try {
    await Promise.race([ping(), timeoutAfter(timeoutMs)]);
    return true;
  } catch {
    return false;
  }
}

export async function getHealth(dependencies = {}) {
  const postgresPing = dependencies.pingPostgres ?? pingPostgres;
  const mysqlPing = dependencies.pingMysql ?? pingMysql;
  const pendingCounter = dependencies.countPendingReplication ?? countPendingReplication;
  const timeoutMs = dependencies.timeoutMs ?? config.healthTimeoutMs;

  const [postgresConnected, mysqlConnected] = await Promise.all([
    isReachable(postgresPing, timeoutMs),
    isReachable(mysqlPing, timeoutMs)
  ]);

  let pending = null;
  if (postgresConnected) {
    try {
      pending = await Promise.race([
        pendingCounter(),
        timeoutAfter(timeoutMs)
      ]);
    } catch {
      pending = null;
    }
  }

  const status = !postgresConnected
    ? 'indisponivel'
    : (!mysqlConnected || pending === null || pending > 0 ? 'degradado' : 'ok');

  return {
    httpStatus: status === 'indisponivel' ? 503 : 200,
    body: {
      status,
      servico: 'api-javascript',
      banco_principal: { nome: 'postgres', conectado: postgresConnected },
      banco_replica: { nome: 'mysql', conectado: mysqlConnected },
      timestamp: new Date().toISOString()
    }
  };
}
