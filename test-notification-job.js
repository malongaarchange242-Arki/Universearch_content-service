// Test script to add a notification job directly
import 'dotenv/config';
import { addNotificationJob } from './dist/queues/notification.queue.js';

async function testNotificationJob() {
  try {
    console.log('Adding test notification job...');

    // Use a real post ID from your database, or create one first
    const job = await addNotificationJob({
      postId: 'test-post-id', // Replace with real post ID
      authorId: 'test-author-id', // Replace with real author ID
      authorType: 'universite', // or 'centre_formation'
    });

    console.log('✅ Job added successfully:', job.id);
  } catch (error) {
    console.error('❌ Failed to add job:', error);
  }
}

testNotificationJob();