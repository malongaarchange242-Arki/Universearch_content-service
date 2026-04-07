// src/modules/posts/posts.service.ts

import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import axios from 'axios';

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

interface AuthorEntityInfo {
  id: string;
  name: string;
  sigle?: string | null;
  logo_url?: string | null;
  description?: string | null;
  type: 'universite' | 'centre_formation';
}

const normalizeEntityType = (
  entityType: string
): 'universite' | 'centre_formation' =>
  entityType === 'universite' ? 'universite' : 'centre_formation';

/**
 * RÃ©cupÃ©rer les followers d'une universitÃ© ou centre
 */
const getFollowers = async (
  supabase: SupabaseClient,
  entityId: string,
  entityType: string
): Promise<string[]> => {
  try {
    const normalizedType = normalizeEntityType(entityType);
    const tableName = normalizedType === 'universite'
      ? 'followers_universites' 
      : 'followers_centres_formation';
    
    const columnName = normalizedType === 'universite'
      ? 'universite_id' 
      : 'centre_id';

    const { data, error } = await supabase
      .from(tableName)
      .select('user_id')
      .eq(columnName, entityId);

    if (error) {
      console.error(`Failed to get followers: ${error.message}`);
      return [];
    }

    return (data || []).map((row: any) => row.user_id);
  } catch (err) {
    console.error('Error fetching followers:', err);
    return [];
  }
};

/**
 * Envoyer une notification Ã  chaque follower
 */
const notifyFollowers = async (
  followerIds: string[],
  post: PostResponse,
  entityInfo?: AuthorEntityInfo | null
): Promise<void> => {
  if (followerIds.length === 0) return;

  try {
    const notificationServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4000';
    const organizationName = entityInfo?.name || entityInfo?.sigle || post.author_id;
    const organizationId = entityInfo?.id || post.author_id;
    const organizationType = entityInfo?.type || normalizeEntityType(post.author_type);
    const notificationMessage = `${organizationName} a publié : "${post.titre}"`;

    const promises = followerIds.map((userId) =>
      axios.post(`${notificationServiceUrl}/api/notifications`, {
        user_id: userId,
        type: 'post',
        title: 'Nouveau post',
        message: notificationMessage,
        delivery_types: ['in_app', 'push'],
        data: {
          post_id: post.id,
          author_id: organizationId,
          author_type: organizationType,
          institution_id: organizationId,
          institution_name: organizationName,
          institution_logo_url: entityInfo?.logo_url || null,
          institution_description: entityInfo?.description || null,
          titre: post.titre,
          description: post.description,
        },
      }).catch((err) => {
        console.error(`Failed to send notification to user ${userId}:`, err.message);
      })
    );

    await Promise.all(promises);
    console.log(`Notifications sent to ${followerIds.length} followers`);
  } catch (err) {
    console.error('Error notifying followers:', err);
  }
};

/**
 * RÃ©cupÃ©rer les info de l'entitÃ© (universitÃ© ou centre)
 */
const getEntityInfo = async (
  supabase: SupabaseClient,
  entityId: string,
  entityType: string
): Promise<AuthorEntityInfo | null> => {
  try {
    const normalizedType = normalizeEntityType(entityType);
    const tableName = normalizedType === 'universite' ? 'universites' : 'centres_formation';

    const { data } = await supabase
      .from(tableName)
      .select('id, nom, sigle, logo_url, description')
      .eq('id', entityId)
      .single();

    if (!data) {
      return null;
    }

    return {
      id: data.id,
      name: data.nom,
      sigle: data.sigle,
      logo_url: data.logo_url,
      description: data.description,
      type: normalizedType,
    };
  } catch (err) {
    console.error('Error fetching entity info:', err);
    return null;
  }
};

const resolveAuthorEntity = async (
  supabase: SupabaseClient,
  authorId: string,
  authorType: string
): Promise<AuthorEntityInfo | null> => {
  const normalizedType = normalizeEntityType(authorType);
  const tableName = normalizedType === 'universite' ? 'universites' : 'centres_formation';

  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('id, nom, sigle, logo_url, description, profile_id')
      .eq('profile_id', authorId)
      .maybeSingle();

    if (error) {
      console.error('Error resolving author entity by profile_id:', error);
    }

    if (data) {
      return {
        id: data.id,
        name: data.nom,
        sigle: data.sigle,
        logo_url: data.logo_url,
        description: data.description,
        type: normalizedType,
      };
    }
  } catch (err) {
    console.error('Error resolving author entity:', err);
  }

  return getEntityInfo(supabase, authorId, normalizedType);
};

/**
 * CrÃ©er un post
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

  const createdPost = data as PostResponse;

  // ðŸ”” Envoyer des notifications aux followers (asynchrone, ne pas attendre)
  try {
    const authorEntity = await resolveAuthorEntity(supabase, authorId, authorType);
    const followers = await getFollowers(
      supabase,
      authorEntity?.id || authorId,
      authorType
    );
    if (followers.length > 0) {
      // Lancer de maniÃ¨re asynchrone pour ne pas bloquer la rÃ©ponse
      notifyFollowers(followers, createdPost, authorEntity).catch((err) => {
        console.error('Notification broadcast failed:', err);
      });
    }
  } catch (err) {
    console.error('Error in notification flow:', err);
    // Continue mÃªme si les notifications Ã©chouent
  }

  return createdPost;
};

/**
 * Lister les posts (rÃ©cupÃ©ration publique)
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

  const posts = (data || []) as PostResponse[];

  // Enrich posts with likes/comments/shares counts using service role to bypass RLS
  const enrichedPosts = await Promise.all(
    posts.map(async (post) => {
      // Use service role client for counting to bypass RLS policies
      const supabaseService = process.env.SUPABASE_SERVICE_ROLE_KEY
        ? createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
        : supabase;

      const { count: likesCount } = await supabaseService
        .from('post_likes')
        .select('id', { count: 'exact' })
        .eq('post_id', post.id);

      const { count: commentsCount } = await supabaseService
        .from('post_comments')
        .select('id', { count: 'exact' })
        .eq('post_id', post.id);

      const { count: sharesCount } = await supabaseService
        .from('post_shares')
        .select('id', { count: 'exact' })
        .eq('post_id', post.id);

      return {
        ...post,
        likes_count: likesCount || 0,
        comments_count: commentsCount || 0,
        shares_count: sharesCount || 0,
      } as PostResponse;
    })
  );

  return enrichedPosts;
};

/**
 * Lister les posts par entitÃ© (universitÃ© ou centre)
 */
export const listPostsByEntity = async (
  supabase: SupabaseClient,
  entityId: string,
  entityType: 'universite' | 'centre',
  limit = 10
): Promise<PostResponse[]> => {
  // Build query to get posts by entity
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('author_id', entityId)
    .eq('author_type', entityType === 'universite' ? 'universite' : 'centre_formation')
    .eq('statut', 'PUBLISHED')
    .order('date_creation', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list posts by entity: ${error.message}`);
  }

  // Enrich posts with likes and comments counts
  const enrichedPosts = await Promise.all(
    (data || []).map(async (post) => {
      const { count: likesCount } = await supabase
        .from('post_likes')
        .select('id', { count: 'exact' })
        .eq('post_id', post.id);

      const { count: commentsCount } = await supabase
        .from('post_comments')
        .select('id', { count: 'exact' })
        .eq('post_id', post.id);

      const { count: sharesCount } = await supabase
        .from('post_shares')
        .select('id', { count: 'exact' })
        .eq('post_id', post.id);

      return {
        ...post,
        likes_count: likesCount || 0,
        comments_count: commentsCount || 0,
        shares_count: sharesCount || 0,
      } as PostResponse;
    })
  );

  return enrichedPosts;
};

/**
 * CrÃ©er un commentaire pour un post
 */
export const createComment = async (
  supabase: SupabaseClient,
  userId: string,
  postId: string,
  contenu: string,
  parentCommentId?: string | null
): Promise<any> => {
  const commentId = randomUUID();
  const now = new Date().toISOString();

  const insertObj: any = {
    id: commentId,
    post_id: postId,
    user_id: userId,
    contenu: contenu,
    date_comment: now,
  };

  if (parentCommentId) {
    insertObj.parent_comment_id = parentCommentId;
  }

  const { data, error } = await supabase
    .from('post_comments')
    .insert(insertObj)
    .select()
    .single();

  if (error) {
    // If parent_comment_id column doesn't exist, try without it
    if (parentCommentId && error.message.includes('parent_comment_id')) {
      const fallbackObj = {
        id: commentId,
        post_id: postId,
        user_id: userId,
        contenu: contenu,
        date_comment: now,
      };

      const { data: fallbackData, error: fallbackError } = await supabase
        .from('post_comments')
        .insert(fallbackObj)
        .select()
        .single();

      if (fallbackError) {
        throw new Error(`Failed to create comment: ${fallbackError.message}`);
      }

      return { ...fallbackData, parent_comment_id: null };
    }
    throw new Error(`Failed to create comment: ${error.message}`);
  }

  return data;
};

/**
 * Lister les commentaires d'un post (public)
 */
export const listComments = async (
  supabase: SupabaseClient,
  postId: string,
  limit = 50
): Promise<any[]> => {
  // First, get comments with user info
  const { data: commentsData, error } = await supabase
    .from('post_comments')
    .select(`
      id,
      post_id,
      user_id,
      contenu,
      date_comment,
      parent_comment_id
    `)
    .eq('post_id', postId)
    .order('date_comment', { ascending: false })
    .limit(limit);

  if (error) {
    // If parent_comment_id column doesn't exist yet, try without it
    if (error.message.includes('parent_comment_id')) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('post_comments')
        .select(`
          id,
          post_id,
          user_id,
          contenu,
          date_comment
        `)
        .eq('post_id', postId)
        .order('date_comment', { ascending: false })
        .limit(limit);

      if (fallbackError) {
        throw new Error(`Failed to list comments: ${fallbackError.message}`);
      }

      // Add null parent_comment_id for compatibility
      const commentsWithUsers = await enrichCommentsWithUsers(supabase, fallbackData || []);
      return commentsWithUsers.map(c => ({ ...c, parent_comment_id: null })) as any[];
    }
    throw new Error(`Failed to list comments: ${error.message}`);
  }

  // Enrich comments with user information
  const commentsWithUsers = await enrichCommentsWithUsers(supabase, commentsData || []);
  return commentsWithUsers.map((comment: any) => ({
    ...comment,
    commentaire: comment.commentaire ?? comment.contenu,
    created_at: comment.created_at ?? comment.date_comment,
  })) as any[];
};

export const listViewerScopedComments = async (
  supabase: SupabaseClient,
  postId: string,
  viewerUserId: string,
  limit = 50
): Promise<any[]> => {
  const { data: ownComments, error: ownCommentsError } = await supabase
    .from('post_comments')
    .select(`
      id,
      post_id,
      user_id,
      contenu,
      date_comment,
      parent_comment_id
    `)
    .eq('post_id', postId)
    .eq('user_id', viewerUserId)
    .order('date_comment', { ascending: true })
    .limit(limit);

  if (ownCommentsError) {
    throw new Error(`Failed to list viewer comments: ${ownCommentsError.message}`);
  }

  const ownCommentList = ownComments || [];
  if (ownCommentList.length === 0) {
    return [];
  }

  const ownCommentIds = ownCommentList.map((comment: any) => comment.id);
  let replyRows: any[] = [];

  try {
    const { data: replies, error: repliesError } = await supabase
      .from('post_comments')
      .select(`
        id,
        post_id,
        user_id,
        contenu,
        date_comment,
        parent_comment_id
      `)
      .eq('post_id', postId)
      .in('parent_comment_id', ownCommentIds)
      .order('date_comment', { ascending: true })
      .limit(limit);

    if (repliesError) {
      throw repliesError;
    }

    replyRows = replies || [];
  } catch (error) {
    // Older schemas may not have parent_comment_id yet.
    if (!(error as Error).message.includes('parent_comment_id')) {
      throw new Error(`Failed to list viewer replies: ${(error as Error).message}`);
    }
  }

  const enrichedOwnComments = await enrichCommentsWithUsers(
    supabase,
    ownCommentList
  );
  const enrichedReplies = await enrichCommentsWithUsers(supabase, replyRows);

  const organizationReplies = enrichedReplies.filter(
    (comment: any) =>
      comment.parent_comment_id &&
      ownCommentIds.includes(comment.parent_comment_id) &&
      ['university', 'center', 'centre', 'centre_formation'].includes(
        comment.user?.type
      )
  );

  const merged = [...enrichedOwnComments, ...organizationReplies].sort(
    (a: any, b: any) =>
      new Date(a.date_comment || a.created_at || 0).getTime() -
      new Date(b.date_comment || b.created_at || 0).getTime()
  );

  return merged.map((comment: any) => ({
    ...comment,
    commentaire: comment.commentaire ?? comment.contenu,
    created_at: comment.created_at ?? comment.date_comment,
  })) as any[];
};

/**
 * Enrich comments with user information (university or center)
 */
const enrichCommentsWithUsers = async (supabase: SupabaseClient, comments: any[]): Promise<any[]> => {
  if (!comments || comments.length === 0) return [];

  const userIds = comments.map(c => c.user_id);
  const { data: universities, error: uniError } = await supabase
    .from('universites')
    .select('id, nom, sigle')
    .in('id', userIds);

  const { data: centers, error: centerError } = await supabase
    .from('centres_formation')
    .select('id, nom, sigle')
    .in('id', userIds);

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, nom, prenom, profile_type')
    .in('id', userIds);

  if (uniError) {
    console.error('Universities query error:', uniError);
  }

  if (centerError) {
    console.error('Centers query error:', centerError);
  }

  if (profileError) {
    console.error('Profiles query error:', profileError);
  }

  const userMap = new Map<string, { name: string; sigle?: string; type: string }>();

  (universities || []).forEach(u => {
    userMap.set(u.id, { name: u.nom, sigle: u.sigle, type: 'university' });
  });

  (centers || []).forEach(c => {
    userMap.set(c.id, { name: c.nom, sigle: c.sigle, type: 'center' });
  });

  (profiles || []).forEach((profile: any) => {
    if (userMap.has(profile.id)) {
      return;
    }

    const fullName = [profile.prenom, profile.nom]
      .filter((value) => value && String(value).trim().length > 0)
      .join(' ')
      .trim();

    userMap.set(profile.id, {
      name: fullName || profile.nom || profile.email || 'Utilisateur',
      type: profile.profile_type === 'utilisateur' ? 'user' : profile.profile_type || 'user',
    });
  });

  return comments.map(comment => {
    const userInfo = userMap.get(comment.user_id);
    return {
      ...comment,
      user: userInfo ? {
        name: userInfo.name,
        sigle: userInfo.sigle,
        type: userInfo.type
      } : null
    };
  });
};

/**
 * RÃ©cupÃ©rer un post par ID
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

  // RÃ©cupÃ©rer les compteurs (si ces tables existent)
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
 * Mettre Ã  jour un post
 */
export const updatePost = async (
  supabase: SupabaseClient,
  postId: string,
  authorId: string,
  payload: UpdatePostPayload
): Promise<PostResponse> => {
  // VÃ©rifier que l'auteur du post est bien l'auteur connectÃ©
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
  // VÃ©rifier que l'auteur du post est bien l'auteur connectÃ©
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

