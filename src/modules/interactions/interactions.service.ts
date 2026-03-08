// src/modules/interactions/interactions.service.ts

import { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export interface LikeResponse {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface CommentPayload {
  commentaire: string;
}

export interface CommentResponse {
  id: string;
  post_id: string;
  user_id: string;
  commentaire: string;
  created_at: string;
}

/**
 * Aimer un post
 */
export const likePost = async (
  supabase: SupabaseClient,
  postId: string,
  userId: string
): Promise<LikeResponse> => {
  // Vérifier que le post existe
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id')
    .eq('id', postId)
    .single();

  if (postError || !post) {
    throw new Error('Post not found');
  }

  // Vérifier que l'utilisateur n'a pas déjà liké
  const { data: existing } = await supabase
    .from('post_likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .single();

  if (existing) {
    throw new Error('You already liked this post');
  }

  const likeId = randomUUID();
  const { data, error } = await supabase
    .from('post_likes')
    .insert({
      id: likeId,
      post_id: postId,
      user_id: userId,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to like post: ${error.message}`);
  }

  return data;
};

/**
 * Retirer un like
 */
export const unlikePost = async (
  supabase: SupabaseClient,
  postId: string,
  userId: string
): Promise<void> => {
  const { error } = await supabase
    .from('post_likes')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to unlike post: ${error.message}`);
  }
};

/**
 * Commenter un post
 */
export const commentPost = async (
  supabase: SupabaseClient,
  postId: string,
  userId: string,
  payload: CommentPayload
): Promise<CommentResponse> => {
  // Vérifier que le post existe
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id')
    .eq('id', postId)
    .single();

  if (postError || !post) {
    throw new Error('Post not found');
  }

  const commentId = randomUUID();
  const { data, error } = await supabase
    .from('post_comments')
    .insert({
      id: commentId,
      post_id: postId,
      user_id: userId,
      commentaire: payload.commentaire,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to comment post: ${error.message}`);
  }

  return data;
};

/**
 * Récupérer les commentaires d'un post
 */
export const getComments = async (
  supabase: SupabaseClient,
  postId: string,
  page: number = 1,
  limit: number = 20
): Promise<{
  data: CommentResponse[];
  total: number;
  page: number;
  limit: number;
}> => {
  const offset = (page - 1) * limit;

  const { data: comments, error, count } = await supabase
    .from('post_comments')
    .select('*', { count: 'exact' })
    .eq('post_id', postId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch comments: ${error.message}`);
  }

  return {
    data: comments as CommentResponse[],
    total: count || 0,
    page,
    limit,
  };
};
