// src/server.ts

import 'dotenv/config';
import { app } from './app';

// Default content-service port set to 3002 to avoid conflict with identity-service
const PORT = parseInt(process.env.PORT || '3002', 10);
const HOST = '0.0.0.0';

const start = async () => {
  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`🚀 Content service listening on http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
