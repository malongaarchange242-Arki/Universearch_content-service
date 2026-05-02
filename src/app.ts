// src/app.ts

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import supabasePlugin from './plugins/supabase';
import multipart from '@fastify/multipart';
import { postsRoutes } from './modules/posts/posts.routes';
import { interactionsRoutes } from './modules/interactions/interactions.routes';
import { feedRoutes } from './modules/feed/feed.routes';
import { statsRoutes } from './modules/stats/stats.routes';
import feedbacksRoutes from './routes/feedbacks';
import { authMiddleware } from './middleware/auth';
import { videoProcessingQueue, videoProcessingDlq, syncPendingJobCounts } from './queues/videoProcessing.queue';

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
  interface FastifyInstance {
    authMiddleware: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user?: {
      id: string;
      role: string;
      email?: string;
    };
    userId?: string;
  }
}

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

app.get('/internal/queues/video-processing/stats', async (request, reply) => {
  const monitorToken = process.env.QUEUE_MONITOR_TOKEN;
  if (monitorToken) {
    const authHeader = request.headers.authorization || '';
    if (authHeader !== `Bearer ${monitorToken}`) {
      return reply.status(401).send({ success: false, error: 'Unauthorized' });
    }
  }

  const counts = await videoProcessingQueue.getJobCounts(
    'waiting',
    'active',
    'completed',
    'failed',
    'delayed',
    'prioritized',
    'paused'
  );

  return {
    success: true,
    queue: 'video-processing',
    counts,
    timestamp: new Date().toISOString(),
  };
});

app.get('/internal/queues/video-processing/dlq', async (request, reply) => {
  const monitorToken = process.env.QUEUE_MONITOR_TOKEN;
  if (monitorToken) {
    const authHeader = request.headers.authorization || '';
    if (authHeader !== `Bearer ${monitorToken}`) {
      return reply.status(401).send({ success: false, error: 'Unauthorized' });
    }
  }

  const { start = 0, limit = 50, error_contains, date_from, date_to } = request.query as any;

  const dlqJobs = await videoProcessingDlq.getJobs(['failed'], start, limit);
  const filteredJobs = dlqJobs.filter(job => {
    if (error_contains && !job.data.failedReason?.includes(error_contains)) return false;
    if (date_from && new Date(job.timestamp) < new Date(date_from)) return false;
    if (date_to && new Date(job.timestamp) > new Date(date_to)) return false;
    return true;
  });

  const jobDetails = filteredJobs.map(job => ({
    id: job.id,
    failedReason: job.data.failedReason,
    failedStack: job.data.failedStack,
    sourceJobId: job.data.sourceJobId,
    ownerId: job.data.ownerId,
    postId: job.data.postId,
    campaignId: job.data.campaignId,
    rawPath: job.data.rawPath,
    originalFilename: job.data.originalFilename,
    createdAt: new Date(job.timestamp).toISOString(),
    failedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
  }));

  return {
    success: true,
    queue: 'video-processing-dlq',
    jobs: jobDetails,
    total: filteredJobs.length,
    timestamp: new Date().toISOString(),
  };
});

app.post('/internal/queues/video-processing/dlq/retry/:jobId', async (request: FastifyRequest, reply: FastifyReply) => {
  const monitorToken = process.env.QUEUE_MONITOR_TOKEN;
  if (monitorToken) {
    const authHeader = request.headers.authorization || '';
    if (authHeader !== `Bearer ${monitorToken}`) {
      return reply.status(401).send({ success: false, error: 'Unauthorized' });
    }
  }

  const { jobId } = request.params as any;
  const { force = false } = request.body as any;

  try {
    const dlqJob = await videoProcessingDlq.getJob(jobId);
    if (!dlqJob) {
      return reply.status(404).send({ success: false, error: 'DLQ job not found' });
    }

    // Retry intelligent : seulement si c'est un timeout ou erreur temporaire
    const errorReason = dlqJob.data.failedReason || '';
    const isRetryable = force || (
      errorReason.includes('timeout') ||
      errorReason.includes('ECONNRESET') ||
      errorReason.includes('ENOTFOUND') ||
      errorReason.includes('Temporary failure')
    );

    if (!isRetryable) {
      return reply.status(400).send({
        success: false,
        error: 'Job not retryable (not a temporary error)',
        reason: errorReason
      });
    }

    // Recréer le job dans la queue principale
    const newJob = await videoProcessingQueue.add('process-video', dlqJob.data as any, {
      jobId: `retry:${jobId}:${Date.now()}`,
      priority: 1, // priorité basse pour les retries
    });

    // Supprimer de la DLQ
    await dlqJob.remove();

    return {
      success: true,
      message: 'Job retried successfully',
      newJobId: newJob.id,
      originalJobId: jobId,
    };
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
});

/**
 * Enregistrer les module routes
 */
app.register(postsRoutes);
app.register(interactionsRoutes);
app.register(feedRoutes);
app.register(statsRoutes);
app.register(feedbacksRoutes);

// Enregistrer le middleware auth
app.decorate('authMiddleware', authMiddleware);

// Scheduler pour sync périodique des compteurs pending jobs (toutes les 5 minutes)
setInterval(syncPendingJobCounts, 5 * 60 * 1000);
console.log('Started periodic sync of pending job counts (every 5 minutes)');

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

export default app;

