import { AppError } from '../utils/app-error.js';

const unavailableDatabaseCodes = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  '57P01',
  '57P02',
  '57P03'
]);

function isPrimaryDatabaseUnavailable(error) {
  return unavailableDatabaseCodes.has(error?.code) ||
    (typeof error?.code === 'string' && error.code.startsWith('08'));
}

export function notFoundHandler(_req, res) {
  res.status(404).json({ erro: 'Rota nao encontrada' });
}

export function errorHandler(error, _req, res, _next) {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({ erro: error.message });
  }
  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON invalido' });
  }
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ erro: 'Corpo da requisicao muito grande' });
  }
  if (isPrimaryDatabaseUnavailable(error)) {
    return res.status(503).json({ erro: 'Banco principal indisponivel' });
  }
  console.error(error);
  return res.status(500).json({ erro: 'Erro interno do servidor' });
}
