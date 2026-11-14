/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { prepareEncryptedColumns } from './privacy/schema-prep';
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
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get('database.host'),
        port: config.get('database.port'),
        username: config.get('database.username'),
        password: config.get('database.password'),
        database: config.get('database.database'),
        autoLoadEntities: true,
        // La synchronisation est lancée par dataSourceFactory, après la préparation des colonnes chiffrées.
        synchronize: false,
        logging: config.get('nodeEnv') === 'development',
      }),
      dataSourceFactory: async (options) => {
        const ds = await new DataSource(options!).initialize();
        // Colonnes chiffrées converties en TEXT en conservant les données, AVANT la synchronisation
        // (qui supprimerait et recréerait une colonne dont le type change).
        await prepareEncryptedColumns(ds);
        if (process.env.DB_SYNC === 'true') await ds.synchronize();
        return ds;
      },
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
      access: { read: ['PRIVACY_OFFICER', 'admin'], manage: ['PRIVACY_OFFICER', 'admin'], export: ['PRIVACY_OFFICER', 'admin'] },
    }),
  ],
  providers: [MarinProtectionService],
})
export class AppModule {}