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
import { KeycloakAuthGuard } from './auth/guards/keycloak-auth.guard';
import { privacyModule } from './privacy/privacy.module';
import { AuditModule } from './audit/audit.module';
import { MarinProtectionService } from './marins/marin-protection.service';
import { PRIVACY_INVENTORY_DATA } from './privacy/inventory';

@Module({
  imports: [
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
    // RGPD : registre des traitements, durées de conservation, demandes des personnes, export.
    privacyModule({
      inventory: PRIVACY_INVENTORY_DATA,
      authGuards: [KeycloakAuthGuard],
      access: {
        read: ['PRIVACY_OFFICER', 'admin'],
        manage: ['PRIVACY_OFFICER', 'admin'],
        export: ['PRIVACY_OFFICER', 'admin'],
      },
    }),
  ],
  providers: [MarinProtectionService],
})
export class AppModule {}
