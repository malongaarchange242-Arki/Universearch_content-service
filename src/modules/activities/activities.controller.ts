// src/modules/activities/activities.controller.ts

import { FastifyReply, FastifyRequest } from 'fastify';
import * as ActivitiesService from './activities.service';

const getSupabase = (request: FastifyRequest) =>
  (request.server as any).supabaseAdmin;

export const createActivity = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const user = request.user;
  if (!user) {
    return reply.status(401).send({ success: false, error: 'Unauthorized' });
  }

  const payload = request.body as ActivitiesService.CreateActivityPayload;
  const activity = await ActivitiesService.createActivity(
    getSupabase(request),
    payload,
    user.id
  );

  reply.code(201).send({ success: true, data: activity });
};

export const listActivities = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const currentUserId = request.user?.id ?? null;
  const activities = await ActivitiesService.listActivities(
    getSupabase(request),
    currentUserId
  );
  reply.send({ success: true, data: activities });
};

export const getActivity = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const { id } = request.params as { id: string };
  const currentUserId = request.user?.id ?? null;
  const activity = await ActivitiesService.getActivity(getSupabase(request), id);

  if (!activity) {
    return reply.status(404).send({ success: false, error: 'Activity not found' });
  }

  if (!activity.is_public && activity.created_by_id !== currentUserId) {
    return reply.status(403).send({ success: false, error: 'Forbidden' });
  }

  reply.send({ success: true, data: activity });
};

export const updateActivity = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const user = request.user;
  if (!user) {
    return reply.status(401).send({ success: false, error: 'Unauthorized' });
  }

  const { id } = request.params as { id: string };
  const payload = request.body as ActivitiesService.UpdateActivityPayload;
  const activity = await ActivitiesService.updateActivity(
    getSupabase(request),
    id,
    payload,
    user.id
  );
  reply.send({ success: true, data: activity });
};

export const deleteActivity = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const user = request.user;
  if (!user) {
    return reply.status(401).send({ success: false, error: 'Unauthorized' });
  }

  const { id } = request.params as { id: string };
  await ActivitiesService.deleteActivity(getSupabase(request), id, user.id);
  reply.send({ success: true, message: 'Activity deleted' });
};
