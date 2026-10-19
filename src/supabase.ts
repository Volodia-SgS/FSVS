import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** null quand Supabase n'est pas configuré : l'app fonctionne alors en local uniquement. */
export const supabase = url && key ? createClient(url, key) : null;
