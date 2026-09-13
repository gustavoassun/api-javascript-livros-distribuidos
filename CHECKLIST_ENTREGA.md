# Checklist de Entrega da API JavaScript

## Aplicação

- [x] API independente em Node.js e Express
- [x] `POST /livros`
- [x] `GET /livros`
- [x] `GET /livros/{id_livro}`
- [x] `PUT /livros/{id_livro}`
- [x] `DELETE /livros/{id_livro}`
- [x] `GET /health`
- [x] Payload e respostas em JSON
- [x] Erros no formato `{ "erro": "mensagem" }`
- [x] Header `X-Backend-Service: api-javascript`

## Dados e tolerância a falhas

- [x] PostgreSQL como banco principal
- [x] MySQL como banco réplica
- [x] Mesmo `id_livro` enviado aos dois bancos
- [x] Transação no banco principal
- [x] Bloqueio do registro em atualização concorrente
- [x] Fila persistente no PostgreSQL
- [x] Schema da fila padronizado com o backend Python
- [x] Estados da fila limitados a `pendente` e `processado`
- [x] Campo `payload` obrigatório, inclusive para exclusões
- [x] Reprocessamento sequencial e cronológico
- [x] Operações de criação, atualização e exclusão replicadas
- [x] Estado `degradado` enquanto houver pendências
- [x] Estado `indisponivel` e HTTP 503 quando o PostgreSQL cair

## Integração

- [x] Dockerfile da API
- [x] Docker Compose local com os dois bancos
- [x] Docker Compose somente do backend para o ambiente conjunto
- [x] Variáveis de ambiente documentadas
- [x] Contrato OpenAPI
- [x] Guia destinado ao integrador
- [x] Teste automático do CRUD
- [x] Teste automático de recuperação da réplica

## Validações realizadas

- [x] Testes automatizados do código
- [x] Sintaxe de todos os arquivos JavaScript
- [x] Estrutura dos arquivos Docker Compose
- [x] Estrutura do contrato OpenAPI
- [x] Auditoria das dependências sem vulnerabilidades conhecidas

## Aceitação no ambiente conjunto

Estes passos devem ser executados pelo responsável pela integração porque dependem dos demais repositórios e das credenciais definitivas:

- [ ] Preencher as credenciais reais do PostgreSQL e MySQL
- [ ] Conectar a API à rede Docker compartilhada
- [ ] Confirmar `GET http://api-javascript:3000/health`
- [ ] Encaminhar o CRUD pela API Java
- [x] Comparar contratos HTTP e schema da fila com a API Python
- [ ] Comparar as respostas em execução da API JavaScript e da API Python
- [ ] Derrubar o backend líder e confirmar o failover
- [ ] Consultar os dois bancos após o teste final
