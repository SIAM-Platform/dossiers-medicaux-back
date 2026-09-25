/* eslint-disable prettier/prettier */
import { Controller, Get, Header, Query, Req, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SiamCaller, SiamIntegrationGuard } from './siam-integration.guard';
import { SiamIntegrationService } from './siam-integration.service';

@ApiTags('Intégration SIAM')
@Controller('integrations/siam')
@UseGuards(SiamIntegrationGuard)
export class SiamIntegrationController {
  constructor(private readonly service: SiamIntegrationService) {}

  /**
   * Statut minimal d'aptitude d'un marin, pour Titres & Certifications et le Registre des
   * gens de mer : { status, certificateNumber, visitReference, issuedAt, expiryDate,
   * expiryRecorded, verifiedAt }. Jamais de donnee medicale.
   */
  @Get('fitness')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: "Statut minimal d'aptitude (applications SIAM habilitées)" })
  @ApiQuery({ name: 'nim', required: false, description: "Numéro d'inscription maritime" })
  @ApiQuery({ name: 'cni', required: false })
  @ApiQuery({ name: 'patientId', required: false, description: 'Identifiant DMGM du marin' })
  @ApiHeader({ name: 'X-Api-Key', required: false })
  fitness(@Query('nim') nim: string | undefined, @Query('cni') cni: string | undefined, @Query('patientId') patientId: string | undefined, @Req() req: { siamCaller: SiamCaller }) {
    return this.service.fitness({ nim, cni, patientId }, req.siamCaller);
  }
}
