import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseOptions } from './config/database.config';
import configuration from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/modules/users.module';
import { MarinsModule } from './marins/modules/marins.module';
import { VisitesModule } from './visites/modules/visites.module';
import { ReferentielsModule } from './referentiels/modules/referentiels.module';
import { InfirmiersModule } from './infirmiers/modules/infirmiers.module';
import { MedecinsModule } from './medecins/modules/medecins.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SiamIntegrationModule } from './integrations/siam/siam-integration.module';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ProblemDetailsFilter } from './common/problem-details.filter';
import { HealthController } from './health/health.controller';
import { KeycloakAuthGuard } from './auth/guards/keycloak-auth.guard';
import { AccessModule } from './access/access.module';
import { PermissionGuard } from './access/permission.guard';
import { privacyModule } from './privacy/privacy.module';
import { StorageModule } from './storage/storage.module';
import { AuditModule } from './audit/audit.module';
import { MarinProtectionService } from './marins/marin-protection.service';
import { PRIVACY_INVENTORY_DATA } from './privacy/inventory';

@Module({
  imports: [
    // Limitation de débit par adresse IP (RATE_LIMIT_PER_MINUTE, 300 par défaut).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: Number(process.env.RATE_LIMIT_PER_MINUTE ?? '300') }]),
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      // PostgreSQL, migrations versionnées (src/migrations), jamais de synchronisation automatique.
      useFactory: () => ({
        ...databaseOptions(process.env),
        autoLoadEntities: true,
      }),
    }),
    AccessModule,
    AuthModule,
    UsersModule,
    MarinsModule,
    VisitesModule,
    ReferentielsModule,
    InfirmiersModule,
    MedecinsModule,
    DashboardModule,
    SiamIntegrationModule,
    // Journal d'audit du dossier médical (consultations et modifications, chaîné, en ajout seul).
    AuditModule,
    // Fichiers : bibliothèque de stockage SIAM (contrôles, antivirus, chiffrement, liens courts).
    StorageModule,
    // RGPD : registre des traitements, durées de conservation, demandes des personnes, export.
    privacyModule({
      inventory: PRIVACY_INVENTORY_DATA,
      // Authentification et permissions : gardes globaux ci-dessous ; accès par permissions RGPD.
      authGuards: [],
      access: {
        read: ['privacy.read'],
        manage: ['privacy.manage'],
        export: ['privacy.export'],
      },
    }),
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    MarinProtectionService,
    // Ordre : authentification Keycloak, puis permissions fines (route sans permission = refus).
    { provide: APP_GUARD, useClass: KeycloakAuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    // Erreurs au format problem+json (socle), sans erreur 500 sur une contrainte de base.
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
  controllers: [HealthController],
})
export class AppModule {}
