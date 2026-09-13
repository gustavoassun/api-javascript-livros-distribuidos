const baseUrl = process.env.API_URL ?? 'http://localhost:3001';

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...options.headers
    }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { status: response.status, body, headers: response.headers };
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const suffix = Date.now();

  const health = await request('/health');
  expect(health.status === 200, `Health retornou ${health.status}`);
  expect(['ok', 'degradado'].includes(health.body.status), 'Health retornou status invalido');
  expect(
    health.headers.get('x-backend-service') === 'api-javascript',
    'Header X-Backend-Service ausente'
  );

  const created = await request('/livros', {
    method: 'POST',
    body: JSON.stringify({
      titulo: 'Livro de teste',
      isbn: `TESTE-${suffix}`.slice(0, 20),
      autor: 'Equipe JavaScript',
      editora: 'UNDB'
    })
  });
  expect(created.status === 201, `POST retornou ${created.status}`);
  const id = created.body.id_livro;

  const found = await request(`/livros/${id}`);
  expect(found.status === 200 && found.body.id_livro === id, 'GET por ID falhou');

  const listed = await request('/livros');
  expect(listed.status === 200 && Array.isArray(listed.body), 'Listagem falhou');
  expect(listed.body.some((book) => book.id_livro === id), 'Livro nao apareceu na listagem');

  const updated = await request(`/livros/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      titulo: 'Livro de teste atualizado',
      isbn: created.body.isbn,
      autor: 'Equipe JavaScript',
      editora: 'UNDB'
    })
  });
  expect(
    updated.status === 200 && updated.body.titulo === 'Livro de teste atualizado',
    `PUT retornou ${updated.status} sem confirmar a alteracao`
  );

  const deleted = await request(`/livros/${id}`, { method: 'DELETE' });
  expect(deleted.status === 204, `DELETE retornou ${deleted.status}`);

  const missing = await request(`/livros/${id}`);
  expect(missing.status === 404, 'Livro excluido ainda foi encontrado');

  console.info('Teste de integracao concluido: CREATE, READ, UPDATE e DELETE funcionando.');
}

run().catch((error) => {
  console.error('Teste de integracao falhou:', error.message);
  process.exit(1);
});
