import { createClient } from '@supabase/supabase-js';

// Connection to the app's Supabase project (staging or production, chosen at
// build time). Only the publishable key ever reaches the browser; every
// access rule is enforced by the database (RLS) and the server functions.
//
// VITE_ variables are baked in when the app is built, so changing them needs
// a rebuild. See .env.example for the names.
const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

let client = null;

// Created on first use rather than at import: during the migration the app
// still runs on Base44 and builds without these variables, and createClient
// throws when the URL is missing.
export function getSupabase() {
  if (!client) {
    if (!url || !publishableKey) {
      throw new Error('Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
    }
    client = createClient(url, publishableKey);
  }
  return client;
}
