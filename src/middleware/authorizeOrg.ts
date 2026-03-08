// src/middleware/authorizeOrg.ts

import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Middleware pour vérifier qu'un utilisateur est un organisation APPROVED
 * (universite ou centre_formation avec statut APPROVED)
 */
export const authorizeOrg = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    const user = (request.user as any);

    if (!user) {
      return reply.status(401).send({ error: 'Unauthenticated' });
    }

    const role = (user.role || '').toString().toLowerCase();

    // Vérifier que c'est une organisation
    if (!['universite', 'centre_formation'].includes(role)) {
      return reply.status(403).send({
        error: `Forbidden: Only universities and training centers can perform this action`,
      });
    }

    // Vérifier le statut APPROVED de l'organisation
    const fastify = request.server as any;
    const userId = user.id;

    const table = role === 'universite' ? 'universites' : 'centres_formation';

    const { data, error } = await fastify.supabase
      .from(table)
      .select('statut')
      .eq('profile_id', userId)
      .single();

    if (error || !data) {
      return reply.status(403).send({
        error: `Forbidden: Organization account not found`,
      });
    }

    if (data.statut !== 'APPROVED') {
      return reply.status(403).send({
        error: `Forbidden: Your organization account is not approved yet (status: ${data.statut})`,
      });
    }
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({
      error: 'Failed to verify organization status',
    });
  }
};
