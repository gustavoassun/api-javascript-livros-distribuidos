import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

async function withServer(callback) {
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  try {
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('raiz identifica o servico JavaScript', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(baseUrl);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-backend-service'), 'api-javascript');
    assert.equal(body.servico, 'api-javascript');
  });
});

test('ID invalido retorna erro JSON com HTTP 400 sem consultar o banco', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/livros/abc`);
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.erro, /inteiro positivo/);
  });
});

test('JSON malformado retorna HTTP 400', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/livros`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{'
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.erro, 'JSON invalido');
  });
});

test('rota desconhecida retorna HTTP 404 em JSON', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/rota-inexistente`);
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.erro, 'Rota nao encontrada');
  });
});
