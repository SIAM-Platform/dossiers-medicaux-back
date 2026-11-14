/* eslint-disable prettier/prettier */
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { RequirePermission } from '../access/decorators';
import { PERMISSIONS } from '../access/permissions';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @RequirePermission(PERMISSIONS.DASHBOARD_READ)
  getStats(
    @Query('dateDebut') dateDebut?: string,
    @Query('dateFin') dateFin?: string,
    @Query('decision') decision?: string,
    @Query('status') status?: string,
  ) {
    return this.dashboardService.getStats(dateDebut, dateFin, decision, status);
  }
}