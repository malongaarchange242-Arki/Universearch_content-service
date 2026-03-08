// src/modules/feed/feed.controller.ts

import { FastifyRequest, FastifyReply } from 'fastify';
import * as FeedService from './feed.service';

/**
 * Récupérer le feed complet
 */
export const getFeed = async (
  request: FastifyRequest<{ Querystring: { page?: number; limit?: number } }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const supabase = (request.server as any).supabase;
    const page = request.query.page || 1;
    const limit = request.query.limit || 10;

    const result = await FeedService.getFeed(supabase, page, limit);

    reply.send({
      success: true,
      ...result,
    });
  } catch (error) {
    request.log.error(error);
    reply.status(500).send({
      success: false,
      error: (error as Error).message,
    });
  }
};

/**
 * Récupérer le feed des universités
 */
export const getUniversitesFeed = async (
  request: FastifyRequest<{ Querystring: { page?: number; limit?: number } }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const supabase = (request.server as any).supabase;
    const page = request.query.page || 1;
    const limit = request.query.limit || 10;

    const result = await FeedService.getUniversitesFeed(supabase, page, limit);

    reply.send({
      success: true,
      ...result,
    });
  } catch (error) {
    request.log.error(error);
    reply.status(500).send({
      success: false,
      error: (error as Error).message,
    });
  }
};

/**
 * Récupérer le feed des centres
 */
export const getCentresFeed = async (
  request: FastifyRequest<{ Querystring: { page?: number; limit?: number } }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const supabase = (request.server as any).supabase;
    const page = request.query.page || 1;
    const limit = request.query.limit || 10;

    const result = await FeedService.getCentresFeed(supabase, page, limit);

    reply.send({
      success: true,
      ...result,
    });
  } catch (error) {
    request.log.error(error);
    reply.status(500).send({
      success: false,
      error: (error as Error).message,
    });
  }
};
