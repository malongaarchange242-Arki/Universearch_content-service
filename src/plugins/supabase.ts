// src/plugins/supabase.ts

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import FastifyPlugin from 'fastify-plugin';

const supabasePlugin = FastifyPlugin(async (app, _options) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  app.decorate('supabase', supabase);
});

export default supabasePlugin;

// Extend FastifyInstance type
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SUPABASE_URL: string;
      SUPABASE_ANON_KEY: string;
      SUPABASE_SERVICE_ROLE_KEY: string;
    }
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    supabase: SupabaseClient;
  }
}
