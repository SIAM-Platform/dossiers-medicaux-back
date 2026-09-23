/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { AuthController } from './auth.controller';
import { KeycloakStrategy } from './strategies/keycloak.strategy';
import { KeycloakAuthGuard } from './guards/keycloak-auth.guard';
import { UsersModule } from '../users/modules/users.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'keycloak' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        secret: config.get('keycloak.secret'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
    UsersModule,
    HttpModule, // ← important pour le controller
  ],
  providers: [KeycloakStrategy, KeycloakAuthGuard],
  controllers: [AuthController],
  exports: [KeycloakAuthGuard],
})
export class AuthModule {}