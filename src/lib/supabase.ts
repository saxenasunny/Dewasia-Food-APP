import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes("YOUR-PROJECT-REF") &&
    supabaseAnonKey !== "YOUR-ANON-PUBLIC-KEY",
);

/**
 * A single shared client. When the environment is not configured yet we return
 * `null` rather than throwing, so the app can render a clear setup screen
 * instead of crashing on first paint.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Anonymous (guest) sessions must survive a page reload - they are the
        // guest's only credential.
        storageKey: "canteen-auth",
      },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env and add your project URL and anon key.",
    );
  }
  return supabase;
}

export const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? "";
