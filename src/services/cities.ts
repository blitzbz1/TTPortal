import { supabase } from '../lib/supabase';

// The "list cities" path is intentionally not in this file anymore —
// callers should use useCitiesQuery (delta-synced via citiesDelta +
// citiesPersistentCache). That cache only ever ships rows added/changed/
// removed since the device's last sync, which beats any TTL strategy at
// this granularity.

/**
 * Ensures a city exists in the cities table and returns its id.
 * If the city already exists (matched by name), returns the existing row.
 * Otherwise inserts a new row with the given name.
 */
export async function upsertCity(name: string): Promise<{ id: number | null; error: string | null }> {
  // Use Postgres ON CONFLICT to be race-safe: a select-then-insert pattern can
  // double-insert when two clients submit the same new city simultaneously,
  // surfacing as an opaque 409 from the unique constraint on `cities.name`.
  // `ignoreDuplicates: false` makes the upsert return the existing row when
  // there's a name match, so we always get an `id` back.
  const { data: upserted, error: upsertError } = await supabase
    .from('cities')
    .upsert({ name, active: true }, { onConflict: 'name', ignoreDuplicates: false })
    .select('id')
    .single();

  if (upsertError) return { id: null, error: upsertError.message };
  return { id: upserted.id, error: null };
}
