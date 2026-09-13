import { Router } from 'express';
import * as bookService from '../services/book-service.js';
import { parseBookId, validateBookPayload } from '../utils/validation.js';
import { AppError } from '../utils/app-error.js';

export const booksRouter = Router();

booksRouter.post('/', async (req, res) => {
  const data = validateBookPayload(req.body);
  const book = await bookService.createBook(data);
  res.status(201).json(book);
});

booksRouter.get('/', async (_req, res) => {
  res.status(200).json(await bookService.listBooks());
});

booksRouter.get('/:id_livro', async (req, res) => {
  const id = parseBookId(req.params.id_livro);
  const book = await bookService.findBookById(id);
  if (!book) throw new AppError(404, 'Livro nao encontrado');
  res.status(200).json(book);
});

booksRouter.put('/:id_livro', async (req, res) => {
  const id = parseBookId(req.params.id_livro);
  const data = validateBookPayload(req.body);
  res.status(200).json(await bookService.updateBook(id, data));
});

booksRouter.delete('/:id_livro', async (req, res) => {
  const id = parseBookId(req.params.id_livro);
  await bookService.deleteBook(id);
  res.status(204).send();
});
