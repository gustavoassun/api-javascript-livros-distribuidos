# Integração da API JavaScript

Este arquivo reúne apenas as informações necessárias para conectar a API JavaScript ao ambiente integrado do projeto.

## Identificação do serviço

| Item | Valor |
| --- | --- |
| Serviço Docker sugerido | `api-javascript` |
| Porta interna | `3000` |
| Porta local sugerida | `3001` |
| Health-check interno | `http://api-javascript:3000/health` |
| Recurso principal | `http://api-javascript:3000/livros` |
| Banco principal | PostgreSQL |
| Banco réplica | MySQL |

O header `X-Backend-Service: api-javascript` acompanha todas as respostas e pode ser preservado pela API Java para indicar ao frontend qual backend respondeu.

## Contrato HTTP

| Método | Rota | Sucesso |
| --- | --- | --- |
| `POST` | `/livros` | `201` com o livro criado |
| `GET` | `/livros` | `200` com uma lista JSON |
| `GET` | `/livros/{id_livro}` | `200` ou `404` |
| `PUT` | `/livros/{id_livro}` | `200` com o livro atualizado |
| `DELETE` | `/livros/{id_livro}` | `204` sem corpo |
| `GET` | `/health` | `200` para `ok/degradado`; `503` para `indisponivel` |

O contrato completo está em `openapi.yaml`.

## Variáveis obrigatórias

```env
PORT=3000
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=livros_db
POSTGRES_USER=livros
POSTGRES_PASSWORD=senha_definida_na_integracao
MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_DATABASE=biblioteca_db
MYSQL_USER=livros_user
MYSQL_PASSWORD=senha_definida_na_integracao
DB_CONNECT_TIMEOUT_MS=3000
HEALTH_TIMEOUT_MS=1000
REPLICATION_INTERVAL_MS=5000
```

Os nomes dos hosts devem ser os nomes dos serviços Docker do PostgreSQL e MySQL no Compose geral. Não usar `localhost` entre containers.

## Opção 1 Incluir no Compose geral

A forma recomendada é incluir o serviço abaixo no mesmo `docker-compose.yml` que contém os demais componentes:

```yaml
api-javascript:
  build:
    context: ./api-javascript-livros
  environment:
    NODE_ENV: production
    PORT: 3000
    POSTGRES_HOST: postgres
    POSTGRES_PORT: 5432
    POSTGRES_DB: livros_db
    POSTGRES_USER: livros
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    MYSQL_HOST: mysql
    MYSQL_PORT: 3306
    MYSQL_DATABASE: biblioteca_db
    MYSQL_USER: livros_user
    MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    DB_CONNECT_TIMEOUT_MS: 3000
    HEALTH_TIMEOUT_MS: 1000
    REPLICATION_INTERVAL_MS: 5000
  ports:
    - "3001:3000"
  restart: unless-stopped
```

A API Java deve chamar `http://api-javascript:3000`. A API Java não precisa e não deve receber as credenciais dos bancos.

## Opção 2 Executar em Compose separado

Quando o ambiente integrado utilizar a rede externa `sistemas-distribuidos`:

```bash
docker network create sistemas-distribuidos
cp .env.fabio.example .env.fabio
docker compose --env-file .env.fabio -f docker-compose.backend.yml up --build -d
```

Preencher as senhas e confirmar os nomes dos bancos antes de executar. Se a rede já existir, o primeiro comando informará isso e poderá ser ignorado.

## Formato do payload

```json
{
  "titulo": "Dom Casmurro",
  "isbn": "9780000000000",
  "autor": "Machado de Assis",
  "editora": "Editora X"
}
```

`id_livro`, `data_cadastro` e `data_atualizacao` são gerados pela API e retornados na resposta.

## Comportamento do health-check

- `ok`: PostgreSQL e MySQL conectados e nenhuma replicação pendente.
- `degradado`: PostgreSQL conectado, mas o MySQL está indisponível ou possui pendências. HTTP `200` porque a API ainda pode atender.
- `indisponivel`: PostgreSQL principal inacessível. HTTP `503`; a orquestradora deve retirar esta API da liderança.

## Escrita dupla

1. A escrita é confirmada em uma transação no PostgreSQL.
2. Na mesma transação, a operação é registrada na tabela persistente `fila_replicacao`.
3. Após o commit, a API tenta aplicar a operação no MySQL usando o mesmo `id_livro`.
4. Em caso de falha no MySQL, a resposta principal permanece válida e a pendência fica salva.
5. Um worker interno reprocessa as pendências, uma por vez e em ordem, até a réplica voltar a ficar consistente.

## Testes de aceitação

```bash
curl http://localhost:3001/health
npm run test:integration
```

Para validar a recuperação da réplica no ambiente local:

```bash
docker compose stop mysql
# cadastrar ou atualizar um livro pela API
docker compose start mysql
# aguardar alguns segundos e consultar /health novamente
```

O resultado esperado é `degradado` durante a queda e `ok` depois que todas as pendências forem replicadas.

## Observações para o proxy Java

- Encaminhar o método HTTP, caminho, corpo JSON e `Content-Type` sem alterar os nomes dos campos.
- Preservar os códigos `201`, `200`, `204`, `400`, `404`, `409`, `500` e `503`.
- Considerar a API elegível quando `/health` retornar HTTP `200` com `status` igual a `ok` ou `degradado`.
- Considerar a API indisponível quando `/health` retornar `503`, ocorrer timeout ou a conexão falhar.
- O frontend deve consumir somente a API Java, nunca este serviço diretamente.
