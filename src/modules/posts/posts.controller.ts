// src/modules/posts/posts.controller.ts

import { FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import * as PostsService from './posts.service';

/**
 * Créer un post
 */
export const createPost = async (
  request: FastifyRequest<{ Body: PostsService.CreatePostPayload }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const user = (request.user as any);
    const supabase = (request.server as any).supabase;

    // Log attempt
    request.log.info({ msg: 'Create post attempt', userId: user?.id, role: user?.role });

    // Sanitize client body: do NOT trust author_id / author_type from client
    const body: any = request.body || {};
    const titre = body.titre || body.title || '';
    const description = body.description || body.content || body.desc || null;
    const media_url = body.media_url || body.mediaUrl || null;
    const media_type = body.media_type || body.mediaType || null;

    const payload: PostsService.CreatePostPayload = {
      titre: titre,
      description: description,
      media_url: media_url,
      media_type: media_type,
    };

    const post = await PostsService.createPost(
      supabase,
      user.id,
      user.role,
      payload
    );

    // Response already contains server-authoritative fields
    reply.status(201).send({ success: true, data: post });
  } catch (error) {
    request.log.error(error);
    reply.status(400).send({
      success: false,
      error: (error as Error).message,
    });
  }
};

/**
 * Upload a file server-side to Supabase Storage and return its public URL
 * Expects multipart/form-data with field `file`.
 */
export const uploadFile = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    const supabaseDefault = (request.server as any).supabase;

    // Debug: log incoming upload headers for troubleshooting
    request.log.info({ msg: 'Incoming upload request', headers: request.headers });

    const contentType = (request.headers['content-type'] || request.headers['Content-Type'] || '').toString();
    if (!contentType || !contentType.includes('multipart/form-data')) {
      request.log.warn({ msg: 'Upload rejected: invalid content-type', contentType });
      return reply.status(400).send({ success: false, error: 'Invalid Content-Type: expected multipart/form-data' });
    }

    // Use service role key if available for server-side uploads
    const supabaseUrl = process.env.SUPABASE_URL as string;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
    const supabase = serviceKey ? createClient(supabaseUrl, serviceKey) : supabaseDefault;

    // fastify-multipart exposes file via request.file()
    const mp: any = request as any;
    const file = await mp.file().catch((e: any) => {
      request.log.error({ msg: 'Failed to read multipart file', error: e });
      return null;
    });

    if (!file) {
      request.log.warn({ msg: 'No file part found in multipart payload, checking body fallback' });
      const bodyAny: any = (request as any).body || {};
      // If client sent a JSON body with base64 content or attachFieldsToBody placed a file-like object
      if (bodyAny && bodyAny.file) {
        request.log.info({ msg: 'Found file in request.body, attempting to handle fallback', bodyKeys: Object.keys(bodyAny) });
        const candidate = bodyAny.file;
        // 1) If client sent base64 string + filename
        if (typeof candidate === 'string' && bodyAny.filename) {
          const buf = Buffer.from(candidate, 'base64');
          (request as any).__fallbackFile = {
            toBuffer: async () => buf,
            filename: bodyAny.filename,
            mimetype: bodyAny.contentType || bodyAny.content_type || 'application/octet-stream',
          };
        } else if (Buffer.isBuffer(candidate)) {
          // 2) Direct Buffer
          request.log.info({ msg: 'request.body.file is a Buffer' });
          (request as any).__fallbackFile = {
            toBuffer: async () => candidate,
            filename: bodyAny.filename || `upload_${Date.now()}`,
            mimetype: bodyAny.contentType || 'application/octet-stream',
          };
        } else if (candidate && typeof candidate === 'object') {
          // 3) Object shape (fastify attachFieldsToBody sometimes places file-like object)
          const keys = Object.keys(candidate);
          request.log.info({ msg: 'request.body.file keys', keys });
          // Common buffers may be under ._buf, .buffer, .data or as Uint8Array
          const maybeBuf = (candidate as any)._buf || (candidate as any).buffer || (candidate as any).data || null;
          if (maybeBuf && (Buffer.isBuffer(maybeBuf) || maybeBuf instanceof Uint8Array)) {
            const buf = Buffer.isBuffer(maybeBuf) ? maybeBuf : Buffer.from(maybeBuf);
            (request as any).__fallbackFile = {
              toBuffer: async () => buf,
              filename: bodyAny.filename || (candidate as any).filename || `upload_${Date.now()}`,
              mimetype: bodyAny.contentType || (candidate as any).mimetype || 'application/octet-stream',
            };
          }
        }
      }

      const fallbackFile = (request as any).__fallbackFile || null;
      if (!fallbackFile) {
        return reply.status(400).send({ success: false, error: 'No file provided in multipart/form-data (field name: file)' });
      }

      // use fallbackFile as file
      (mp as any)._file = fallbackFile;
      // normalize for logging
      request.log.info({ msg: 'Using fallback file', filename: fallbackFile.filename, mimetype: fallbackFile.mimetype });
      // set file variable to fallback
      (mp as any).file = async () => fallbackFile;
    }
    let fileResolved = await mp.file().catch((e: any) => {
      request.log.error({ msg: 'Error while resolving file', error: e });
      return null;
    });

    // If mp.file() didn't return a file, try iterating parts to diagnose and recover
    if (!fileResolved) {
      try {
        request.log.info({ msg: 'mp.file() returned null — iterating mp.parts() to find file parts' });
        const parts = mp.parts ? mp.parts() : null;
        if (parts) {
          for await (const part of parts) {
            request.log.info({ msg: 'Found multipart part', field: part.fieldname, filename: part.filename, mime: part.mimetype });
            // If this part looks like a file, buffer it and use as resolved file
            if (part && (part.filename || part.mimetype)) {
              const buf = await part.toBuffer().catch((e: any) => {
                request.log.error({ msg: 'Failed to buffer part', error: e });
                return null;
              });
              if (buf) {
                fileResolved = {
                  toBuffer: async () => buf,
                  filename: part.filename || 'upload.bin',
                  mimetype: part.mimetype || 'application/octet-stream',
                } as any;
                request.log.info({ msg: 'Recovered file from parts()', filename: fileResolved.filename, mimetype: fileResolved.mimetype });
                break;
              }
            }
          }
        } else {
          request.log.info({ msg: 'mp.parts() not available on this multipart instance' });
        }
      } catch (e) {
        request.log.error({ msg: 'Error while iterating multipart parts', error: e });
      }
    }

    const buffer = await (fileResolved ? fileResolved.toBuffer().catch((e: any) => {
      request.log.error({ msg: 'Failed to buffer uploaded file', error: e });
      return null;
    }) : null);

    if (!buffer) {
      return reply.status(500).send({ success: false, error: 'Failed to read uploaded file content' });
    }

    const resolvedFile = fileResolved;

    request.log.info({ msg: 'Received file metadata', filename: resolvedFile.filename || resolvedFile.name, mimetype: resolvedFile.mimetype || resolvedFile.type });
    const isVideo = (resolvedFile.mimetype || resolvedFile.type || '').toString().startsWith('video/');
    const bucket = isVideo ? 'videos' : 'images';
    const ext = (resolvedFile.filename || resolvedFile.name || 'bin').split('.').pop() || 'bin';
    const uuid = randomUUID();
    const filePath = `posts/${uuid}.${ext}`;

    const { data: uploadData, error: uploadError } = await supabase.storage.from(bucket).upload(filePath, buffer, { contentType: resolvedFile.mimetype || resolvedFile.type, upsert: false });
    if (uploadError) {
      request.log.error({ msg: 'Upload error', error: uploadError });
      return reply.status(500).send({ success: false, error: uploadError.message || 'Storage upload failed' });
    }

    const { data: publicData, error: publicError } = await supabase.storage.from(bucket).getPublicUrl(filePath);
    if (publicError) {
      request.log.error({ msg: 'getPublicUrl error', error: publicError });
      return reply.status(500).send({ success: false, error: publicError.message || 'Failed to obtain public URL' });
    }

    const publicUrl = publicData?.publicUrl || publicData?.publicURL || publicData?.public_url || null;
    if (!publicUrl) {
      request.log.error({ msg: 'Public URL missing after getPublicUrl', publicData });
      return reply.status(500).send({ success: false, error: 'Failed to obtain public URL' });
    }

    request.log.info({ msg: 'Upload completed', url: publicUrl, bucket, path: filePath });

    reply.code(201).send({ success: true, url: publicUrl, bucket, path: filePath });
  } catch (error) {
    request.log.error(error);
    reply.status(400).send({ success: false, error: (error as Error).message });
  }
};

/**
 * Lister les posts (public)
 */
export const listPosts = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    const supabase = (request.server as any).supabase;
    const user = (request.user as any) || null;

    // Check for query parameters: entity_id, entity_type, limit
    const query = request.query as any;
    const entityId = query?.entity_id;
    const entityType = query?.entity_type;
    const limit = query?.limit ? parseInt(query.limit, 10) : 100;

    // If entity_id and entity_type are provided, filter by entity
    if (entityId && entityType) {
      const posts = await PostsService.listPostsByEntity(
        supabase,
        entityId,
        entityType === 'universite' ? 'universite' : 'centre',
        limit
      );
      reply.send({ success: true, data: posts });
      return;
    }

    // Apply strict organisation-scoped filter:
    // - If user.role === 'universite' => filter author_type='universite' and author_id=user.id
    // - If user.role === 'centre_formation' => filter author_type='centre_formation' and author_id=user.id
    // - Otherwise (admin, public, etc.) => no filter (see all posts)
    let filter: any = undefined;
    try {
      const role = (user && user.role) ? user.role.toString().toLowerCase() : '';
      if (role === 'universite') {
        filter = { author_type: 'universite', author_id: user.id };
      } else if (role === 'centre_formation') {
        filter = { author_type: 'centre_formation', author_id: user.id };
      }
    } catch (e) {
      request.log.warn({ msg: 'Could not determine user role for post filtering', error: e });
    }

    const posts = await PostsService.listPosts(supabase, limit, filter);
    reply.send({ success: true, data: posts });
  } catch (error) {
    request.log.error(error);
    reply.status(500).send({ success: false, error: (error as Error).message });
  }
};

/**
 * Récupérer un post
 */
export const getPost = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const supabase = (request.server as any).supabase;

    const post = await PostsService.getPost(supabase, request.params.id);

    reply.send({
      success: true,
      data: post,
    });
  } catch (error) {
    request.log.error(error);
    reply.status(404).send({
      success: false,
      error: (error as Error).message,
    });
  }
};

/**
 * Mettre à jour un post
 */
export const updatePost = async (
  request: FastifyRequest<{ Params: { id: string }; Body: PostsService.UpdatePostPayload }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const user = (request.user as any);
    const supabase = (request.server as any).supabase;

    const post = await PostsService.updatePost(
      supabase,
      request.params.id,
      user.id,
      request.body
    );

    reply.send({
      success: true,
      data: post,
    });
  } catch (error) {
    request.log.error(error);
    const statusCode = (error as Error).message.includes('Unauthorized') ? 403 : 400;
    reply.status(statusCode).send({
      success: false,
      error: (error as Error).message,
    });
  }
};

/**
 * Supprimer un post
 */
export const deletePost = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const user = (request.user as any);
    const supabase = (request.server as any).supabase;

    await PostsService.deletePost(supabase, request.params.id, user.id);

    reply.send({
      success: true,
      message: 'Post deleted successfully',
    });
  } catch (error) {
    request.log.error(error);
    const statusCode = (error as Error).message.includes('Unauthorized') ? 403 : 400;
    reply.status(statusCode).send({
      success: false,
      error: (error as Error).message,
    });
  }
};

/**
 * Créer un commentaire sur un post
 * POST /posts/:id/comments
 */
export const createSignedUrl = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    const supabaseDefault = (request.server as any).supabase;
    const supabaseUrl = process.env.SUPABASE_URL as string;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
    const supabase = serviceKey ? createClient(supabaseUrl, serviceKey) : supabaseDefault;

    const bodyAny: any = (request.body as any) || {};
    const bucket = (bodyAny.bucket || 'videos').toString();
    const path = bodyAny.path || bodyAny.filePath || bodyAny.key;
    const expires = Number(bodyAny.expires || 60);

    if (!path) return reply.status(400).send({ success: false, error: 'Missing path parameter' });

    request.log.info({ msg: 'Creating signed URL', bucket, path, expires });

    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expires);
    if (error) {
      request.log.error({ msg: 'createSignedUrl error', error });
      return reply.status(500).send({ success: false, error: error.message || 'Failed to create signed URL' });
    }

    return reply.send({ success: true, signedUrl: data?.signedUrl });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({ success: false, error: (err as Error).message });
  }
};

// --- new handlers below ---

export const createComment = async (
  request: FastifyRequest<{ Params: { id: string }; Body: { contenu: string; parent_comment_id?: string } }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const user = (request.user as any);
    const supabase = (request.server as any).supabase;
    const contenu = (request.body as any)?.contenu || '';
    const parentCommentId = (request.body as any)?.parent_comment_id || null;

    if (!contenu || typeof contenu !== 'string') {
      return reply.status(400).send({ success: false, error: 'contenu is required' });
    }

    const comment = await PostsService.createComment(supabase, user.id, request.params.id, contenu, parentCommentId);
    reply.status(201).send({ success: true, data: comment });
  } catch (error) {
    request.log.error(error);
    reply.status(400).send({ success: false, error: (error as Error).message });
  }
};

/**
 * List comments for a post (public)
 * GET /posts/:id/comments
 */
export const listComments = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const supabase = (request.server as any).supabase;
    const limit = Number((request.query as any)?.limit || 50);

    const comments = await PostsService.listComments(supabase, request.params.id, limit);
    reply.send({ success: true, data: comments });
  } catch (error) {
    request.log.error(error);
    reply.status(500).send({ success: false, error: (error as Error).message });
  }
};

/**
 * Lister les posts par entité (université ou centre)
 * Query params: entity_id, entity_type, limit
 */
export const listPostsByEntity = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    const supabase = (request.server as any).supabase;
    const query = request.query as any;

    const entityId = query?.entity_id;
    const entityType = query?.entity_type;
    const limit = query?.limit ? parseInt(query.limit, 10) : 10;

    if (!entityId || !entityType) {
      return reply.status(400).send({
        success: false,
        error: 'Missing required query parameters: entity_id, entity_type',
      });
    }

    const posts = await PostsService.listPostsByEntity(
      supabase,
      entityId,
      entityType === 'universite' ? 'universite' : 'centre',
      limit
    );

    reply.send({ success: true, data: posts });
  } catch (error) {
    request.log.error(error);
    reply.status(500).send({ success: false, error: (error as Error).message });
  }
};
