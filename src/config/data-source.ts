import 'dotenv/config';
import { DataSource } from 'typeorm';
import { databaseOptions } from './database.config';

/** DataSource de la CLI TypeORM (migration:generate / run / revert). */
export default new DataSource({
  ...databaseOptions(process.env),
  migrationsRun: false,
});
