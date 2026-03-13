// src/modules/posts/posts.service.ts

import { SupabaseClient, createClient } from '@supabase/supabase-js';
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
 * Lister les posts par entité (université ou centre)
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
 * Créer un commentaire pour un post
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
  return commentsWithUsers as any[];
};

/**
 * Enrich comments with user information (university or center)
 */
const enrichCommentsWithUsers = async (supabase: SupabaseClient, comments: any[]): Promise<any[]> => {
  if (!comments || comments.length === 0) return [];

  const userIds = comments.map(c => c.user_id);
  console.log('Enriching comments for user IDs:', userIds);

  // Get universities
  const { data: universities, error: uniError } = await supabase
    .from('universites')
    .select('id, nom, sigle')
    .in('id', userIds);

  if (uniError) console.log('Universities query error:', uniError);

  // Get centers
  const { data: centers, error: centerError } = await supabase
    .from('centres_formation')
    .select('id, nom, sigle')
    .in('id', userIds);

  if (centerError) console.log('Centers query error:', centerError);

  // Get regular users
  const { data: users, error: userError } = await supabase
    .from('utilisateurs')
    .select('id, nom, prenom')
    .in('id', userIds);

  if (userError) console.log('Users query error:', userError);

  const userMap = new Map();

  // Add universities to map
  (universities || []).forEach(u => {
    userMap.set(u.id, { name: u.nom, sigle: u.sigle, type: 'university' });
    console.log('Added university:', u.id, u.nom);
  });

  // Add centers to map
  (centers || []).forEach(c => {
    userMap.set(c.id, { name: c.nom, sigle: c.sigle, type: 'center' });
    console.log('Added center:', c.id, c.nom);
  });

  // Add regular users to map
  (users || []).forEach(u => {
    const fullName = `${u.prenom} ${u.nom}`.trim();
    userMap.set(u.id, { name: fullName, type: 'user' });
    console.log('Added user:', u.id, fullName);
  });

  console.log('User map size:', userMap.size);

  // Enrich comments with user info
  return comments.map(comment => {
    const userInfo = userMap.get(comment.user_id);
    console.log('Comment', comment.id, 'user_id:', comment.user_id, 'userInfo:', userInfo);
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
