import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permissions fines (modèle du socle SIAM) : attribution des permissions aux rôles, modifiable par
 * l'administration. `role_permission_seed` note les rôles ayant reçu l'attribution par défaut
 * (appliquée au démarrage, une seule fois par rôle).
 */
export class RolePermissions1794688034500 implements MigrationInterface {
  name = 'RolePermissions1794688034500';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE "role_permission" ("role_id" integer NOT NULL, "permission" character varying(64) NOT NULL, CONSTRAINT "PK_role_permission" PRIMARY KEY ("role_id", "permission"), CONSTRAINT "FK_role_permission_role" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE)`,
    );
    await q.query(
      `CREATE TABLE "role_permission_seed" ("role_name" character varying(255) PRIMARY KEY, "applied_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now())`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "role_permission_seed"`);
    await q.query(`DROP TABLE "role_permission"`);
  }
}
