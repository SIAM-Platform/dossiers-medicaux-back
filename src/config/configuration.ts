/* eslint-disable prettier/prettier */
export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiUrl: process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200',

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT ?? '3306', 10),
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'dmgm',
    synchronize: process.env.DB_SYNC === 'true',
  },

  keycloak: {
    authServerUrl: process.env.KEYCLOAK_SERVER_URL || 'http://localhost:8080',
    realm: process.env.KEYCLOAK_REALM || 'gestion-marins',
    clientId: process.env.KEYCLOAK_CLIENT_ID || 'gestion-certificats-api',
    secret: process.env.KEYCLOAK_CLIENT_SECRET || '',
  },

  cors: {
    origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:4200'],
  },
});