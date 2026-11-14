import {
  Body,
  CanActivate,
  Controller,
  DynamicModule,
  ExecutionContext,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  SetMetadata,
  Type,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PrivacyInventory } from './privacy.types';
import {
  PRIVACY_INVENTORY,
  PrivacyActor,
  PrivacyService,
} from './privacy.service';
import { CryptoKeysService } from './crypto-keys';

/**
 * Accès au module RGPD par rôle, branché sur l'authentification existante du service :
 * - `read` : consulter le registre et les durées ;
 * - `manage` : fixer les durées, lancer la purge, gérer les demandes ;
 * - `export` : exporter les données d'une personne.
 * Les rôles sont lus sur l'utilisateur attaché à la requête par le garde d'authentification du
 * service (`roles`, `role`, `realm_access.roles`, `realmRoles`, `localUser.roles`). Ils sont surchargeables par
 * l'exploitant : PRIVACY_ROLES_READ, PRIVACY_ROLES_MANAGE, PRIVACY_ROLES_EXPORT (listes séparées
 * par des virgules). Recommandation : réserver `manage` et `export` au délégué à la protection
 * des données (rôle PRIVACY_OFFICER).
 */
export interface PrivacyAccessOptions {
  read: string[];
  manage: string[];
  export: string[];
}

const LEVEL = 'privacyLevel';
const Level = (l: keyof PrivacyAccessOptions) => SetMetadata(LEVEL, l);

/** Rôles portés par l'utilisateur, quelle que soit la forme choisie par le service. */
export function rolesOf(user: unknown): string[] {
  const u = (user ?? {}) as Record<string, unknown>;
  const out: string[] = [];
  const add = (v: unknown) => {
    if (typeof v === 'string') out.push(v);
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      for (const k of ['code', 'name', 'nom', 'role'])
        if (typeof o[k] === 'string') out.push(o[k]);
    }
  };
  const local = (u.localUser ?? {}) as Record<string, unknown>;
  for (const v of [
    u.roles,
    u.realmRoles,
    (u.realm_access as { roles?: unknown })?.roles,
    local.roles,
  ])
    if (Array.isArray(v)) v.forEach(add);
  add(local.role);
  add(u.role);
  return [
    ...new Set(
      out.flatMap((r) => [r, r.toUpperCase(), r.replace(/^realm:/, '')]),
    ),
  ];
}

/** Acteur (identifiant et nom) tiré de l'utilisateur authentifié. */
export function actorOf(user: unknown): PrivacyActor {
  const u = (user ?? {}) as Record<string, unknown>;
  const id = (u.id ?? u.sub ?? u.keycloakId ?? u.userId ?? null) as
    string | null;
  const first = (u.prenom ??
    u.firstName ??
    u.firstname ??
    u.given_name ??
    '') as string;
  const last = (u.nom ??
    u.lastName ??
    u.lastname ??
    u.family_name ??
    '') as string;
  const name =
    `${first} ${last}`.trim() ||
    ((u.name ??
      u.preferred_username ??
      u.username ??
      u.email ??
      'Agent') as string);
  return { id: id === null ? null : String(id), name };
}

export function privacyModule(opts: {
  inventory: PrivacyInventory;
  authGuards: Type<CanActivate>[];
  access: PrivacyAccessOptions;
  prefix?: string;
}): DynamicModule {
  const env = (k: string, d: string[]) =>
    process.env[k]
      ? process.env[k]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : d;

  @Injectable()
  class PrivacyAccessGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}
    canActivate(ctx: ExecutionContext): boolean {
      const level = this.reflector.get<keyof PrivacyAccessOptions>(
        LEVEL,
        ctx.getHandler(),
      );
      const allowed =
        level === 'read'
          ? env('PRIVACY_ROLES_READ', opts.access.read)
          : level === 'manage'
            ? env('PRIVACY_ROLES_MANAGE', opts.access.manage)
            : env('PRIVACY_ROLES_EXPORT', opts.access.export);
      const mine = rolesOf(
        ctx.switchToHttp().getRequest<{ user?: unknown }>().user,
      );
      if (
        !allowed.some((r) => mine.includes(r) || mine.includes(r.toUpperCase()))
      )
        throw new ForbiddenException({
          code: 'PRIVACY_FORBIDDEN',
          message: 'Accès réservé au délégué à la protection des données',
        });
      return true;
    }
  }

  @Controller(opts.prefix ?? 'privacy')
  @UseGuards(...opts.authGuards, PrivacyAccessGuard)
  class PrivacyController {
    constructor(private readonly privacy: PrivacyService) {}
    private actor(req: { user?: unknown }) {
      return actorOf(req.user);
    }
    @Level('read') @Get('register') register() {
      return this.privacy.register();
    }
    @Level('read')
    @Get('register.csv')
    @Header('Content-Type', 'text/csv; charset=utf-8')
    @Header(
      'Content-Disposition',
      'attachment; filename="registre-des-traitements.csv"',
    )
    registerCsv() {
      return this.privacy.registerCsv();
    }
    @Level('read') @Get('retention') policies() {
      return this.privacy.policies();
    }
    @Level('manage') @Put('retention/:key') setPolicy(
      @Param('key') key: string,
      @Body() b: { days: number; reason: string },
      @Req() req: { user?: unknown },
    ) {
      return this.privacy.setPolicy(
        key,
        Number(b?.days),
        String(b?.reason ?? ''),
        this.actor(req),
      );
    }
    @Level('manage') @Post('retention/run') @HttpCode(200) run(
      @Body() b: { apply?: boolean },
      @Req() req: { user?: unknown },
    ) {
      return this.privacy.runRetention({
        apply: b?.apply === true,
        actor: this.actor(req),
      });
    }
    @Level('manage') @Get('requests') list(
      @Query() q: { status?: string; overdue?: string },
    ) {
      return this.privacy.listRequests(q);
    }
    @Level('manage') @Post('requests') create(
      @Body() b: Record<string, unknown>,
      @Req() req: { user?: unknown },
    ) {
      return this.privacy.createRequest(b ?? {}, this.actor(req));
    }
    @Level('manage') @Patch('requests/:id') update(
      @Param('id') id: string,
      @Body() b: { status?: string; response?: string },
      @Req() req: { user?: unknown },
    ) {
      return this.privacy.updateRequest(id, b ?? {}, this.actor(req));
    }
    @Level('manage') @Get('audit') audit(@Query('limit') limit?: string) {
      return this.privacy.auditTrail(Number(limit));
    }
    @Level('export') @Get('subjects/:type/export') export(
      @Param('type') type: string,
      @Query('ref') ref: string,
      @Req() req: { user?: unknown },
    ) {
      return this.privacy.exportSubject(type, ref, this.actor(req));
    }
  }

  @Module({})
  class PrivacyModule {}

  return {
    module: PrivacyModule,
    controllers: [PrivacyController],
    providers: [
      // Trousseau du chiffrement des champs (chargé au démarrage, rechargé périodiquement).
      CryptoKeysService,
      { provide: PRIVACY_INVENTORY, useValue: opts.inventory },
      PrivacyService,
      PrivacyAccessGuard,
      ...opts.authGuards,
    ],
    exports: [PrivacyService],
  };
}
