import { supabase } from '../lib/supabase';
import { canonicalizeCityName } from '../lib/cityCatalog';

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
  const canonicalName = canonicalizeCityName(name);

  const { data: existing, error: selectError } = await supabase
    .from('cities')
    .select('id')
    .eq('name', canonicalName)
    .maybeSingle();

  if (selectError) return { id: null, error: selectError.message };
  if (existing?.id) return { id: existing.id, error: null };

  const { data: inserted, error: insertError } = await supabase
    .from('cities')
    .insert({ name: canonicalName, active: true })
    .select('id')
    .single();

  if (!insertError) return { id: inserted.id, error: null };

  // If another browser created the city between our SELECT and INSERT, recover
  // by reading the existing row instead of surfacing the unique violation.
  if (insertError.code === '23505') {
    const { data: raced, error: raceSelectError } = await supabase
      .from('cities')
      .select('id')
      .eq('name', canonicalName)
      .maybeSingle();

    if (raceSelectError) return { id: null, error: raceSelectError.message };
    if (raced?.id) return { id: raced.id, error: null };
  }

  return { id: null, error: insertError.message };
}
