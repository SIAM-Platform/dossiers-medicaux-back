import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../auth/decorators/public.decorator';

/** Sondes pour l'orchestrateur (même contrat que le socle SIAM) : /api/health, /api/health/live, /api/health/ready. */
@ApiTags('Sante')
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Liveness : le processus repond. */
  @Public()
  @Get()
  live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('live')
  liveAlias() {
    return this.live();
  }

  /** Readiness : la base est joignable et les migrations sont appliquees. */
  @Public()
  @Get('ready')
  async ready() {
    try {
      await this.dataSource.query('SELECT 1');
      const pending = await this.dataSource.showMigrations();
      if (pending) throw new Error('migrations en attente');
      return { status: 'ready', database: 'up' };
    } catch (err) {
      throw new ServiceUnavailableException(
        `Non pret : ${(err as Error).message}`,
      );
    }
  }
}
