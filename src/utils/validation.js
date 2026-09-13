import { AppError } from './app-error.js';

const limits = {
  titulo: 200,
  isbn: 20,
  autor: 150,
  editora: 100
};

export function validateBookPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new AppError(400, 'O corpo da requisicao deve ser um objeto JSON');
  }

  const book = {};
  for (const [field, maxLength] of Object.entries(limits)) {
    const value = payload[field];
    if (typeof value !== 'string' || value.trim() === '') {
      throw new AppError(400, `O campo ${field} e obrigatorio`);
    }
    const normalized = value.trim();
    if (normalized.length > maxLength) {
      throw new AppError(400, `O campo ${field} deve ter no maximo ${maxLength} caracteres`);
    }
    book[field] = normalized;
  }

  return book;
}

export function parseBookId(value) {
  if (!/^\d+$/.test(String(value))) {
    throw new AppError(400, 'id_livro deve ser um numero inteiro positivo');
  }
  const id = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new AppError(400, 'id_livro deve ser um numero inteiro positivo');
  }
  return id;
}
