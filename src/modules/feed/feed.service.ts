// src/modules/feed/feed.service.ts

import { SupabaseClient } from '@supabase/supabase-js';

export interface FeedPost {
  id: string;
  org_id: string;
  org_type: string;
  contenu: string;
  media_url: string | null;
  media_type: string | null;
  date_creation: string;
  likes_count: number;
  comments_count: number;
}

export interface FeedResponse {
  data: FeedPost[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

/**
 * Récupérer le feed complet (public)
 */
export const getFeed = async (
  supabase: SupabaseClient,
  page: number = 1,
  limit: number = 10
): Promise<FeedResponse> => {
  const offset = (page - 1) * limit;

  // Récupérer les posts avec pagination
  const { data: posts, error: postsError, count } = await supabase
    .from('posts')
    .select('*', { count: 'exact' })
    .order('date_creation', { ascending: false })
    .range(offset, offset + limit - 1);

  if (postsError || !posts) {
    throw new Error(`Failed to fetch feed: ${postsError?.message}`);
  }

  // Enrichir avec les compteurs
  const enrichedPosts = await Promise.all(
    posts.map(async (post) => {
      const { count: likesCount } = await supabase
        .from('post_likes')
        .select('id', { count: 'exact' })
        .eq('post_id', post.id);

      const { count: commentsCount } = await supabase
        .from('post_comments')
        .select('id', { count: 'exact' })
        .eq('post_id', post.id);

      return {
        ...post,
        likes_count: likesCount || 0,
        comments_count: commentsCount || 0,
      };
    })
  );

  return {
    data: enrichedPosts,
    pagination: {
      page,
      limit,
      total: count || 0,
    },
  };
};

/**
 * Récupérer le feed des universités
 */
export const getUniversitesFeed = async (
  supabase: SupabaseClient,
  page: number = 1,
  limit: number = 10
): Promise<FeedResponse> => {
  const offset = (page - 1) * limit;

  const { data: posts, error: postsError, count } = await supabase
    .from('posts')
    .select('*', { count: 'exact' })
    .eq('org_type', 'universite')
    .order('date_creation', { ascending: false })
    .range(offset, offset + limit - 1);

  if (postsError || !posts) {
    throw new Error(`Failed to fetch universities feed: ${postsError?.message}`);
  }

  // Enrichir avec les compteurs
  const enrichedPosts = await Promise.all(
    posts.map(async (post) => {
      const { count: likesCount } = await supabase
        .from('post_likes')
        .select('id', { count: 'exact' })
        .eq('post_id', post.id);

      const { count: commentsCount } = await supabase
        .from('post_comments')
        .select('id', { count: 'exact' })
        .eq('post_id', post.id);

      return {
        ...post,
        likes_count: likesCount || 0,
        comments_count: commentsCount || 0,
      };
    })
  );

  return {
    data: enrichedPosts,
    pagination: {
      page,
      limit,
      total: count || 0,
    },
  };
};

/**
 * Récupérer le feed des centres de formation
 */
export const getCentresFeed = async (
  supabase: SupabaseClient,
  page: number = 1,
  limit: number = 10
): Promise<FeedResponse> => {
  const offset = (page - 1) * limit;

  const { data: posts, error: postsError, count } = await supabase
    .from('posts')
    .select('*', { count: 'exact' })
    .eq('org_type', 'centre_formation')
    .order('date_creation', { ascending: false })
    .range(offset, offset + limit - 1);

  if (postsError || !posts) {
    throw new Error(`Failed to fetch centers feed: ${postsError?.message}`);
  }

  // Enrichir avec les compteurs
  const enrichedPosts = await Promise.all(
    posts.map(async (post) => {
      const { count: likesCount } = await supabase
        .from('post_likes')
        .select('id', { count: 'exact' })
        .eq('post_id', post.id);

      const { count: commentsCount } = await supabase
        .from('post_comments')
        .select('id', { count: 'exact' })
        .eq('post_id', post.id);

      return {
        ...post,
        likes_count: likesCount || 0,
        comments_count: commentsCount || 0,
      };
    })
  );

  return {
    data: enrichedPosts,
    pagination: {
      page,
      limit,
      total: count || 0,
    },
  };
};
