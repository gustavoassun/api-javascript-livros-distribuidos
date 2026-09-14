import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseBookId,
  validateBookPayload,
  validateBookUpdatePayload
} from '../src/utils/validation.js';

test('normaliza um livro valido', () => {
  assert.deepEqual(validateBookPayload({
    titulo: '  Dom Casmurro ',
    isbn: '9780000000000',
    autor: ' Machado de Assis ',
    editora: 'Editora X'
  }), {
    titulo: 'Dom Casmurro',
    isbn: '9780000000000',
    autor: 'Machado de Assis',
    editora: 'Editora X'
  });
});

test('rejeita campo obrigatorio vazio', () => {
  assert.throws(
    () => validateBookPayload({ titulo: '', isbn: '1', autor: 'A', editora: 'E' }),
    /titulo e obrigatorio/
  );
});

test('aceita atualizacao parcial e normaliza somente os campos enviados', () => {
  assert.deepEqual(validateBookUpdatePayload({ titulo: '  Lampiao ' }), {
    titulo: 'Lampiao'
  });
});

test('rejeita atualizacao sem campos', () => {
  assert.throws(
    () => validateBookUpdatePayload({}),
    /pelo menos um campo/
  );
});

test('rejeita campo vazio ou desconhecido na atualizacao', () => {
  assert.throws(
    () => validateBookUpdatePayload({ autor: ' ' }),
    /autor e obrigatorio/
  );
  assert.throws(
    () => validateBookUpdatePayload({ preco: '10' }),
    /preco nao pode ser atualizado/
  );
});

test('aceita apenas ID inteiro positivo', () => {
  assert.equal(parseBookId('42'), 42);
  assert.throws(() => parseBookId('0'), /inteiro positivo/);
  assert.throws(() => parseBookId('1.5'), /inteiro positivo/);
  assert.throws(() => parseBookId('abc'), /inteiro positivo/);
});
