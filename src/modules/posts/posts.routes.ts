// src/modules/posts/posts.routes.ts

import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import * as PostsController from './posts.controller';
import { createPostSchema, updatePostSchema } from './posts.schema';
import { authenticate, authorizeOrg } from '../../middleware';

export const postsRoutes = async (
  app: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> => {
  /**
   * POST /posts - Créer un post
   * Protégé: authentifié + organisation APPROVED
   */
  app.post(
    '/posts',
    {
      schema: createPostSchema,
      preHandler: [authenticate, authorizeOrg],
    },
    PostsController.createPost as any
  );

  /**
   * GET /posts - Lister les posts (public)
   */
  app.get('/posts', PostsController.listPosts as any);

  /**
   * POST /uploads - upload a file to Supabase Storage (server-side)
   * Protected: authenticated + organisation APPROVED
   * Expects multipart/form-data with field `file`.
   */
  app.post(
    '/uploads',
    {
      preHandler: [authenticate, authorizeOrg],
    },
    PostsController.uploadFile as any
  );

  /**
   * POST /signed-url - Create a temporary signed URL for a storage object
   * Protected: authenticated + organisation APPROVED
   * Body: { bucket, path, expires }
   */
  app.post(
    '/signed-url',
    {
      preHandler: [authenticate, authorizeOrg],
    },
    PostsController.createSignedUrl as any
  );

  /**
   * GET /posts/:id - Récupérer un post
   * Public
   */
  app.get('/posts/:id', PostsController.getPost);

  /**
   * PUT /posts/:id - Modifier un post
   * Protégé: authentifié + organisation APPROVED + propriétaire
   */
  app.put(
    '/posts/:id',
    {
      schema: updatePostSchema,
      preHandler: [authenticate, authorizeOrg],
    },
    PostsController.updatePost as any
  );

  /**
   * DELETE /posts/:id - Supprimer un post
   * Protégé: authentifié + organisation APPROVED + propriétaire
   */
  app.delete(
    '/posts/:id',
    {
      preHandler: [authenticate, authorizeOrg],
    },
    PostsController.deletePost as any
  );
};
