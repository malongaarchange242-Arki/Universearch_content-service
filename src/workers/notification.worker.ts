import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { Job, Worker } from 'bullmq';
import { NOTIFICATION_QUEUE, NotificationJobData } from '../queues/notification.queue';
import { redisConnection } from '../queues/videoProcessing.queue';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase worker credentials (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
}

const supabase = createClient<any>(supabaseUrl, serviceRoleKey);

const normalizeEntityType = (entityType: string) =>
  entityType === 'centre' || entityType === 'centre_formation'
    ? 'centre_formation'
    : 'universite';

const getFollowers = async (
  supabaseClient: any,
  entityId: string,
  entityType: string
): Promise<string[]> => {
  try {
    const normalizedType = normalizeEntityType(entityType);
    const tableName = normalizedType === 'universite'
      ? 'followers_universites'
      : 'followers_centres_formation';
    const columnName = normalizedType === 'universite' ? 'universite_id' : 'centre_id';

    const { data, error } = await supabaseClient
      .from(tableName)
      .select('user_id')
      .eq(columnName, entityId);

    if (error) {
      console.error(`Notification worker failed to fetch followers: ${error.message}`);
      return [];
    }

    return (data || []).map((row: any) => row.user_id);
  } catch (error) {
    console.error('Notification worker error fetching followers:', error);
    return [];
  }
};

const getEntityInfo = async (
  supabaseClient: any,
  entityId: string,
  entityType: string
) => {
  try {
    const normalizedType = normalizeEntityType(entityType);
    const tableName = normalizedType === 'universite' ? 'universites' : 'centres_formation';

    const { data } = await supabaseClient
      .from(tableName)
      .select('id, nom, sigle, logo_url, description')
      .eq('id', entityId)
      .single();

    if (!data) return null;

    return {
      id: data.id,
      name: data.nom,
      sigle: data.sigle,
      logo_url: data.logo_url,
      description: data.description,
      type: normalizedType,
    };
  } catch (error) {
    console.error('Notification worker error fetching entity info:', error);
    return null;
  }
};

const resolveAuthorEntity = async (
  supabaseClient: any,
  authorId: string,
  authorType: string
) => {
  const normalizedType = normalizeEntityType(authorType);
  const tableName = normalizedType === 'universite' ? 'universites' : 'centres_formation';

  try {
    const { data, error } = await supabaseClient
      .from(tableName)
      .select('id, nom, sigle, logo_url, description, profile_id')
      .eq('profile_id', authorId)
      .maybeSingle();

    if (error) {
      console.error('Notification worker error resolving author entity by profile_id:', error);
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
  } catch (error) {
    console.error('Notification worker error resolving author entity:', error);
  }

  return getEntityInfo(supabaseClient, authorId, normalizedType);
};

const notifyFollowers = async (
  followerIds: string[],
  post: any,
  entityInfo: any | null
) => {
  if (followerIds.length === 0) return;

  try {
    const notificationServiceUrl =
      process.env.NOTIFICATION_SERVICE_URL || 'https://universearch-notification-service.onrender.com';
    const organizationName = entityInfo?.name || entityInfo?.sigle || post.author_id;
    const organizationDisplayName =
      entityInfo?.sigle?.trim() || entityInfo?.name?.trim() || organizationName;
    const organizationId = entityInfo?.id || post.author_id;
    const organizationType = entityInfo?.type || normalizeEntityType(post.author_type);

    const response = await axios.post(
      `${notificationServiceUrl}/api/notifications/broadcast`,
      {
        user_ids: followerIds,
        type: 'post',
        title: 'Nouveau post',
        message: `${organizationDisplayName} a publie un nouveau post.`,
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
      },
      {
        timeout: 20000,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const broadcastResponse = response.data as { count?: number; errors?: unknown[] };
    const deliveredCount = typeof broadcastResponse?.count === 'number'
      ? broadcastResponse.count
      : followerIds.length;

    const errors = Array.isArray(broadcastResponse?.errors)
      ? broadcastResponse.errors
      : [];

    if (errors.length > 0) {
      console.warn('Notification worker completed with partial errors:', errors);
    }

    console.log(`Notifications queued for ${deliveredCount}/${followerIds.length} followers`);
  } catch (error) {
    console.error('Notification worker error notifying followers:', error);
    throw error;
  }
};

const processNotificationJob = async (job: Job<NotificationJobData, void>) => {
  console.log(`Processing notification job ${job.id} for post ${job.data.postId}`);

  const { data: postData, error: postError } = await supabase
    .from('posts')
    .select(
      'id, author_id, author_type, titre, description, media_url, thumbnail_url, media_type, media_processing_status, media_processing_error, statut, date_creation'
    )
    .eq('id', job.data.postId)
    .single();

  if (postError || !postData) {
    throw new Error(`Notification worker failed to fetch post: ${postError?.message || 'no post found'}`);
  }

  const entityInfo = await resolveAuthorEntity(supabase, job.data.authorId, job.data.authorType);
  const followerIds = await getFollowers(
    supabase,
    entityInfo?.id || job.data.authorId,
    job.data.authorType
  );

  await notifyFollowers(followerIds, postData, entityInfo);
};

const defaultConcurrency = Number(process.env.NOTIFICATION_WORKER_CONCURRENCY || 2);

const worker = new Worker<NotificationJobData, void>(
  NOTIFICATION_QUEUE,
  processNotificationJob,
  {
    connection: redisConnection,
    concurrency: defaultConcurrency,
  }
);

worker.on('completed', (job) => {
  console.log(`Notification job completed: ${job.id}`);
});

worker.on('failed', (job, error) => {
  console.error(`Notification job failed: ${job?.id || 'unknown'}`, error);
});

const shutdown = async () => {
  await worker.close();
  await redisConnection.quit();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log(`Notification worker started for queue "${NOTIFICATION_QUEUE}" with concurrency ${defaultConcurrency}`);
