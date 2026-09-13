# API JavaScript do Sistema Distribuído de Livros

Backend do Grupo JavaScript desenvolvido em Node.js e Express. O serviço implementa o CRUD padronizado de livros, usa PostgreSQL como banco principal e replica cada escrita no MySQL.

O objetivo é permitir que a API Java Orquestradora alterne entre os backends JavaScript e Python sem perda de dados para o usuário.

## Funcionalidades

- CRUD completo de livros;
- contrato HTTP padronizado em JSON;
- PostgreSQL como banco principal;
- replicação de `POST`, `PUT` e `DELETE` no MySQL;
- fila persistente para operações que não puderam ser replicadas;
- reprocessamento cronológico e sequencial das pendências;
- transações no PostgreSQL;
- proteção de atualização concorrente com bloqueio de registro;
- health-check compatível com a eleição de líder;
- tratamento padronizado de erros;
- Docker Compose para execução isolada;
- configuração para integração com o ambiente conjunto.

## Arquitetura da escrita

1. A API recebe uma operação de escrita.
2. Abre uma transação no PostgreSQL.
3. Grava o livro e registra a operação na fila persistente.
4. Confirma a transação no banco principal.
5. Tenta aplicar a mesma operação no MySQL com o mesmo `id_livro`.
6. Se o MySQL estiver indisponível, mantém a pendência para uma nova tentativa.

Não é utilizada transação distribuída entre os bancos. A consistência é eventual e controlada pela fila de replicação.

### Contrato compartilhado da fila

A tabela `fila_replicacao` segue o mesmo contrato do backend Python: `payload`, `status`, `tentativas`, `criado_em`, `processado_em` e `ultimo_erro`. Os únicos estados utilizados são `pendente` e `processado`. Isso permite que os dois backends utilizem os mesmos bancos sem divergência de schema.

## Início rápido

Requisito: Docker Desktop aberto e com o mecanismo em execução.

No Windows, extraia o projeto e execute:

```text
INICIAR_E_TESTAR.bat
```

Ou utilize o terminal:

```bash
docker compose up --build -d
docker compose ps
```

A API ficará disponível em `http://localhost:3001`.

Para encerrar sem apagar os dados:

```bash
docker compose down
```

## Serviços no modo local

| Componente | Endereço externo | Endereço entre containers |
| --- | --- | --- |
| API JavaScript | `localhost:3001` | `api-javascript:3000` |
| PostgreSQL | `localhost:5433` | `postgres:5432` |
| MySQL | `localhost:3307` | `mysql:3306` |

As portas externas podem ser alteradas por variáveis de ambiente. Os nomes internos são os nomes dos serviços do Docker Compose.

## Contrato HTTP

| Método | Rota | Resposta de sucesso |
| --- | --- | --- |
| `POST` | `/livros` | `201` e o livro criado |
| `GET` | `/livros` | `200` e uma lista JSON |
| `GET` | `/livros/:id_livro` | `200` ou `404` |
| `PUT` | `/livros/:id_livro` | `200` e o livro atualizado |
| `DELETE` | `/livros/:id_livro` | `204` sem corpo |
| `GET` | `/health` | `200` ou `503` |

Payload de cadastro e atualização:

```json
{
  "titulo": "Dom Casmurro",
  "isbn": "9780000000000",
  "autor": "Machado de Assis",
  "editora": "Editora X"
}
```

Os campos retornados são `id_livro`, `titulo`, `isbn`, `autor`, `editora`, `data_cadastro` e `data_atualizacao`.

A especificação completa está em [`openapi.yaml`](openapi.yaml).

## Health-check

```bash
curl http://localhost:3001/health
```

Estados possíveis:

- `ok`: PostgreSQL e MySQL conectados e nenhuma pendência;
- `degradado`: PostgreSQL conectado, mas o MySQL está indisponível ou possui pendências;
- `indisponivel`: PostgreSQL inacessível; a resposta utiliza HTTP `503`.

Exemplo:

```json
{
  "status": "ok",
  "servico": "api-javascript",
  "banco_principal": { "nome": "postgres", "conectado": true },
  "banco_replica": { "nome": "mysql", "conectado": true },
  "timestamp": "2026-09-13T12:00:00.000Z"
}
```

Todas as respostas incluem o header `X-Backend-Service: api-javascript`.

## Testes

Testes do código:

```bash
npm ci
npm test
```

Teste do CRUD com a API em execução:

```bash
npm run test:integration
```

No VS Code, o arquivo `requests.http` pode ser usado com a extensão REST Client.

Para testar a recuperação quando o MySQL cai, execute `TESTAR_RECUPERACAO_MYSQL.bat` com o ambiente local iniciado.

## Integração com a API Java e bancos compartilhados

As instruções destinadas ao responsável pela integração estão em [`INTEGRACAO_FABIO.md`](INTEGRACAO_FABIO.md).

Existem dois modos:

- `docker-compose.yml`: sobe a API, PostgreSQL e MySQL para teste isolado;
- `docker-compose.backend.yml`: sobe somente a API e a conecta aos bancos do ambiente conjunto.

O frontend deve acessar exclusivamente a API Java Orquestradora. A API Java chama este serviço por `http://api-javascript:3000` e não recebe credenciais dos bancos.

## Estrutura principal

```text
src/
  db/            conexões, schema, CRUD e fila de replicação
  middleware/    tratamento de erros HTTP
  routes/        endpoints de livros
  services/      regras do CRUD, health-check e replicação
  utils/         validação e erros da aplicação
docker/          scripts de inicialização dos bancos locais
scripts/         testes e automação para Windows
test/            testes automatizados
```

## Variáveis de ambiente

| Variável | Finalidade |
| --- | --- |
| `PORT` | Porta interna da API |
| `POSTGRES_HOST` | Host do PostgreSQL principal |
| `POSTGRES_PORT` | Porta do PostgreSQL |
| `POSTGRES_DB` | Nome do banco PostgreSQL |
| `POSTGRES_USER` | Usuário do PostgreSQL |
| `POSTGRES_PASSWORD` | Senha do PostgreSQL |
| `MYSQL_HOST` | Host do MySQL réplica |
| `MYSQL_PORT` | Porta do MySQL |
| `MYSQL_DATABASE` | Nome do banco MySQL |
| `MYSQL_USER` | Usuário do MySQL |
| `MYSQL_PASSWORD` | Senha do MySQL |
| `DB_CONNECT_TIMEOUT_MS` | Tempo limite para conexão com banco |
| `HEALTH_TIMEOUT_MS` | Tempo máximo de cada verificação do health-check |
| `REPLICATION_INTERVAL_MS` | Intervalo do reprocessamento da fila |

Nunca versionar arquivos `.env` contendo senhas reais.
