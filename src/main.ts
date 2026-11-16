// Traces OpenTelemetry : à charger avant tout autre module (inactif sans collecteur configuré).
import './observability/tracing';
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { json, urlencoded } from 'express';
import { loadSecrets } from './privacy/secrets';
import { applyHttpSecurity, swaggerEnabled } from './security/http-security';
import { applyObservability } from './observability/observability';
import { transferOnStart } from './scripts/mysql-to-postgres';

async function bootstrap() {
  // Secrets lus depuis le coffre (Vault), des fichiers montés (NOM_FILE) ou l'environnement, avant tout le reste.
  await loadSecrets(process.env);
  // Passage de MySQL à PostgreSQL au premier démarrage (une seule fois ; docs/postgresql.md).
  if (process.env.MYSQL_TRANSFER_ON_START === 'true') {
    await transferOnStart(process.env);
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Identifiant de requête, journaux JSON, métriques /metrics, sondes /health/live et /health/ready (src/observability).
  applyObservability(app);

  
  // En-têtes de sécurité, IP réelle derrière le proxy, origines CORS explicites (src/security).
  const corsOrigins = applyHttpSecurity(app);

  // Taille des requêtes : les scans arrivent encodés en base64 (BODY_LIMIT, 50mb par défaut).
  const bodyLimit = process.env.BODY_LIMIT || '50mb';
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ limit: bodyLimit, extended: true }));

  const configService = app.get(ConfigService);

  // Validation globale
  app.useGlobalPipes(
    new ValidationPipe({
      // Champs non déclarés retirés avant le code métier : aucun champ imprévu ne peut être écrit
      // (affectation de masse). Pas de refus, les écrans envoient parfois l'objet complet.
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  // Préfixe global
  app.setGlobalPrefix('api');

  // Les fichiers ne sont plus publiés en accès libre (/uploads) : ils passent par la bibliothèque de
  // stockage (contrôle des droits, lien court, accès tracé). Reprise : npm run storage:files import-legacy.

  // Documentation Swagger
  const config = new DocumentBuilder()
    .setTitle('DMGM API')
    .setDescription('API pour la gestion des dossiers médicaux des marins')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  // Documentation fermée en production sauf SWAGGER_ENABLED=true.
  if (swaggerEnabled()) SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  const port = configService.get<number>('port') || 3008;
  const nodeEnv = configService.get<string>('nodeEnv') || 'development';

  await app.listen(port);

  console.log(`🚀 Application démarrée (env: ${nodeEnv})`);
  console.log(`📡 Écoute sur http://localhost:${port}`);
  console.log(`📚 Swagger : http://localhost:${port}/api/docs`);
  console.log(`🔐 Keycloak realm : ${configService.get('keycloak.realm')}`);
  console.log(`🔐 Keycloak URL   : ${configService.get('keycloak.authServerUrl')}`);
  console.log(`✅ CORS origins   : ${corsOrigins.map(String).join(', ')}`);
}
bootstrap();