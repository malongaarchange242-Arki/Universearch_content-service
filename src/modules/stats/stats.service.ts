// src/modules/stats/stats.service.ts

import { SupabaseClient } from '@supabase/supabase-js';

export interface OrganizationViewsStats {
  organization_id: string;
  organization_type: 'universite' | 'centre_formation';
  total_posts: number;
  total_views: number;
}

export interface TopFollowerInteraction {
  user_id: string;
  display_name: string;
  likes: number;
  comments: number;
  views: number;
  score: number;
  last_interaction_at: string | null;
}

export const getOrganizationViewsTotal = async (
  supabase: SupabaseClient,
  organizationId: string,
  organizationType: 'universite' | 'centre_formation'
): Promise<OrganizationViewsStats> => {
  const { data: posts, error: postsError, count: totalPosts } = await supabase
    .from('posts')
    .select('id', { count: 'exact' })
    .eq('author_id', organizationId)
    .eq('author_type', organizationType);

  if (postsError) {
    throw new Error(`Failed to fetch organization posts: ${postsError.message}`);
  }

  const postIds = (posts || []).map((post: any) => post.id).filter(Boolean);

  if (postIds.length === 0) {
    return {
      organization_id: organizationId,
      organization_type: organizationType,
      total_posts: totalPosts || 0,
      total_views: 0,
    };
  }

  const { count: totalViews, error: viewsError } = await supabase
    .from('post_views')
    .select('id', { count: 'exact', head: true })
    .in('post_id', postIds);

  if (viewsError) {
    throw new Error(`Failed to fetch organization views: ${viewsError.message}`);
  }

  return {
    organization_id: organizationId,
    organization_type: organizationType,
    total_posts: totalPosts || postIds.length,
    total_views: totalViews || 0,
  };
};

const normalizeOrganizationType = (
  rawValue: string | null | undefined
): 'universite' | 'centre_formation' => {
  const normalized = String(rawValue || '').trim().toLowerCase();
  if (normalized.includes('univers')) return 'universite';
  return 'centre_formation';
};

const getRowTimestamp = (row: any): string | null => {
  return (
    row.date_comment ||
    row.date_view ||
    row.created_at ||
    row.date_created ||
    null
  );
};

export const getOrganizationTopFollowers = async (
  supabase: SupabaseClient,
  organizationId: string,
  organizationType: 'universite' | 'centre_formation',
  limit = 10
): Promise<TopFollowerInteraction[]> => {
  const { data: posts, error: postsError } = await supabase
    .from('posts')
    .select('id')
    .eq('author_id', organizationId)
    .eq('author_type', organizationType);

  if (postsError) {
    throw new Error(`Failed to fetch organization posts: ${postsError.message}`);
  }

  const postIds = (posts || []).map((post: any) => post.id).filter(Boolean);
  if (postIds.length === 0) {
    return [];
  }

  const followerTable =
    organizationType === 'universite'
      ? 'followers_universites'
      : 'followers_centres_formation';
  const followerColumn =
    organizationType === 'universite' ? 'universite_id' : 'centre_id';

  const { data: followersData, error: followersError } = await supabase
    .from(followerTable)
    .select('user_id')
    .eq(followerColumn, organizationId);

  if (followersError) {
    throw new Error(`Failed to fetch followers: ${followersError.message}`);
  }

  const followerIds = (followersData || []).map((row: any) => row.user_id).filter(Boolean);
  if (followerIds.length === 0) {
    return [];
  }

  const [likesResult, commentsResult, viewsResult] = await Promise.all([
    supabase
      .from('post_likes')
      .select('user_id, created_at')
      .in('post_id', postIds)
      .in('user_id', followerIds),
    supabase
      .from('post_comments')
      .select('user_id, date_comment, created_at')
      .in('post_id', postIds)
      .in('user_id', followerIds),
    supabase
      .from('post_views')
      .select('user_id, date_view, created_at')
      .in('post_id', postIds)
      .in('user_id', followerIds),
  ]);

  if (likesResult.error) {
    throw new Error(`Failed to fetch post likes: ${likesResult.error.message}`);
  }
  if (commentsResult.error) {
    throw new Error(`Failed to fetch post comments: ${commentsResult.error.message}`);
  }
  if (viewsResult.error) {
    throw new Error(`Failed to fetch post views: ${viewsResult.error.message}`);
  }

  const interactionMap = new Map<string, TopFollowerInteraction>();

  const addInteraction = (row: any, type: 'likes' | 'comments' | 'views') => {
    if (!row?.user_id) return;
    const userId = row.user_id;
    if (!followerIds.includes(userId)) return;

    const existing = interactionMap.get(userId) ?? {
      user_id: userId,
      display_name: userId,
      likes: 0,
      comments: 0,
      views: 0,
      score: 0,
      last_interaction_at: null,
    };

    if (type === 'likes') existing.likes += 1;
    if (type === 'comments') existing.comments += 1;
    if (type === 'views') existing.views += 1;

    existing.score = existing.comments * 5 + existing.likes * 3 + existing.views * 1;

    const timestamp = getRowTimestamp(row);
    if (timestamp) {
      if (!existing.last_interaction_at || new Date(timestamp) > new Date(existing.last_interaction_at)) {
        existing.last_interaction_at = timestamp;
      }
    }

    interactionMap.set(userId, existing);
  };

  (likesResult.data || []).forEach((row: any) => addInteraction(row, 'likes'));
  (commentsResult.data || []).forEach((row: any) => addInteraction(row, 'comments'));
  (viewsResult.data || []).forEach((row: any) => addInteraction(row, 'views'));

  if (interactionMap.size === 0) {
    return [];
  }

  const topUserIds = Array.from(interactionMap.keys());

  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('id, nom, prenom')
    .in('id', topUserIds);

  if (profilesError) {
    throw new Error(`Failed to fetch follower profiles: ${profilesError.message}`);
  }

  const profileMap = new Map<string, { nom?: string; prenom?: string }>();
  (profilesData || []).forEach((profile: any) => {
    profileMap.set(profile.id, {
      nom: profile.nom,
      prenom: profile.prenom,
    });
  });

  const result = Array.from(interactionMap.values())
    .map((item) => {
      const profile = profileMap.get(item.user_id);
      const displayName = profile
        ? `${profile.prenom || ''} ${profile.nom || ''}`.trim() || item.user_id
        : item.user_id;
      return {
        ...item,
        display_name: displayName,
      };
    })
    .sort((a, b) => b.score - a.score || new Date(b.last_interaction_at || '').getTime() - new Date(a.last_interaction_at || '').getTime())
    .slice(0, limit);

  return result;
};
