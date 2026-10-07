/**
 * RETHA Real Estate — Supabase Client Instance
 * Secure configuration adhering to Secret Management protocol.
 * Resilient in both browser/Vite and Node.js testing environments.
 */
import { createClient } from '@supabase/supabase-js';

const metaEnv = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
const processEnv = (typeof process !== 'undefined' && process.env) ? process.env : {};

const SUPABASE_URL = metaEnv.VITE_SUPABASE_URL || processEnv.VITE_SUPABASE_URL || 'https://aevssooayvieyhdnshse.supabase.co';
const SUPABASE_ANON_KEY = metaEnv.VITE_SUPABASE_ANON_KEY || processEnv.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFldnNzb29heXZpZXloZG5zaHNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2Mjg2MjMsImV4cCI6MjEwNjIwNDYyM30.isqbivNXCk3Od7Z7mg6hddNNNAOHMGqvwh85UIgES1I';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});
