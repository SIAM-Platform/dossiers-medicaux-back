/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  
  // Augmenter la limite de taille des requêtes
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));

  const configService = app.get(ConfigService);

  // Validation globale
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: false,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  // CORS
  const corsOrigins = configService.get<string>('cors.origins') || ['http://localhost:4200'];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Préfixe global
  app.setGlobalPrefix('api');

  // Fichiers statiques (uploads)
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // Documentation Swagger
  const config = new DocumentBuilder()
    .setTitle('DMGM API')
    .setDescription('API pour la gestion des dossiers médicaux des marins')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('port') || 3008;
  const nodeEnv = configService.get<string>('nodeEnv') || 'development';

  await app.listen(port);

  console.log(`🚀 Application démarrée (env: ${nodeEnv})`);
  console.log(`📡 Écoute sur http://localhost:${port}`);
  console.log(`📚 Swagger : http://localhost:${port}/api/docs`);
  console.log(`🔐 Keycloak realm : ${configService.get('keycloak.realm')}`);
  console.log(`🔐 Keycloak URL   : ${configService.get('keycloak.authServerUrl')}`);
  console.log(`✅ CORS origins   : ${JSON.stringify(corsOrigins)}`);
}
bootstrap();