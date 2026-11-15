import { Controller, Get, Param, ParseUUIDPipe, Post, Req, Res } from '@nestjs/common';
import { Authenticated, Public } from './storage.adapter';
import { DownloadLink, StorageService } from './storage.service';

const INLINE = /^(image\/(jpeg|png|webp)|application\/pdf)$/;

/** Liens courts et téléchargement. Les fichiers ne sont jamais publiés comme ressources statiques. */
@Controller('files')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  /** Lien pour un fichier rattaché à une permission (sinon, le lien est émis par la route métier). */
  @Authenticated()
  @Post(':id/link')
  link(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: { user?: unknown }): Promise<DownloadLink> {
    return this.storage.createLink(id, req.user);
  }

  /** Le jeton signé et limité dans le temps tient lieu d'autorisation (ouverture dans un onglet). */
  @Public()
  @Get('download/:token')
  async download(
    @Param('token') token: string,
    @Req() req: { ip?: string },
    @Res() res: { setHeader(n: string, v: string): void; end(b: Buffer): void },
  ): Promise<void> {
    const { file, data } = await this.storage.download(token, req.ip ?? null);
    const ascii = file.originalName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
    const disposition = INLINE.test(file.mimeType) ? 'inline' : 'attachment';
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', String(data.length));
    res.setHeader('Content-Disposition', `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.originalName)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    // Le lecteur PDF intégré des navigateurs ne s'ouvre pas dans un document « sandbox » : la
    // restriction est posée sur les autres types (le contenu actif d'un PDF reste confiné au lecteur).
    if (file.mimeType !== 'application/pdf')
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    res.end(data);
  }
}
