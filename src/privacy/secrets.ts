import { readFileSync } from 'fs';
import { Logger } from '@nestjs/common';

type Env = Record<string, string | undefined>;

/**
 * Lecture des secrets **avant** le démarrage du service, sans jamais les écrire dans la configuration
 * en clair. Trois sources, dans cet ordre :
 *
 * 1. `NOM_FILE` : fichier monté par l'orchestrateur (secret Docker ou Kubernetes, agent Vault) ;
 *    Seuls les noms de secrets sont concernés (voir `isSecretName`).
 *    Exemple : `FIELD_MASTER_KEY_FILE=/run/secrets/field_master_key`.
 * 2. **Coffre HashiCorp Vault** (moteur KV v2), si `VAULT_ADDR` et `VAULT_SECRET_PATH` sont fournis :
 *    toutes les clés du secret deviennent des variables du service (ex. `FIELD_MASTER_KEY`,
 *    `DB_PASSWORD`, `KEYCLOAK_CLIENT_SECRET`). Authentification par jeton (`VAULT_TOKEN` ou
 *    `VAULT_TOKEN_FILE`) ou par compte de service Kubernetes (`VAULT_K8S_ROLE`).
 * 3. Variable d'environnement classique (développement, ou plateforme qui injecte déjà ses secrets).
 *
 * Une variable déjà définie n'est jamais écrasée, sauf `VAULT_OVERRIDE=true`. Si un coffre est
 * configuré mais injoignable, le service **refuse de démarrer** : mieux vaut un arrêt net qu'un
 * démarrage avec des secrets par défaut.
 */
/**
 * Variables traitées comme des secrets lisibles depuis un fichier : nom terminé par KEY, SECRET,
 * PASSWORD, PASS, TOKEN ou CREDENTIALS, ou cité dans `SECRET_FILE_VARS` (liste séparée par des
 * virgules). Les autres variables `_FILE` de la machine (outils, configuration) sont ignorées.
 */
function isSecretName(name: string, env: Env): boolean {
  const extra = (env.SECRET_FILE_VARS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    extra.includes(name) ||
    /(KEY|SECRET|PASSWORD|PASS|TOKEN|CREDENTIALS)$/.test(name)
  );
}

export async function loadSecrets(
  env: Env = process.env,
  logger = new Logger('Secrets'),
): Promise<{ files: string[]; vault: string[] }> {
  const files: string[] = [];
  for (const [key, path] of Object.entries(env)) {
    if (
      !/^[A-Z][A-Z0-9_]*_FILE$/.test(key) ||
      !path ||
      key === 'VAULT_TOKEN_FILE'
    )
      continue;
    if (!isSecretName(key.slice(0, -'_FILE'.length), env)) continue;
    const name = key.slice(0, -'_FILE'.length);
    if (env[name]) continue;
    try {
      env[name] = readFileSync(path, 'utf8').trim();
      files.push(name);
    } catch (e) {
      throw new Error(
        `Secret ${name} : fichier ${path} illisible (${(e as Error).message})`,
      );
    }
  }

  const vault: string[] = [];
  if (env.VAULT_ADDR && env.VAULT_SECRET_PATH) {
    const data = await readVault(env);
    const override = env.VAULT_OVERRIDE === 'true';
    for (const [k, v] of Object.entries(data)) {
      if (typeof v !== 'string' || !/^[A-Z][A-Z0-9_]*$/.test(k)) continue;
      if (env[k] && !override) continue;
      env[k] = v;
      vault.push(k);
    }
  }
  if (files.length || vault.length) {
    // Noms seulement, jamais les valeurs.
    logger.log(
      `Secrets chargés${files.length ? ` depuis des fichiers : ${files.join(', ')}` : ''}${vault.length ? `${files.length ? ' ;' : ''} depuis le coffre : ${vault.join(', ')}` : ''}`,
    );
  }
  return { files, vault };
}

async function readVault(env: Env): Promise<Record<string, unknown>> {
  const addr = env.VAULT_ADDR!.replace(/\/$/, '');
  const mount = env.VAULT_KV_MOUNT ?? 'secret';
  const timeout = Number(env.VAULT_TIMEOUT_MS ?? 5000);
  const headers: Record<string, string> = {};
  if (env.VAULT_NAMESPACE) headers['X-Vault-Namespace'] = env.VAULT_NAMESPACE;

  let token =
    env.VAULT_TOKEN ??
    (env.VAULT_TOKEN_FILE
      ? readFileSync(env.VAULT_TOKEN_FILE, 'utf8').trim()
      : undefined);
  if (!token && env.VAULT_K8S_ROLE) {
    const jwt = readFileSync(
      env.VAULT_K8S_TOKEN_PATH ??
        '/var/run/secrets/kubernetes.io/serviceaccount/token',
      'utf8',
    ).trim();
    const res = await call(
      `${addr}/v1/auth/${env.VAULT_K8S_MOUNT ?? 'kubernetes'}/login`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: env.VAULT_K8S_ROLE, jwt }),
      },
      timeout,
    );
    token = (res as { auth?: { client_token?: string } }).auth?.client_token;
  }
  if (!token)
    throw new Error(
      'Coffre Vault configuré sans moyen de s’authentifier (VAULT_TOKEN, VAULT_TOKEN_FILE ou VAULT_K8S_ROLE)',
    );

  const path = env.VAULT_SECRET_PATH!.replace(/^\//, '');
  const res = await call(
    `${addr}/v1/${mount}/data/${path}`,
    { headers: { ...headers, 'X-Vault-Token': token } },
    timeout,
  );
  const data = (res as { data?: { data?: Record<string, unknown> } }).data
    ?.data;
  if (!data)
    throw new Error(
      `Coffre Vault : secret ${mount}/${path} vide ou introuvable`,
    );
  return data;
}

async function call(
  url: string,
  init: RequestInit,
  timeout: number,
): Promise<unknown> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    throw new Error(
      `Coffre Vault injoignable ou refus (${new URL(url).pathname}) : ${(e as Error).message}`,
    );
  } finally {
    clearTimeout(t);
  }
}
