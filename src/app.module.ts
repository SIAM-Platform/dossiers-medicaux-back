/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/modules/users.module';
import { MarinsModule } from './marins/modules/marins.module';
import { VisitesModule } from './visites/modules/visites.module';
import { ReferentielsModule } from './referentiels/modules/referentiels.module';
import { InfirmiersModule } from './infirmiers/modules/infirmiers.module';
import { MedecinsModule } from './medecins/modules/medecins.module';
import { DashboardModule } from './dashboard/dashboard.module';

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
        synchronize: config.get('database.synchronize'),
        logging: config.get('nodeEnv') === 'development',
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
  ],
})
export class AppModule {}