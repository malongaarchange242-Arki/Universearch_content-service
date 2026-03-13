// src/app.ts

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import supabasePlugin from './plugins/supabase';
import multipart from '@fastify/multipart';
import { postsRoutes } from './modules/posts/posts.routes';
import { interactionsRoutes } from './modules/interactions/interactions.routes';
import { feedRoutes } from './modules/feed/feed.routes';

/**
 * Instance principale de l'application Fastify pour le content-service
 */
export const app: FastifyInstance = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
  bodyLimit: 50 * 1024 * 1024, // 50 MB
});

/**
 * Enregistrer les plugins
 */
app.register(supabasePlugin as any);
// multipart for file uploads
app.register(multipart as any, {
  attachFieldsToBody: true,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max per file
  },
});
// Implement a small manual CORS handler for development to avoid plugin version issues.
const allowedOrigins = [
  'http://127.0.0.1:5502',
  'http://localhost:5502',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'null', // for file:// protocol
];

app.addHook('onRequest', (request, reply, done) => {
  const origin = (request.headers.origin as string) || 'null';
  if (allowedOrigins.includes(origin)) {
    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (origin !== '*') {
      reply.header('Access-Control-Allow-Credentials', 'true');
    }
  }
  if (request.method === 'OPTIONS') {
    reply.code(204).send();
    return;
  }
  done();
});
// Enable CORS for local development (adjust origin in production)
// Note: manual CORS handled above via onRequest hook.

/**
 * Route de santé
 */
app.get('/health', async () => ({
  status: 'ok',
  service: 'content-service',
  timestamp: new Date().toISOString(),
}));

/**
 * Enregistrer les module routes
 */
app.register(postsRoutes);
app.register(interactionsRoutes);
app.register(feedRoutes);

/**
 * Global error handler
 */
app.setErrorHandler(
  (
    error: Error & { statusCode?: number },
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    request.log.error(error);

    reply.status(error.statusCode ?? 500).send({
      success: false,
      error: error.message ?? 'Internal Server Error',
    });
  }
);

// Extend FastifyRequest to include user property
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: string;
      PORT: string;
      SUPABASE_URL: string;
      SUPABASE_ANON_KEY: string;
      LOG_LEVEL?: string;
    }
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      role: string;
      email?: string;
    };
  }
}
