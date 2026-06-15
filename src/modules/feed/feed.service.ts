// src/modules/feed/feed.service.ts

import { SupabaseClient } from '@supabase/supabase-js';

export interface FeedPost {
  id: string;
  author_id: string;
  author_type: string;
  titre: string;
  description: string | null;
  contenu: string | null;
  media_url: string | null;
  media_type: string | null;
  statut: string;
  date_creation: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  views_count: number;
}

export interface FeedResponse {
  data: FeedPost[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

const MAX_LIMIT = 15;
const DEFAULT_LIMIT = 10;
const POST_SELECT_FIELDS = `
  id,
  author_id,
  author_type,
  titre,
  description,
  contenu,
  media_url,
  media_type,
  statut,
  date_creation
`;

const clampPage = (page: number): number => {
  const value = Number(page) || 1;
  return value < 1 ? 1 : value;
};

const clampLimit = (limit: number): number => {
  const value = Number(limit) || DEFAULT_LIMIT;
  if (value < 1) return DEFAULT_LIMIT;
  return value > MAX_LIMIT ? MAX_LIMIT : value;
};

const countRowsByPostIds = async (
  supabase: SupabaseClient,
  table: string,
  postIds: string[]
): Promise<Record<string, number>> => {
  if (!postIds.length) {
    return {};
  }

  const { data, error } = await supabase
    .from(table)
    .select('post_id, count:id', { count: 'exact' })
    .in('post_id', postIds);

  if (error) {
    throw new Error(`Failed to fetch counts from ${table}: ${error.message}`);
  }

  return (data || []).reduce((acc: Record<string, number>, row: any) => {
    const postId = String(row.post_id);
    const count = Number(row.count ?? 0);
    if (!Number.isNaN(count)) {
      acc[postId] = count;
    }
    return acc;
  }, {});
};

const enrichPostsWithCounts = async (
  supabase: SupabaseClient,
  posts: any[]
): Promise<FeedPost[]> => {
  const postIds = posts.map((post) => String(post.id)).filter(Boolean);

  const [likesByPost, commentsByPost, sharesByPost, viewsByPost] = await Promise.all([
    countRowsByPostIds(supabase, 'post_likes', postIds),
    countRowsByPostIds(supabase, 'post_comments', postIds),
    countRowsByPostIds(supabase, 'post_shares', postIds),
    countRowsByPostIds(supabase, 'post_views', postIds),
  ]);

  return posts.map((post) => ({
    ...post,
    likes_count: likesByPost[post.id] ?? 0,
    comments_count: commentsByPost[post.id] ?? 0,
    shares_count: sharesByPost[post.id] ?? 0,
    views_count: viewsByPost[post.id] ?? 0,
  }));
};

const fetchPosts = async (
  queryBuilder: any,
  page: number,
  limit: number
) => {
  const offset = (page - 1) * limit;

  const { data: posts, error, count } = await queryBuilder
    .order('date_creation', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch feed posts: ${error.message}`);
  }

  return {
    posts: posts || [],
    total: count || 0,
  };
};

export const getFeed = async (
  supabase: SupabaseClient,
  page: number = 1,
  limit: number = DEFAULT_LIMIT
): Promise<FeedResponse> => {
  const safePage = clampPage(page);
  const safeLimit = clampLimit(limit);

  const { posts, total } = await fetchPosts(
    supabase
      .from('posts')
      .select(POST_SELECT_FIELDS, { count: 'exact' })
      .eq('statut', 'PUBLISHED'),
    safePage,
    safeLimit
  );

  const enrichedPosts = await enrichPostsWithCounts(supabase, posts);

  return {
    data: enrichedPosts,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
    },
  };
};

export const getUniversitesFeed = async (
  supabase: SupabaseClient,
  page: number = 1,
  limit: number = DEFAULT_LIMIT
): Promise<FeedResponse> => {
  const safePage = clampPage(page);
  const safeLimit = clampLimit(limit);

  const { posts, total } = await fetchPosts(
    supabase.from('posts')
      .select(POST_SELECT_FIELDS, { count: 'exact' })
      .eq('author_type', 'universite')
      .eq('statut', 'PUBLISHED'),
    safePage,
    safeLimit
  );

  const enrichedPosts = await enrichPostsWithCounts(supabase, posts);

  return {
    data: enrichedPosts,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
    },
  };
};

export const getCentresFeed = async (
  supabase: SupabaseClient,
  page: number = 1,
  limit: number = DEFAULT_LIMIT
): Promise<FeedResponse> => {
  const safePage = clampPage(page);
  const safeLimit = clampLimit(limit);

  const { posts, total } = await fetchPosts(
    supabase.from('posts')
      .select(POST_SELECT_FIELDS, { count: 'exact' })
      .eq('author_type', 'centre_formation')
      .eq('statut', 'PUBLISHED'),
    safePage,
    safeLimit
  );

  const enrichedPosts = await enrichPostsWithCounts(supabase, posts);

  return {
    data: enrichedPosts,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
    },
  };
};

export const getOrganizationFeed = async (
  supabase: SupabaseClient,
  organizationId: string,
  organizationType: 'universite' | 'centre_formation',
  page: number = 1,
  limit: number = DEFAULT_LIMIT
): Promise<FeedResponse> => {
  const safePage = clampPage(page);
  const safeLimit = clampLimit(limit);

  const { posts, total } = await fetchPosts(
    supabase
      .from('posts')
      .select(POST_SELECT_FIELDS, { count: 'exact' })
      .eq('author_id', organizationId)
      .eq('author_type', organizationType)
      .eq('statut', 'PUBLISHED'),
    safePage,
    safeLimit
  );

  const enrichedPosts = await enrichPostsWithCounts(supabase, posts);

  return {
    data: enrichedPosts,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
    },
  };
};
