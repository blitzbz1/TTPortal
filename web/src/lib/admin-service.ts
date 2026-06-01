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
  address: string | null;
  type: string | null;
  tables_count: number | null;
  description: string | null;
  lat: number | null;
  lng: number | null;
  approved: boolean;
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

export async function updateVenue(
  id: number,
  updates: {
    name?: string;
    address?: string | null;
    city?: string | null;
    type?: string | null;
    tables_count?: number | null;
    description?: string | null;
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
