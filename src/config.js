import 'dotenv/config';

function integerFromEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? String(fallback), 10);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Variavel ${name} deve ser um inteiro positivo`);
  }
  return value;
}

export const config = Object.freeze({
  env: process.env.NODE_ENV ?? 'development',
  port: integerFromEnv('PORT', 3000),
  dbConnectTimeoutMs: integerFromEnv('DB_CONNECT_TIMEOUT_MS', 3000),
  healthTimeoutMs: integerFromEnv('HEALTH_TIMEOUT_MS', 1000),
  replicationIntervalMs: integerFromEnv('REPLICATION_INTERVAL_MS', 5000),
  postgres: {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: integerFromEnv('POSTGRES_PORT', 5433),
    database: process.env.POSTGRES_DB ?? 'livros_db',
    user: process.env.POSTGRES_USER ?? 'livros',
    password: process.env.POSTGRES_PASSWORD ?? 'livros_dev'
  },
  mysql: {
    host: process.env.MYSQL_HOST ?? 'localhost',
    port: integerFromEnv('MYSQL_PORT', 3307),
    database: process.env.MYSQL_DATABASE ?? 'livros_db',
    user: process.env.MYSQL_USER ?? 'livros',
    password: process.env.MYSQL_PASSWORD ?? 'livros_dev'
  }
});
