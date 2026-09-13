import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBookId, validateBookPayload } from '../src/utils/validation.js';

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

test('aceita apenas ID inteiro positivo', () => {
  assert.equal(parseBookId('42'), 42);
  assert.throws(() => parseBookId('0'), /inteiro positivo/);
  assert.throws(() => parseBookId('1.5'), /inteiro positivo/);
  assert.throws(() => parseBookId('abc'), /inteiro positivo/);
});
