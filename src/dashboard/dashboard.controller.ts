/* eslint-disable prettier/prettier */
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { KeycloakAuthGuard } from '../auth/guards/keycloak-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('dashboard')
@UseGuards(KeycloakAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @Roles('admin', 'medecin', 'infirmier','ci','IT')
  getStats(
    @Query('dateDebut') dateDebut?: string,
    @Query('dateFin') dateFin?: string,
    @Query('decision') decision?: string,
    @Query('status') status?: string,
  ) {
    return this.dashboardService.getStats(dateDebut, dateFin, decision, status);
  }
}