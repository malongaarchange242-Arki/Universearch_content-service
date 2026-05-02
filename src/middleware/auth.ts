// src/middleware/auth.ts
import { FastifyRequest, FastifyReply } from 'fastify';

export const authMiddleware = async (request: FastifyRequest, reply: FastifyReply) => {
  // Simulation d'authentification : injecter un user_id fictif
  // En production, vérifier le token JWT et extraire user_id
  const userId = request.headers['x-user-id'] as string || '550e8400-e29b-41d4-a716-446655440000'; // UUID fictif
  request.userId = userId;
};