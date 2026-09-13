import { config } from './config.js';
import { createApp } from './app.js';
import { initializeDatabases } from './db/schema.js';
import { closeConnections } from './db/connections.js';
import { startReplicationWorker, stopReplicationWorker } from './services/replication-service.js';

let server;

async function start() {
  await initializeDatabases();
  startReplicationWorker(config.replicationIntervalMs);
  server = createApp().listen(config.port, () => {
    console.info(`API JavaScript ouvindo na porta ${config.port}`);
  });
}

async function shutdown(signal) {
  console.info(`\n${signal} recebido; encerrando API...`);
  stopReplicationWorker();
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await closeConnections();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

start().catch((error) => {
  console.error('Nao foi possivel iniciar a API:', error);
  process.exit(1);
});
