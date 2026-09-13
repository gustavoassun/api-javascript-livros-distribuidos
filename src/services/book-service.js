import * as books from '../db/book-repository.js';
import { processPendingReplication } from './replication-service.js';

async function replicateAfterCommit(result) {
  await processPendingReplication();
  return result;
}

export async function createBook(data) {
  return replicateAfterCommit(await books.createBook(data));
}

export const listBooks = books.listBooks;
export const findBookById = books.findBookById;

export async function updateBook(id, data) {
  return replicateAfterCommit(await books.updateBook(id, data));
}

export async function deleteBook(id) {
  return replicateAfterCommit(await books.deleteBook(id));
}
