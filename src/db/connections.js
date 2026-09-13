import pg from 'pg';
import mysql from 'mysql2/promise';
import { config } from '../config.js';

const { Pool: PostgresPool } = pg;

export const postgresPool = new PostgresPool({
  ...config.postgres,
  connectionTimeoutMillis: config.dbConnectTimeoutMs,
  max: 10
});

export const mysqlPool = mysql.createPool({
  ...config.mysql,
  connectTimeout: config.dbConnectTimeoutMs,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: 'Z',
  dateStrings: true
});

export async function pingPostgres() {
  await postgresPool.query('SELECT 1');
}

export async function pingMysql() {
  await mysqlPool.query('SELECT 1');
}

export async function closeConnections() {
  await Promise.allSettled([postgresPool.end(), mysqlPool.end()]);
}
