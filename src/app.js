import express from 'express';
import { booksRouter } from './routes/books.js';
import { getHealth } from './services/health-service.js';
import { notFoundHandler, errorHandler } from './middleware/error-handler.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use((_req, res, next) => {
    res.setHeader('X-Backend-Service', 'api-javascript');
    next();
  });

  app.get('/', (_req, res) => {
    res.status(200).json({
      servico: 'api-javascript',
      status: 'online',
      documentacao: 'Consulte README.md e openapi.yaml no repositorio',
      health: '/health',
      recurso: '/livros'
    });
  });

  app.get('/health', async (_req, res) => {
    const health = await getHealth();
    res.status(health.httpStatus).json(health.body);
  });
  app.use('/livros', booksRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
