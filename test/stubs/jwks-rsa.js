/* Remplace jwks-rsa (module ESM non chargeable par Jest) dans les tests d'intégration qui démarrent
   l'application complète sans appel HTTP : la vérification des jetons n'y est pas exercée. */
module.exports = { passportJwtSecret: () => (_req, _token, done) => done(new Error('jwks indisponible en test')) };
