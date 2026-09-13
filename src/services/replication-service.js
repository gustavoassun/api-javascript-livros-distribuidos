import {
  getNextPendingEvent,
  applyEventToMysql,
  markEventDone,
  markEventPending
} from '../db/replication-repository.js';

let processing = false;
let timer = null;

export async function processPendingReplication() {
  if (processing) return;
  processing = true;
  try {
    while (true) {
      const event = await getNextPendingEvent();
      if (!event) break;
      try {
        await applyEventToMysql(event);
        await markEventDone(event.id);
        console.info(`[replicacao] ${event.operacao} livro=${event.id_livro} concluida`);
      } catch (error) {
        await markEventPending(event.id, error);
        console.warn(`[replicacao] MySQL indisponivel; evento ${event.id} mantido na fila`);
        break;
      }
    }
  } finally {
    processing = false;
  }
}

export function startReplicationWorker(intervalMs) {
  void processPendingReplication().catch((error) => {
    console.error('[replicacao] Falha no worker:', error.message);
  });
  timer = setInterval(() => {
    void processPendingReplication().catch((error) => {
      console.error('[replicacao] Falha no worker:', error.message);
    });
  }, intervalMs);
  timer.unref();
}

export function stopReplicationWorker() {
  if (timer) clearInterval(timer);
}
