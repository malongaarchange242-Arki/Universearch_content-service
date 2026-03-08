// src/modules/interactions/interactions.controller.ts

import { FastifyRequest, FastifyReply } from 'fastify';
import * as InteractionsService from './interactions.service';

/**
 * Aimer un post
 */
export const likePost = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const user = (request.user as any);
    const supabase = (request.server as any).supabase;

    const like = await InteractionsService.likePost(
      supabase,
      request.params.id,
      user.id
    );

    reply.status(201).send({
      success: true,
      data: like,
    });
  } catch (error) {
    request.log.error(error);
    const statusCode = (error as Error).message.includes('already') ? 400 : 404;
    reply.status(statusCode).send({
      success: false,
      error: (error as Error).message,
    });
  }
};

/**
 * Retirer un like
 */
export const unlikePost = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const user = (request.user as any);
    const supabase = (request.server as any).supabase;

    await InteractionsService.unlikePost(supabase, request.params.id, user.id);

    reply.send({
      success: true,
      message: 'Like removed',
    });
  } catch (error) {
    request.log.error(error);
    reply.status(400).send({
      success: false,
      error: (error as Error).message,
    });
  }
};

/**
 * Commenter un post
 */
export const commentPost = async (
  request: FastifyRequest<{ Params: { id: string }; Body: InteractionsService.CommentPayload }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const user = (request.user as any);
    const supabase = (request.server as any).supabase;

    const comment = await InteractionsService.commentPost(
      supabase,
      request.params.id,
      user.id,
      request.body
    );

    reply.status(201).send({
      success: true,
      data: comment,
    });
  } catch (error) {
    request.log.error(error);
    reply.status(400).send({
      success: false,
      error: (error as Error).message,
    });
  }
};

/**
 * Récupérer les commentaires
 */
export const getComments = async (
  request: FastifyRequest<{ Params: { id: string }; Querystring: { page?: number; limit?: number } }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const supabase = (request.server as any).supabase;
    const page = request.query.page || 1;
    const limit = request.query.limit || 20;

    const result = await InteractionsService.getComments(
      supabase,
      request.params.id,
      page,
      limit
    );

    reply.send({
      success: true,
      data: result.data,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
      },
    });
  } catch (error) {
    request.log.error(error);
    reply.status(400).send({
      success: false,
      error: (error as Error).message,
    });
  }
};
