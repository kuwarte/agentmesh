import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/* Browser-safe client */
export const supabase = createClient(url, anon, {
  auth: {
    persistSession: typeof window !== "undefined",
  },
});

/* Server-only client */
export function createServerClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
    },
  });
}
