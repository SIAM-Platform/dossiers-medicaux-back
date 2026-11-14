import { join } from 'path';
import { DataSourceOptions } from 'typeorm';

type Env = Record<string, string | undefined>;

/**
 * Options TypeORM communes à l'application et à la CLI de migration (même règle que le socle SIAM) :
 * PostgreSQL, `synchronize` toujours désactivé, toute évolution de schéma passe par une migration
 * versionnée, appliquée au démarrage (`RUN_MIGRATIONS_ON_START=false` pour la lancer à part).
 * Les noms de tables et de colonnes sont ceux de la version MySQL (aucun changement d'API).
 */
export function databaseOptions(env: Env): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT || 5432),
    username: env.DB_USERNAME || 'postgres',
    password: env.DB_PASSWORD,
    database: env.DB_NAME || 'siam_dmgm',
    ssl:
      env.DB_SSL === 'true'
        ? { rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
        : false,
    entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    migrations: [join(__dirname, '..', 'migrations', '*.{ts,js}')],
    migrationsTableName: 'schema_migrations',
    synchronize: false,
    migrationsRun: env.RUN_MIGRATIONS_ON_START !== 'false',
    logging: env.DB_LOGGING === 'true',
    extra: { max: Number(env.DB_POOL_MAX || 20) },
  };
}
