// src/modules/feed/feed.service.ts

import { SupabaseClient, createClient } from '@supabase/supabase-js';

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
  shares_count?: number;
  views_count?: number;
}

export interface FeedResponse {
  data: FeedPost[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

const getMetricsClient = (supabase: SupabaseClient): SupabaseClient =>
  process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    : supabase;

const enrichPostWithCounts = async (
  supabase: SupabaseClient,
  post: any
): Promise<FeedPost> => {
  const metricsClient = getMetricsClient(supabase);

  const [
    { count: likesCount },
    { count: commentsCount },
    { count: sharesCount },
    { count: viewsCount },
  ] = await Promise.all([
    metricsClient
      .from('post_likes')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', post.id),
    metricsClient
      .from('post_comments')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', post.id),
    metricsClient
      .from('post_shares')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', post.id),
    metricsClient
      .from('post_views')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', post.id),
  ]);

  return {
    ...post,
    likes_count: likesCount || 0,
    comments_count: commentsCount || 0,
    shares_count: sharesCount || 0,
    views_count: viewsCount || 0,
  };
};

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
    posts.map((post) => enrichPostWithCounts(supabase, post))
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
    .eq('author_type', 'universite')
    .order('date_creation', { ascending: false })
    .range(offset, offset + limit - 1);

  if (postsError || !posts) {
    throw new Error(`Failed to fetch universities feed: ${postsError?.message}`);
  }

  // Enrichir avec les compteurs
  const enrichedPosts = await Promise.all(
    posts.map((post) => enrichPostWithCounts(supabase, post))
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
    .eq('author_type', 'centre_formation')
    .order('date_creation', { ascending: false })
    .range(offset, offset + limit - 1);

  if (postsError || !posts) {
    throw new Error(`Failed to fetch centers feed: ${postsError?.message}`);
  }

  // Enrichir avec les compteurs
  const enrichedPosts = await Promise.all(
    posts.map((post) => enrichPostWithCounts(supabase, post))
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
 * Récupérer le feed d'une organisation spécifique (université ou centre)
 */
export const getOrganizationFeed = async (
  supabase: SupabaseClient,
  organizationId: string,
  organizationType: 'universite' | 'centre_formation',
  page: number = 1,
  limit: number = 10
): Promise<FeedResponse> => {
  const offset = (page - 1) * limit;

  const { data: posts, error: postsError, count } = await supabase
    .from('posts')
    .select('*', { count: 'exact' })
    .eq('author_id', organizationId)
    .eq('author_type', organizationType)
    .order('date_creation', { ascending: false })
    .range(offset, offset + limit - 1);

  if (postsError || !posts) {
    throw new Error(`Failed to fetch organization feed: ${postsError?.message}`);
  }

  // Enrichir avec les compteurs
  const enrichedPosts = await Promise.all(
    posts.map((post) => enrichPostWithCounts(supabase, post))
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
