// F015: public city guide service. get_city_guide (migration 111) is an
// anon-readable aggregate of PUBLIC data only. Not in the generated RPC types
// yet, so the rpc name is cast (same shim as services/matches).
import { supabase } from '../lib/supabase';

type RpcResponse<T> = Promise<{ data: T | null; error: unknown }>;
const callRpc = supabase.rpc.bind(supabase) as unknown as (
  name: string,
  params?: Record<string, unknown>,
) => RpcResponse<unknown>;

export interface CityGuideVenue {
  id: number;
  name: string;
  type: string;
  free_access: boolean | null;
  lat: number | null;
  lng: number | null;
  avg_rating: number;
  review_count: number;
  checkin_count: number;
}

export interface CityGuideEvent {
  id: number;
  title: string;
  starts_at: string;
  venue_id: number;
  venue_name: string | null;
}

export interface CityGuide {
  city: {
    id: number;
    name: string;
    county: string | null;
    country_code: string | null;
    country_name: string | null;
    lat: number | null;
    lng: number | null;
  };
  venue_count: number;
  outdoor: CityGuideVenue[];
  indoor: CityGuideVenue[];
  free_access: CityGuideVenue[];
  events: CityGuideEvent[];
}

export async function getCityGuide(
  cityId: number,
): Promise<{ data: CityGuide | null; error: unknown }> {
  const { data, error } = await callRpc('get_city_guide', { p_city_id: cityId });
  return { data: (data as CityGuide | null) ?? null, error };
}
