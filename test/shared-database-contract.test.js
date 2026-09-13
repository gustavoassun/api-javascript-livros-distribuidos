import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const repository = readFileSync(
  new URL('../src/db/book-repository.js', import.meta.url),
  'utf8'
);
const schema = readFileSync(new URL('../docker/postgres/init.sql', import.meta.url), 'utf8');

test('cadastro envia id_livro explicitamente ao PostgreSQL compartilhado', () => {
  assert.match(repository, /COALESCE\(MAX\(id_livro\), 0\) \+ 1 AS proximo_id/);
  assert.match(repository, /INSERT INTO livros \(id_livro, titulo, isbn, autor, editora\)/);
  assert.doesNotMatch(repository, /pg_get_serial_sequence/);
  assert.match(schema, /id_livro INTEGER PRIMARY KEY/);
  assert.doesNotMatch(schema, /id_livro SERIAL/);
});

test('cadastro e atualizacao validam titulo e ISBN duplicados', () => {
  assert.match(repository, /LOWER\(BTRIM\(titulo\)\) = LOWER\(BTRIM\(\$1\)\)/);
  assert.match(repository, /Ja existe um livro cadastrado com esse titulo/);
  assert.match(repository, /Ja existe um livro cadastrado com esse ISBN/);
});
