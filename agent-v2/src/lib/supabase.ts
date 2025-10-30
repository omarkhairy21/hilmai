import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase environment variables. Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env",
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);
