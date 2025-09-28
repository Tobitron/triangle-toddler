import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL as string;
const anon = process.env.SUPABASE_ANON_KEY as string | undefined;
const service = process.env.SUPABASE_SERVICE_ROLE as string | undefined;

if (!url) throw new Error("SUPABASE_URL is not set");
if (!anon && !service) throw new Error("Set SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE in env");

export const supaServer = createClient(url, service || (anon as string), {
  auth: { persistSession: false },
});

