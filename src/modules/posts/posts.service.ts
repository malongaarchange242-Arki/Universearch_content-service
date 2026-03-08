// src/modules/posts/posts.service.ts

import { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export interface CreatePostPayload {
  titre: string;
  description?: string | null;
  // 'contenu' removed: use 'description' field instead
  media_url?: string | null;
  media_type?: 'image' | 'video' | null;
}

export interface UpdatePostPayload {
  titre?: string;
  description?: string | null;
  media_url?: string | null;
  media_type?: 'image' | 'video' | null;
  statut?: string;
}

export interface PostResponse {
  id: string;
  author_id: string;
  author_type: string;
  titre: string;
  description: string | null;
  contenu: string;
  media_url: string | null;
  media_type: string | null;
  statut: string;
  date_creation: string;
}

/**
 * Créer un post
 */
export const createPost = async (
  supabase: SupabaseClient,
  authorId: string,
  authorType: string,
  payload: CreatePostPayload
): Promise<PostResponse> => {
  const postId = randomUUID();
  const now = new Date().toISOString();

  const insertObj: any = {
    id: postId,
    author_id: authorId,
    author_type: authorType,
    titre: payload.titre,
    description: payload.description || null,
    media_url: payload.media_url || null,
    media_type: payload.media_type || null,
    statut: 'PUBLISHED',
    date_creation: now,
  };

  const { data, error } = await supabase
    .from('posts')
    .insert(insertObj)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create post: ${error.message}`);
  }

  return data as PostResponse;
};

/**
 * Lister les posts (récupération publique)
 */
export const listPosts = async (
  supabase: SupabaseClient,
  limit = 50,
  filter?: { author_id?: string; author_type?: string }
): Promise<PostResponse[]> => {
  // Build base query
  let query: any = supabase.from('posts').select('*');

  // If a filter (exact match) is provided, apply it using .match()
  if (filter && Object.keys(filter).length > 0) {
    query = query.match(filter);
  }

  // Apply ordering and limit after filtering
  query = query.order('date_creation', { ascending: false }).limit(limit);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list posts: ${error.message}`);
  }

  return (data || []) as PostResponse[];
};

/**
 * Récupérer un post par ID
 */
export const getPost = async (
  supabase: SupabaseClient,
  postId: string
): Promise<PostResponse & { likes_count: number; comments_count: number }> => {
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('*')
    .eq('id', postId)
    .single();

  if (postError || !post) {
    throw new Error('Post not found');
  }

  // Récupérer les compteurs (si ces tables existent)
  const { count: likesCount } = await supabase
    .from('post_likes')
    .select('id', { count: 'exact' })
    .eq('post_id', postId);

  const { count: commentsCount } = await supabase
    .from('post_comments')
    .select('id', { count: 'exact' })
    .eq('post_id', postId);

  return {
    ...post,
    likes_count: likesCount || 0,
    comments_count: commentsCount || 0,
  } as any;
};

/**
 * Mettre à jour un post
 */
export const updatePost = async (
  supabase: SupabaseClient,
  postId: string,
  authorId: string,
  payload: UpdatePostPayload
): Promise<PostResponse> => {
  // Vérifier que l'auteur du post est bien l'auteur connecté
  const { data: post, error: fetchError } = await supabase
    .from('posts')
    .select('author_id')
    .eq('id', postId)
    .single();

  if (fetchError || !post) {
    throw new Error('Post not found');
  }

  if (post.author_id !== authorId) {
    throw new Error('Unauthorized: You can only modify your own posts');
  }

  const updateData: any = {
    ...payload,
  };

  const { data, error } = await supabase
    .from('posts')
    .update(updateData)
    .eq('id', postId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update post: ${error.message}`);
  }

  return data as PostResponse;
};

/**
 * Supprimer un post
 */
export const deletePost = async (
  supabase: SupabaseClient,
  postId: string,
  authorId: string
): Promise<void> => {
  // Vérifier que l'auteur du post est bien l'auteur connecté
  const { data: post, error: fetchError } = await supabase
    .from('posts')
    .select('author_id')
    .eq('id', postId)
    .single();

  if (fetchError || !post) {
    throw new Error('Post not found');
  }

  if (post.author_id !== authorId) {
    throw new Error('Unauthorized: You can only delete your own posts');
  }

  // Supprimer les likes
  await supabase.from('post_likes').delete().eq('post_id', postId);

  // Supprimer les commentaires
  await supabase.from('post_comments').delete().eq('post_id', postId);

  // Supprimer les vues
  await supabase.from('post_views').delete().eq('post_id', postId);

  // Supprimer le post
  const { error } = await supabase.from('posts').delete().eq('id', postId);

  if (error) {
    throw new Error(`Failed to delete post: ${error.message}`);
  }
};
