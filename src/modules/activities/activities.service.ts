// src/modules/activities/activities.service.ts

import { SupabaseClient } from '@supabase/supabase-js';

export interface CreateActivityPayload {
  title: string;
  description?: string | null;
  status?: 'active' | 'completed' | 'archived';
  is_public?: boolean;
}

export interface UpdateActivityPayload {
  title?: string;
  description?: string | null;
  status?: 'active' | 'completed' | 'archived';
  is_public?: boolean;
}

export interface ActivityRecord {
  id: string;
  title: string;
  description: string | null;
  status: 'active' | 'completed' | 'archived';
  is_public: boolean;
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

export const createActivity = async (
  supabase: SupabaseClient,
  payload: CreateActivityPayload,
  createdById: string
): Promise<ActivityRecord> => {
  const insertPayload = {
    ...payload,
    description: payload.description ?? null,
    is_public: payload.is_public ?? true,
    status: payload.status ?? 'active',
    created_by_id: createdById,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('activities')
    .insert([insertPayload])
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to create activity: ${error.message}`);
  }

  return data as ActivityRecord;
};

export const listActivities = async (
  supabase: SupabaseClient,
  currentUserId?: string | null
): Promise<ActivityRecord[]> => {
  let query = supabase.from('activities').select('*');

  if (currentUserId) {
    query = query.or(`is_public.eq.true,created_by_id.eq.${currentUserId}`);
  } else {
    query = query.eq('is_public', true);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list activities: ${error.message}`);
  }

  return (data || []) as ActivityRecord[];
};

export const getActivity = async (
  supabase: SupabaseClient,
  activityId: string
): Promise<ActivityRecord | null> => {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('id', activityId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch activity: ${error.message}`);
  }

  return data as ActivityRecord | null;
};

export const updateActivity = async (
  supabase: SupabaseClient,
  activityId: string,
  payload: UpdateActivityPayload,
  userId: string
): Promise<ActivityRecord> => {
  const updatePayload = {
    ...payload,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('activities')
    .update(updatePayload)
    .eq('id', activityId)
    .eq('created_by_id', userId)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to update activity: ${error.message}`);
  }

  return data as ActivityRecord;
};

export const deleteActivity = async (
  supabase: SupabaseClient,
  activityId: string,
  userId: string
): Promise<void> => {
  const { error } = await supabase
    .from('activities')
    .delete()
    .eq('id', activityId)
    .eq('created_by_id', userId);

  if (error) {
    throw new Error(`Failed to delete activity: ${error.message}`);
  }
};
