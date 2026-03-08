// src/modules/interactions/interactions.routes.ts

import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import * as InteractionsController from './interactions.controller';
import { createCommentSchema, getCommentsSchema } from './interactions.schema';
import { authenticate } from '../../middleware';

export const interactionsRoutes = async (
  app: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> => {
  /**
   * POST /posts/:id/like - Aimer un post
   * Protégé: authentifié
   */
  app.post(
    '/posts/:id/like',
    { preHandler: [authenticate] },
    InteractionsController.likePost as any
  );

  /**
   * DELETE /posts/:id/like - Retirer un like
   * Protégé: authentifié
   */
  app.delete(
    '/posts/:id/like',
    { preHandler: [authenticate] },
    InteractionsController.unlikePost as any
  );

  /**
   * POST /posts/:id/comment - Commenter un post
   * Protégé: authentifié
   */
  app.post(
    '/posts/:id/comment',
    {
      schema: createCommentSchema,
      preHandler: [authenticate],
    },
    InteractionsController.commentPost as any
  );

  /**
   * GET /posts/:id/comments - Récupérer les commentaires
   * Public avec pagination
   */
  app.get(
    '/posts/:id/comments',
    { schema: getCommentsSchema },
    InteractionsController.getComments as any
  );
};
