import { Module } from '@nestjs/common';
import { SiamIntegrationController } from './siam-integration.controller';
import { SiamIntegrationGuard } from './siam-integration.guard';
import { SiamIntegrationService } from './siam-integration.service';

/** Passerelle en lecture seule vers l'ecosysteme SIAM Gens de mer (statut minimal d'aptitude). */
@Module({
  controllers: [SiamIntegrationController],
  providers: [SiamIntegrationService, SiamIntegrationGuard],
})
export class SiamIntegrationModule {}
