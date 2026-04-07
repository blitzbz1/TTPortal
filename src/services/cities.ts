import { supabase } from '../lib/supabase';

export async function getCities() {
  return supabase
    .from('cities')
    .select('*')
    .eq('active', true)
    .order('name');
}

/**
 * Ensures a city exists in the cities table and returns its id.
 * If the city already exists (matched by name), returns the existing row.
 * Otherwise inserts a new row with the given name.
 */
export async function upsertCity(name: string): Promise<{ id: number | null; error: string | null }> {
  // Try to find existing city first
  const { data: existing, error: selectError } = await supabase
    .from('cities')
    .select('id')
    .eq('name', name)
    .maybeSingle();

  if (selectError) return { id: null, error: selectError.message };
  if (existing) return { id: existing.id, error: null };

  // Insert new city
  const { data: inserted, error: insertError } = await supabase
    .from('cities')
    .insert({ name, active: true })
    .select('id')
    .single();

  if (insertError) return { id: null, error: insertError.message };
  return { id: inserted.id, error: null };
}
