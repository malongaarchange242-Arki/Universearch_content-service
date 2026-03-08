// src/middleware/authenticate.ts

import { FastifyRequest, FastifyReply } from 'fastify';

function decodeJWT(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1];
    const padded = payload.padEnd(payload.length + (4 - (payload.length % 4)) % 4, '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch (e) {
    return null;
  }
}

export const authenticate = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7);
  const decoded = decodeJWT(token);

  if (!decoded?.sub) {
    return reply.status(401).send({ error: 'Invalid token' });
  }

  const fastify = request.server as any;

  let role = '';

  // 1️⃣ Try token role
  const rawRole =
    decoded.user_metadata?.role ||
    decoded.role ||
    decoded.user_role ||
    '';

  const normalized = rawRole.toString().toLowerCase();

  if (normalized.includes('univers')) role = 'universite';
  if (normalized.includes('centre')) role = 'centre_formation';

  // 2️⃣ If missing, resolve from DB
  if (!role) {
    const { data: uni } = await fastify.supabase
      .from('universites')
      .select('profile_id')
      .eq('profile_id', decoded.sub)
      .maybeSingle();

    if (uni) {
      role = 'universite';
    } else {
      const { data: centre } = await fastify.supabase
        .from('centres_formation')
        .select('profile_id')
        .eq('profile_id', decoded.sub)
        .maybeSingle();

      if (centre) {
        role = 'centre_formation';
      }
    }
  }

  if (!role) {
    return reply.status(403).send({
      error: 'Forbidden: account is not an organization',
    });
  }

  request.user = {
    id: decoded.sub,
    role,
    email: decoded.email,
  };
};