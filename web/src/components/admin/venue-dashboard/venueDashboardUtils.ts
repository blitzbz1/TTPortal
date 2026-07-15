import type { AdminVenue } from "../../../lib/admin-service";

export type VenueAttentionFlag =
  | "missing_coordinates"
  | "missing_address"
  | "unknown_table_count"
  | "unknown_condition"
  | "not_approved"
  | "hidden"
  | "possible_duplicate"
  | "suspicious_coordinates"
  | "flagged_reviews";

export type VenueImportSource = "in_app" | "staged_osm" | "unknown";

export type DuplicateVenueCandidate = {
  venue: AdminVenue;
  distanceMeters: number;
  reason: "name_and_location" | "same_name" | "nearby";
  confidence: "high" | "medium";
};

export type AdminVenueReviewStatus =
  | "pending"
  | "approved"
  | "hidden"
  | "needs_manual_pin"
  | "duplicate_candidate"
  | "rejected";

export type OsmSeedVenue = {
  name: string;
  type: string | null;
  city: string;
  county: string | null;
  address: string | null;
  lat: number;
  lng: number;
  tables_count?: number | null;
};

const tableCountSuffixPattern = /\s*\((\d{1,3})\)\s*$/;

export function getVenueAttentionFlags(venue: AdminVenue): VenueAttentionFlag[] {
  const flags: VenueAttentionFlag[] = [];
  const lat = Number(venue.lat);
  const lng = Number(venue.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    flags.push("missing_coordinates");
  }

  if (!venue.address || venue.address.trim().length === 0) {
    flags.push("missing_address");
  }

  if (venue.tables_count == null || Number(venue.tables_count) <= 0) {
    flags.push("unknown_table_count");
  }

  if (!venue.condition || venue.condition === "necunoscuta") {
    flags.push("unknown_condition");
  }

  if (venue.approved === false) {
    flags.push("not_approved", "hidden");
  }

  if ((venue.flagged_review_count ?? 0) > 0) {
    flags.push("flagged_reviews");
  }

  if (venue.needs_manual_pin) {
    flags.push("suspicious_coordinates");
  }

  if (venue.review_status === "duplicate_candidate" || venue.duplicate_of_venue_id) {
    flags.push("possible_duplicate");
  }

  if (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    (lat < -90 || lat > 90 || lng < -180 || lng > 180)
  ) {
    flags.push("suspicious_coordinates");
  }

  return Array.from(new Set(flags));
}

export function getVenueAttentionLabel(flag: VenueAttentionFlag) {
  switch (flag) {
    case "missing_coordinates":
      return "Missing coordinates";
    case "missing_address":
      return "Missing address";
    case "unknown_table_count":
      return "Default/unknown table count";
    case "unknown_condition":
      return "Unknown condition";
    case "not_approved":
      return "Unapproved";
    case "hidden":
      return "Hidden";
    case "possible_duplicate":
      return "Possible duplicate";
    case "suspicious_coordinates":
      return "Suspicious coordinates";
    case "flagged_reviews":
      return "Flagged reviews";
    default:
      return flag;
  }
}

export function venueNeedsAttention(venue: AdminVenue) {
  return getVenueAttentionFlags(venue).length > 0;
}

export function getVenueSeedKey(
  venue: Pick<AdminVenue, "name" | "lat" | "lng"> | Pick<OsmSeedVenue, "name" | "lat" | "lng">,
) {
  if (venue.lat == null || venue.lng == null) return "";
  return `${normalizeVenueDuplicateName(venue.name)}|${coordinateKey(venue.lat)}|${coordinateKey(venue.lng)}`;
}

export function getVenueImportSource(venue: AdminVenue, seedVenueKeys: Set<string> | null): VenueImportSource {
  if (!seedVenueKeys) return "unknown";
  return seedVenueKeys.has(getVenueSeedKey(venue)) ? "staged_osm" : "in_app";
}

export function getVenueImportSourceLabel(source: VenueImportSource) {
  if (source === "staged_osm") return "Staged OSM";
  if (source === "in_app") return "Already in app";
  return "Unclassified";
}

export function getAdminVenueReviewStatus(venue: AdminVenue): AdminVenueReviewStatus {
  if (venue.review_status) return venue.review_status;
  return venue.approved ? "approved" : "hidden";
}

export function getReviewStatusLabel(status: AdminVenueReviewStatus) {
  switch (status) {
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "hidden":
      return "Hidden";
    case "needs_manual_pin":
      return "Needs pin fix";
    case "duplicate_candidate":
      return "Duplicate candidate";
    case "rejected":
      return "Rejected";
    default:
      return status;
  }
}

export function distanceMeters(
  a: Pick<AdminVenue, "lat" | "lng">,
  b: Pick<AdminVenue, "lat" | "lng">,
) {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const earthMeters = 6371000;
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLng = (b.lng - a.lng) * toRad;
  const lat1 = a.lat * toRad;
  const lat2 = b.lat * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthMeters * Math.asin(Math.sqrt(h));
}

export function findNearestVenue(
  venue: AdminVenue,
  candidates: AdminVenue[],
  maxDistanceMeters = 120,
  maxNameMatchDistanceMeters = 700,
): DuplicateVenueCandidate | null {
  let nearest: DuplicateVenueCandidate | null = null;
  candidates.forEach((candidate) => {
    if (candidate.id === venue.id) return;
    const distance = distanceMeters(venue, candidate);
    const duplicateNameMatch = isVenueDuplicateNameMatch(venue.name, candidate.name);
    const allowedDistance = duplicateNameMatch ? maxNameMatchDistanceMeters : maxDistanceMeters;
    if (distance == null || distance > allowedDistance) return;
    const roundedDistance = Math.round(distance);
    const closeLocation = roundedDistance <= maxDistanceMeters;
    const reason =
      duplicateNameMatch && closeLocation
        ? "name_and_location"
        : duplicateNameMatch
          ? "same_name"
          : "nearby";
    const confidence = duplicateNameMatch || roundedDistance <= 65 ? "high" : "medium";
    if (!nearest || distance < nearest.distanceMeters) {
      nearest = { venue: candidate, distanceMeters: roundedDistance, reason, confidence };
    }
  });
  return nearest;
}

export function getReviewProgress(venues: AdminVenue[]) {
  const counts = {
    total: venues.length,
    reviewed: 0,
    pending: 0,
    approved: 0,
    hidden: 0,
    duplicate_candidate: 0,
    needs_manual_pin: 0,
    rejected: 0,
  };

  venues.forEach((venue) => {
    const status = getAdminVenueReviewStatus(venue);
    counts[status] += 1;
    if (status !== "pending") counts.reviewed += 1;
  });

  return counts;
}

export function extractVenueTableCountFromName(name: string | null | undefined) {
  const rawName = (name ?? "").trim();
  const match = rawName.match(tableCountSuffixPattern);
  if (!match) return { name: rawName, tableCount: null as number | null };

  const tableCount = Number(match[1]);
  return {
    name: rawName.replace(tableCountSuffixPattern, "").trim(),
    tableCount: Number.isFinite(tableCount) && tableCount > 0 ? tableCount : null,
  };
}

export function normalizeVenueDuplicateName(name: string | null | undefined) {
  return normalizeVenueName(extractVenueTableCountFromName(name).name);
}

export function isVenueDuplicateNameMatch(
  a: string | null | undefined,
  b: string | null | undefined,
) {
  const normalizedA = normalizeVenueDuplicateName(a);
  const normalizedB = normalizeVenueDuplicateName(b);
  return Boolean(normalizedA && normalizedB && normalizedA === normalizedB);
}

function normalizeVenueName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function coordinateKey(value: number) {
  return Number(value).toFixed(5);
}

export function approvedFilterFromVisibility(visibility: string) {
  if (visibility === "visible") return true;
  if (visibility === "hidden") return false;
  return null;
}

export function googleMapsVenueUrl(venue: Pick<AdminVenue, "name" | "address" | "city" | "lat" | "lng">) {
  if (venue.lat != null && venue.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${venue.lat},${venue.lng}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [venue.name, venue.address, venue.city].filter(Boolean).join(", "),
  )}`;
}

export function formatDashboardNumber(n: number) {
  return new Intl.NumberFormat().format(n);
}
