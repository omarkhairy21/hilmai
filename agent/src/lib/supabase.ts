import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Missing Supabase environment variable. Please set SUPABASE_URL in .env');
}

if (!supabaseServiceKey) {
  throw new Error(
    'Missing SUPABASE_SERVICE_ROLE_KEY. Required for backend operations. Get it from Supabase Dashboard → Settings → API → Service role / secret key'
  );
}

/**
 * Service role client - Use for backend operations
 * Has unrestricted access to all tables (bypasses RLS)
 * IMPORTANT: Never expose this key to the frontend
 * Use this for:
 * - Mastra agent operations
 * - Server-side data validation and insertion
 * - Accessing Mastra system tables
 *
 * SECURITY: This client bypasses RLS policies. All user data access must be
 * validated server-side using user_id checks in your application code.
 */
export const supabaseService = createClient<Database>(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Anon client - Use for client-side operations (if needed)
 * Respects RLS policies - users can only access their own data
 * Requires JWT token with user_id in claims for RLS filtering
 *
 * NOTE: Currently not used in Telegram bot backend. Reserved for future
 * client-side implementations that need RLS enforcement.
 */
export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey || supabaseServiceKey, // Fallback to service role for testing/development
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
