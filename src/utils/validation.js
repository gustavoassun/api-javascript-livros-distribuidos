import { AppError } from './app-error.js';

const limits = {
  titulo: 200,
  isbn: 20,
  autor: 150,
  editora: 100
};

function validatePayloadObject(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new AppError(400, 'O corpo da requisicao deve ser um objeto JSON');
  }
}

function normalizeField(field, value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AppError(400, `O campo ${field} e obrigatorio`);
  }

  const normalized = value.trim();
  if (normalized.length > limits[field]) {
    throw new AppError(400, `O campo ${field} deve ter no maximo ${limits[field]} caracteres`);
  }

  return normalized;
}

export function validateBookPayload(payload) {
  validatePayloadObject(payload);

  const book = {};
  for (const field of Object.keys(limits)) {
    book[field] = normalizeField(field, payload[field]);
  }

  return book;
}

export function validateBookUpdatePayload(payload) {
  validatePayloadObject(payload);

  const fields = Object.keys(payload);
  if (fields.length === 0) {
    throw new AppError(400, 'Informe pelo menos um campo para atualizar');
  }

  const invalidField = fields.find((field) => !Object.hasOwn(limits, field));
  if (invalidField) {
    throw new AppError(400, `O campo ${invalidField} nao pode ser atualizado`);
  }

  return Object.fromEntries(
    fields.map((field) => [field, normalizeField(field, payload[field])])
  );
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
