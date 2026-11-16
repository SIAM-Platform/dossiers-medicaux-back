import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

const store = new AsyncLocalStorage<{ id: string }>();
const VALID = /^[A-Za-z0-9._:-]{8,100}$/;

export const currentRequestId = (): string | undefined => store.getStore()?.id;

/** Identifiant de requête : repris de X-Request-Id s'il est sûr, sinon créé ; renvoyé au client. */
export function requestIdMiddleware(req: { headers: Record<string, unknown> }, res: { setHeader(k: string, v: string): void }, next: () => void): void {
  const given = req.headers['x-request-id'];
  const id = typeof given === 'string' && VALID.test(given) ? given : randomUUID();
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-Id', id);
  store.run({ id }, next);
}
