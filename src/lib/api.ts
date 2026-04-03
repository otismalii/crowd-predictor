/**
 * Standardized Supabase fetch wrapper.
 * Normalizes errors into a consistent shape.
 */
export async function safeFetch<T>(
  query: PromiseLike<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: string | null }> {
  try {
    const { data, error } = await query;
    if (error) {
      console.error("[safeFetch] Supabase error:", error.message || error);
      return { data: null, error: error.message || "Database request failed" };
    }
    return { data, error: null };
  } catch (e: any) {
    console.error("[safeFetch] Unexpected error:", e);
    return { data: null, error: e.message || "Unexpected error" };
  }
}
