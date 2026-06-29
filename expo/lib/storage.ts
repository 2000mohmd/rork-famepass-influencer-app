import { supabase } from "@/lib/supabase";

/**
 * Resolves a Supabase Storage path to a full public URL.
 * If the URL already starts with "http", returns it as-is.
 * Otherwise resolves it from the given bucket.
 *
 * @param path   Storage path or full URL (e.g. "venues/abc123/logo.jpg")
 * @param bucket Storage bucket name (default "venues")
 */
export function resolveStorageUrl(
  path: string | null | undefined,
  bucket: string = "venues",
): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
