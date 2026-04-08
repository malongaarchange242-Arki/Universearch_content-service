// src/modules/stats/stats.service.ts

import { SupabaseClient } from '@supabase/supabase-js';

export interface OrganizationViewsStats {
  organization_id: string;
  organization_type: 'universite' | 'centre_formation';
  total_posts: number;
  total_views: number;
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
