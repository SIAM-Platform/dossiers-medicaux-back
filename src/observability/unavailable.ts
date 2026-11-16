/**
 * Panne d'une dépendance (base injoignable, connexion coupée, délai dépassé) : l'API répond 503
 * « réessayez » plutôt que 500 « erreur interne », pour que le client et le répartiteur de charge
 * sachent que la requête peut être rejouée.
 */
const NET_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE']);
// Classes PostgreSQL 08 (connexion) et 57P0x (arrêt du serveur, base en démarrage).
const PG_CODES = /^(08\d{3}|57P0[1-4])$/;
const MESSAGES = /Connection terminated|connection error|timeout exceeded when trying to connect|Connection refused|the database system is (starting up|shutting down)|Client has encountered a connection error/i;

export function isUnavailable(err: unknown, depth = 0): boolean {
  if (!err || typeof err !== 'object' || depth > 3) return false;
  const e = err as { code?: unknown; message?: unknown; driverError?: unknown; cause?: unknown; errors?: unknown };
  if (typeof e.code === 'string' && (NET_CODES.has(e.code) || PG_CODES.test(e.code))) return true;
  if (typeof e.message === 'string' && MESSAGES.test(e.message)) return true;
  if (Array.isArray(e.errors) && e.errors.some((x) => isUnavailable(x, depth + 1))) return true;
  return isUnavailable(e.driverError, depth + 1) || isUnavailable(e.cause, depth + 1);
}

/** Délai conseillé au client avant de réessayer (secondes). */
export const RETRY_AFTER_SECONDS = 5;
