import { supabase } from '../lib/supabase';

export async function getCities() {
  return supabase
    .from('cities')
    .select('*')
    .eq('active', true)
    .order('name');
}
