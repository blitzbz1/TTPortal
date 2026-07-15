import { supabase } from "./supabase";

// All admin mutations rely on RLS policies that gate on profiles.is_admin;
// no client-side verifyAdmin is needed — the server enforces it.

export type PendingVenue = {
  id: number;
  name: string;
  city: string | null;
  address: string | null;
  type: string | null;
  tables_count: number | null;
  description: string | null;
  lat: number | null;
  lng: number | null;
  approved: boolean;
  created_at: string;
  submitted_by: string | null;
  profiles: { full_name: string | null } | null;
};

export type AdminVenue = {
  id: number;
  name: string;
  city: string | null;
  city_id?: number | null;
  country_code?: string | null;
  county?: string | null;
  sector?: string | null;
  address: string | null;
  type: string | null;
  tables_count: number | null;
  condition?: string | null;
  hours?: string | null;
  description: string | null;
  tags?: string[] | null;
  photos?: string[] | null;
  free_access?: boolean | null;
  night_lighting?: boolean | null;
  nets?: boolean | null;
  lat: number | null;
  lng: number | null;
  approved: boolean;
  verified?: boolean | null;
  tariff?: string | null;
  website?: string | null;
  submitted_by?: string | null;
  review_status?:
    | "pending"
    | "approved"
    | "hidden"
    | "needs_manual_pin"
    | "duplicate_candidate"
    | "rejected"
    | null;
  duplicate_of_venue_id?: number | null;
  needs_manual_pin?: boolean | null;
  admin_review_notes?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  created_at?: string;
  updated_at?: string;
  avg_rating?: number | null;
  review_count?: number | null;
  checkin_count?: number | null;
  flagged_review_count?: number | null;
};

export type AdminCityReviewRow = {
  city_id: number;
  city_name: string;
  country_code: string;
  country_name: string;
  admin_area: string | null;
  local_area: string | null;
  lat: number | null;
  lng: number | null;
  zoom: number | null;
  active: boolean;
  expansion_status: string;
  venue_count: number;
  approved_count: number;
  hidden_count: number;
  missing_address_count: number;
  missing_tables_count: number;
  unknown_condition_count: number;
  duplicate_name_groups: number;
  flagged_review_count: number;
  updated_at: string;
};

export type AdminVenueViewportFilters = {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
  cityId?: number | null;
  approved?: boolean | null;
  type?: string | null;
  query?: string | null;
  needsAttention?: boolean;
  limit?: number;
};

export type AdminVenueReview = {
  id: number;
  rating: number | null;
  body: string | null;
  flagged: boolean;
  flag_count: number;
  created_at: string;
  full_name: string | null;
};

export type AdminVenueReviewContext = {
  stats: {
    venue_id: number;
    avg_rating: number | null;
    review_count: number;
    checkin_count: number;
    favorite_count: number;
  } | null;
  reviews: AdminVenueReview[];
};

export type FlaggedReview = {
  id: number;
  user_id: string;
  venue_id: number;
  rating: number | null;
  comment: string | null;
  flagged: boolean;
  flag_count: number;
  created_at: string;
  profiles: { full_name: string | null } | null;
  venues: { name: string | null } | null;
};

export type UserFeedbackRow = {
  id: string;
  user_id: string | null;
  page: string | null;
  category: string | null;
  message: string;
  created_at: string;
  profiles: { full_name: string | null; email: string | null } | null;
};

export type FeedbackReply = {
  id: string;
  feedback_id: string;
  admin_id: string;
  reply_text: string;
  created_at: string;
  profiles: { full_name: string | null } | null;
};

export async function getPendingVenues() {
  return supabase
    .from("venues")
    .select("*, profiles!submitted_by(full_name)")
    .eq("approved", false)
    .order("created_at", { ascending: false });
}

export async function approveVenue(id: number) {
  return supabase.from("venues").update({ approved: true }).eq("id", id).select().single();
}

export async function setVenueApproved(id: number, approved: boolean) {
  return supabase.from("venues").update({ approved }).eq("id", id).select().single();
}

export async function getAdminVenueById(id: number) {
  return supabase
    .from("venues")
    .select(
      "id, name, type, city, city_id, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, photos, free_access, night_lighting, nets, verified, tariff, website, approved, submitted_by, review_status, duplicate_of_venue_id, needs_manual_pin, admin_review_notes, reviewed_at, reviewed_by, created_at, updated_at",
    )
    .eq("id", id)
    .single();
}

export async function rejectVenue(id: number) {
  return supabase.from("venues").delete().eq("id", id);
}

export async function searchVenuesAdmin(query: string) {
  const pattern = `%${query}%`;
  return supabase
    .from("venues")
    .select("id, name, city, address, type, tables_count, lat, lng, description, approved")
    .or(`name.ilike.${pattern},address.ilike.${pattern}`)
    .order("name")
    .limit(30);
}

export async function getAdminCityReviewQueue(filters?: {
  countryCode?: string | null;
  expansionStatus?: string | null;
  query?: string | null;
  limit?: number;
  offset?: number;
}) {
  return supabase.rpc("admin_get_city_review_queue", {
    p_country_code: filters?.countryCode ?? null,
    p_expansion_status: filters?.expansionStatus ?? null,
    p_query: filters?.query ?? null,
    p_limit: filters?.limit ?? 80,
    p_offset: filters?.offset ?? 0,
  });
}

export async function getAdminVenuesInViewport(filters: AdminVenueViewportFilters) {
  return supabase.rpc("admin_get_venues_in_viewport", {
    p_min_lat: filters.minLat,
    p_min_lng: filters.minLng,
    p_max_lat: filters.maxLat,
    p_max_lng: filters.maxLng,
    p_city_id: filters.cityId ?? null,
    p_approved: filters.approved ?? null,
    p_type: filters.type ?? null,
    p_query: filters.query ?? null,
    p_needs_attention: filters.needsAttention ?? false,
    p_limit: filters.limit ?? 600,
  });
}

export async function getAdminVenueReviewContext(venueId: number) {
  return supabase.rpc("admin_get_venue_review_context", {
    p_venue_id: venueId,
  });
}

export async function updateAdminCityReviewStatus(
  cityId: number,
  active: boolean,
  expansionStatus: string,
) {
  return supabase.rpc("admin_update_city_review_status", {
    p_city_id: cityId,
    p_active: active,
    p_expansion_status: expansionStatus,
  });
}

export async function setVenueReviewState(
  venueId: number,
  updates: {
    reviewStatus?: AdminVenue["review_status"] | null;
    duplicateOfVenueId?: number | null;
    needsManualPin?: boolean | null;
    notes?: string | null;
    approved?: boolean | null;
  },
) {
  return supabase.rpc("admin_set_venue_review_state", {
    p_venue_id: venueId,
    p_review_status: updates.reviewStatus ?? null,
    p_duplicate_of_venue_id: updates.duplicateOfVenueId ?? null,
    p_needs_manual_pin: updates.needsManualPin ?? null,
    p_notes: updates.notes ?? null,
    p_approved: updates.approved ?? null,
  });
}

export async function importOsmSeedVenue(
  countryCode: string,
  countryName: string,
  cityName: string,
  cityLat: number | null,
  cityLng: number | null,
  cityZoom: number | null,
  venuePayload: Record<string, unknown>,
  showInApp: boolean,
) {
  return supabase.rpc("admin_import_osm_seed_venue", {
    p_country_code: countryCode,
    p_country_name: countryName,
    p_city_name: cityName,
    p_city_lat: cityLat,
    p_city_lng: cityLng,
    p_city_zoom: cityZoom ?? 12,
    p_venue: venuePayload,
    p_show_in_app: showInApp,
  });
}

export async function bulkSetVenueReviewState(
  venueIds: number[],
  updates: {
    reviewStatus: NonNullable<AdminVenue["review_status"]>;
    approved?: boolean | null;
    notes?: string | null;
  },
) {
  return supabase.rpc("admin_bulk_set_venue_review_state", {
    p_venue_ids: venueIds,
    p_review_status: updates.reviewStatus,
    p_approved: updates.approved ?? null,
    p_notes: updates.notes ?? null,
  });
}

export async function updateVenue(
  id: number,
  updates: {
    name?: string;
    address?: string | null;
    city?: string | null;
    city_id?: number | null;
    county?: string | null;
    sector?: string | null;
    type?: string | null;
    tables_count?: number | null;
    condition?: string | null;
    hours?: string | null;
    description?: string | null;
    tags?: string[] | null;
    photos?: string[] | null;
    free_access?: boolean | null;
    night_lighting?: boolean | null;
    nets?: boolean | null;
    verified?: boolean | null;
    tariff?: string | null;
    website?: string | null;
    approved?: boolean;
    review_status?: AdminVenue["review_status"] | null;
    duplicate_of_venue_id?: number | null;
    needs_manual_pin?: boolean | null;
    admin_review_notes?: string | null;
    lat?: number | null;
    lng?: number | null;
  },
) {
  return supabase.from("venues").update(updates).eq("id", id).select().single();
}

export async function deleteVenue(id: number) {
  return supabase.from("venues").delete().eq("id", id);
}

export async function getFlaggedReviews() {
  return supabase
    .from("reviews")
    .select("*, profiles!user_id(full_name), venues!venue_id(name)")
    .eq("flagged", true)
    .order("flag_count", { ascending: false });
}

export async function keepReview(id: number) {
  return supabase
    .from("reviews")
    .update({ flagged: false, flag_count: 0 })
    .eq("id", id)
    .select()
    .single();
}

export async function deleteReview(id: number) {
  return supabase.from("reviews").delete().eq("id", id);
}

export async function getUserFeedback(limit = 100) {
  return supabase
    .from("user_feedback")
    .select(
      "id, user_id, page, category, message, created_at, profiles!user_id(full_name, email)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function deleteUserFeedback(id: string) {
  return supabase.from("user_feedback").delete().eq("id", id);
}

export async function getFeedbackReplies(feedbackId: string) {
  return supabase
    .from("feedback_replies")
    .select(
      "id, feedback_id, admin_id, reply_text, created_at, profiles!admin_id(full_name)",
    )
    .eq("feedback_id", feedbackId)
    .order("created_at", { ascending: true });
}

export async function replyToFeedback(feedbackId: string, adminId: string, replyText: string) {
  const trimmed = replyText.trim();
  if (!trimmed) return { data: null, error: { message: "Reply text is required" } };
  return supabase
    .from("feedback_replies")
    .insert({ feedback_id: feedbackId, admin_id: adminId, reply_text: trimmed })
    .select()
    .single();
}
