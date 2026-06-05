"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  Clipboard,
  Database,
  Eye,
  EyeOff,
  Filter,
  Globe2,
  History,
  Loader2,
  MapPinned,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";
import { useAdmin } from "@/lib/use-admin";
import { useAuth } from "@/lib/auth-context";
import { getCanonicalCountryName, getLocalizedCountryName } from "@/lib/country-labels";
import {
  getAdminCityReviewQueue,
  getAdminVenueReviewContext,
  getAdminVenuesInViewport,
  importOsmSeedVenue,
  setVenueReviewState,
  setVenueApproved,
  updateVenue,
  deleteVenue,
  updateAdminCityReviewStatus,
  type AdminCityReviewRow,
  type AdminVenue,
  type AdminVenueReviewContext,
} from "@/lib/admin-service";
import type { AdminMapBounds, AdminSeedCityFocus } from "./AdminVenueMap";
import { VenueRecordEditor } from "./VenueRecordEditor";
import {
  approvedFilterFromVisibility,
  formatDashboardNumber,
  getVenueImportSource,
  getVenueImportSourceLabel,
  getVenueSeedKey,
  getVenueAttentionFlags,
  getVenueAttentionLabel,
  googleMapsVenueUrl,
  findNearestVenue,
  distanceMeters,
  extractVenueTableCountFromName,
  isVenueDuplicateNameMatch,
  normalizeVenueDuplicateName,
  type DuplicateVenueCandidate,
  type OsmSeedVenue,
  type VenueImportSource,
  venueNeedsAttention,
} from "./venueDashboardUtils";

const AdminVenueMap = dynamic(
  () => import("./AdminVenueMap").then((mod) => mod.AdminVenueMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[520px] items-center justify-center gap-2 bg-ink-50 text-[13px] text-ink-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading map
      </div>
    ),
  },
);

const statusOptions = [
  { value: "", label: "All statuses" },
  { value: "community_review", label: "Community review" },
  { value: "active", label: "Active" },
  { value: "hidden", label: "Hidden" },
];

const venueTypes = [
  { value: "", label: "All types" },
  { value: "parc_exterior", label: "Outdoor" },
  { value: "sala_indoor", label: "Indoor" },
];

const visibilityOptions = [
  { value: "", label: "Shown + hidden" },
  { value: "visible", label: "Shown only" },
  { value: "hidden", label: "Hidden only" },
];

const sourceOptions: { value: VenueImportSource | ""; label: string }[] = [
  { value: "", label: "All sources" },
  { value: "in_app", label: "Already in app" },
  { value: "staged_osm", label: "Staged OSM" },
];

const reviewStatusOptions: { value: NonNullable<AdminVenue["review_status"]>; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "hidden", label: "Hidden" },
  { value: "needs_manual_pin", label: "Needs pin fix" },
  { value: "duplicate_candidate", label: "Duplicate candidate" },
  { value: "rejected", label: "Rejected" },
];

type OsmSeedCity = {
  rank: number;
  name: string;
  locations: number;
};

type OsmSeedCountry = {
  rank: number;
  name: string;
  code: string;
  locations: number;
  cities: number;
  share: string;
};

type OsmSeedInventory = {
  source: string;
  metrics: {
    totalLocations: number;
    countries: number;
    cities: number;
  };
  countries: OsmSeedCountry[];
  cityGroups: Record<string, OsmSeedCity[]>;
};

type OsmSeedCountryVenueManifest = {
  countryCode: string;
  totalVenues: number;
  cityCount: number;
  cities: Record<string, OsmSeedVenue[]>;
};

type SeedCitySelection = {
  countryCode: string;
  countryName: string;
  cityName: string;
  locations: number;
  seedRank: number;
  cityId?: number;
  lat?: number | null;
  lng?: number | null;
  zoom?: number | null;
} | null;

type SeedVenueDraft = {
  name: string;
  type: string;
  city: string;
  county: string;
  address: string;
  lat: string;
  lng: string;
  tablesCount: string;
  condition: string;
  description: string;
  freeAccess: boolean;
  nightLighting: boolean;
  nets: boolean;
  verified: boolean;
  approved: boolean;
  reviewStatus: NonNullable<AdminVenue["review_status"]>;
  needsManualPin: boolean;
  duplicateOfVenueId: string;
  notes: string;
};

type RecentAdminAction =
  | {
      id: string;
      kind: "import";
      label: string;
      detail: string;
      createdAt: string;
      venue: AdminVenue;
      seedKey: string;
    }
  | {
      id: string;
      kind: "skip";
      label: string;
      detail: string;
      createdAt: string;
      seedKey: string;
    }
  | {
      id: string;
      kind: "venue_update";
      label: string;
      detail: string;
      createdAt: string;
      before: AdminVenue;
      after: AdminVenue;
      seedKey?: string;
    }
  | {
      id: string;
      kind: "city_status";
      label: string;
      detail: string;
      createdAt: string;
      cityId: number;
      before: { active: boolean; expansionStatus: string };
      after: { active: boolean; expansionStatus: string };
    };

type RecentAdminActionInput = RecentAdminAction extends infer Action
  ? Action extends RecentAdminAction
    ? Omit<Action, "id" | "createdAt">
    : never
  : never;

export function VenueReviewDashboard() {
  const locale = useLocale();
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();

  const [seedInventory, setSeedInventory] = useState<OsmSeedInventory | null>(null);
  const [seedVenueManifest, setSeedVenueManifest] = useState<OsmSeedCountryVenueManifest | null>(null);
  const [seedVenueManifestLoading, setSeedVenueManifestLoading] = useState(false);
  const [seedCountryCode, setSeedCountryCode] = useState("");
  const [seedCitySearch, setSeedCitySearch] = useState("");
  const [selectedReviewCity, setSelectedReviewCity] = useState<SeedCitySelection>(null);

  const [cities, setCities] = useState<AdminCityReviewRow[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [cityError, setCityError] = useState<string | null>(null);
  const [citySearch, setCitySearch] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [status, setStatus] = useState("community_review");
  const [selectedCityId, setSelectedCityId] = useState<number | null>(null);

  const [bounds, setBounds] = useState<AdminMapBounds | null>(null);
  const [venues, setVenues] = useState<AdminVenue[]>([]);
  const [cityVenues, setCityVenues] = useState<AdminVenue[]>([]);
  const [cityVenuesLoading, setCityVenuesLoading] = useState(false);
  const [venuesLoading, setVenuesLoading] = useState(false);
  const [venueError, setVenueError] = useState<string | null>(null);
  const [venueSearch, setVenueSearch] = useState("");
  const [venueType, setVenueType] = useState("");
  const [visibility, setVisibility] = useState("");
  const [sourceFilter, setSourceFilter] = useState<VenueImportSource | "">("");
  const [needsAttention, setNeedsAttention] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<"map" | "review">("map");
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<AdminVenue | null>(null);
  const [selectedSeedPreviewIndex, setSelectedSeedPreviewIndex] = useState<number | null>(null);
  const [seedPreviewDrafts, setSeedPreviewDrafts] = useState<Record<string, SeedVenueDraft>>({});
  const [importedSeedVenueKeys, setImportedSeedVenueKeys] = useState<string[]>([]);
  const [skippedSeedVenueKeys, setSkippedSeedVenueKeys] = useState<string[]>([]);
  const [reviewContext, setReviewContext] = useState<AdminVenueReviewContext | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminVenue | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [recentActions, setRecentActions] = useState<RecentAdminAction[]>([]);
  const venueDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedCity = useMemo(
    () => cities.find((city) => city.city_id === selectedCityId) ?? null,
    [cities, selectedCityId],
  );

  const countries = useMemo(() => {
    const seen = new Map<string, string>();
    seedInventory?.countries.forEach((country) =>
      seen.set(country.code, getLocalizedCountryName(country.code, locale, country.name)),
    );
    cities.forEach((city) => {
      if (city.country_code) {
        seen.set(city.country_code, getLocalizedCountryName(city.country_code, locale, city.country_name));
      }
    });
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1], locale));
  }, [cities, locale, seedInventory]);

  const totals = useMemo(
    () =>
      cities.reduce(
        (acc, city) => ({
          venues: acc.venues + city.venue_count,
          hidden: acc.hidden + city.hidden_count,
          attention:
            acc.attention +
            city.missing_address_count +
            city.missing_tables_count +
            city.unknown_condition_count +
            city.duplicate_name_groups +
            city.flagged_review_count,
        }),
        { venues: 0, hidden: 0, attention: 0 },
      ),
    [cities],
  );

  const selectedSeedCountry = useMemo(
    () => seedInventory?.countries.find((country) => country.code === seedCountryCode) ?? null,
    [seedCountryCode, seedInventory],
  );

  const seedCities = useMemo(() => {
    if (!seedInventory || !selectedSeedCountry) return [];
    const query = seedCitySearch.trim().toLowerCase();
    const rows = seedInventory.cityGroups[selectedSeedCountry.code] ?? [];
    if (!query) return rows;
    return rows.filter((city) => city.name.toLowerCase().includes(query));
  }, [seedCitySearch, seedInventory, selectedSeedCountry]);

  const selectedSeedVenues = useMemo(() => {
    if (!selectedReviewCity || !seedVenueManifest) return [];
    return seedVenueManifest.cities[selectedReviewCity.cityName] ?? [];
  }, [seedVenueManifest, selectedReviewCity]);

  const seedVenueKeys = useMemo(() => {
    if (!selectedSeedVenues.length) return null;
    return new Set(selectedSeedVenues.map((venue) => getVenueSeedKey(venue)));
  }, [selectedSeedVenues]);

  const selectedSeedCityFocus = useMemo<AdminSeedCityFocus | null>(() => {
    if (!selectedReviewCity) return null;
    if (selectedCity?.lat != null && selectedCity.lng != null) {
      return {
        cityName: selectedCity.city_name,
        countryName: getLocalizedCountryName(selectedCity.country_code, locale, selectedCity.country_name),
        lat: selectedCity.lat,
        lng: selectedCity.lng,
        zoom: selectedCity.zoom,
      };
    }

    const points = selectedSeedVenues.filter(
      (venue) =>
        Number.isFinite(venue.lat) &&
        Number.isFinite(venue.lng) &&
        venue.lat >= -90 &&
        venue.lat <= 90 &&
        venue.lng >= -180 &&
        venue.lng <= 180,
    );

    if (!points.length) {
      return {
        cityName: selectedReviewCity.cityName,
        countryName: selectedReviewCity.countryName,
        lat: null,
        lng: null,
        zoom: selectedReviewCity.zoom ?? 12,
      };
    }

    const totals = points.reduce(
      (acc, venue) => ({ lat: acc.lat + venue.lat, lng: acc.lng + venue.lng }),
      { lat: 0, lng: 0 },
    );

    return {
      cityName: selectedReviewCity.cityName,
      countryName: selectedReviewCity.countryName,
      lat: totals.lat / points.length,
      lng: totals.lng / points.length,
      zoom: selectedReviewCity.zoom ?? 12,
    };
  }, [locale, selectedCity, selectedReviewCity, selectedSeedVenues]);

  const importedSeedVenueKeySet = useMemo(
    () => new Set(importedSeedVenueKeys),
    [importedSeedVenueKeys],
  );

  const seedPreviewVenues = useMemo(() => {
    if (!selectedReviewCity || !selectedSeedVenues.length) return [];
    const currentVenueKeys = new Set(cityVenues.map((venue) => getVenueSeedKey(venue)));
    return selectedSeedVenues.filter((venue) => {
      const key = getVenueSeedKey(venue);
      return key && !currentVenueKeys.has(key) && !importedSeedVenueKeySet.has(key) && !skippedSeedVenueKeys.includes(key);
    });
  }, [cityVenues, importedSeedVenueKeySet, selectedReviewCity, selectedSeedVenues, skippedSeedVenueKeys]);

  const selectedSeedPreviewVenue = useMemo(() => {
    if (selectedSeedPreviewIndex == null) return null;
    return seedPreviewVenues[selectedSeedPreviewIndex] ?? null;
  }, [seedPreviewVenues, selectedSeedPreviewIndex]);

  const selectedSeedPreviewDraftKey = useMemo(() => {
    if (!selectedSeedPreviewVenue || selectedSeedPreviewIndex == null) return null;
    return getSeedPreviewDraftKey(selectedSeedPreviewVenue, selectedSeedPreviewIndex);
  }, [selectedSeedPreviewIndex, selectedSeedPreviewVenue]);

  const selectedSeedPreviewDraft = useMemo(() => {
    if (!selectedSeedPreviewVenue || !selectedSeedPreviewDraftKey) return null;
    return (
      seedPreviewDrafts[selectedSeedPreviewDraftKey] ??
      seedVenueToDraft(selectedSeedPreviewVenue)
    );
  }, [seedPreviewDrafts, selectedSeedPreviewDraftKey, selectedSeedPreviewVenue]);

  const seedReviewItems = useMemo<SeedReviewItem[]>(
    () =>
      seedPreviewVenues.map((venue, index) => {
        const nearest = findNearestVenueForSeed(venue, cityVenues, 140);
        const flags = getSeedVenueFlags(venue, nearest);
        return {
          kind: "seed" as const,
          venue,
          index,
          bucket: getSeedVenueBucket(venue, nearest),
          flags,
          nearest,
        };
      }),
    [cityVenues, seedPreviewVenues],
  );

  const liveReviewItems = useMemo<LiveReviewItem[]>(
    () =>
      cityVenues.map((venue) => {
        const nearest = findNearestVenue(venue, cityVenues, 120, 700);
        return {
          kind: "venue" as const,
          venue,
          bucket: getLiveVenueBucket(venue, nearest),
          flags: getVenueAttentionFlags(venue),
          nearest,
        };
      }),
    [cityVenues],
  );

  const queueStats = useMemo(
    () => ({
      supabase: cityVenues.length,
      mapSupabase: venues.length,
      seedRemaining: seedPreviewVenues.length,
      seedTotal: selectedSeedVenues.length,
      seedImported: Math.max(selectedSeedVenues.length - seedPreviewVenues.length, 0),
      ready: seedReviewItems.filter((item) => item.bucket === "ready").length,
      duplicates: seedReviewItems.filter((item) => item.bucket === "duplicate").length + liveReviewItems.filter((item) => item.bucket === "duplicate").length,
      needsEdit: seedReviewItems.filter((item) => item.bucket === "needs_edit").length + liveReviewItems.filter((item) => item.bucket === "needs_edit").length,
      reviewed: liveReviewItems.filter((item) => item.bucket === "approved" || item.bucket === "hidden").length,
    }),
    [cityVenues.length, liveReviewItems, seedPreviewVenues.length, seedReviewItems, selectedSeedVenues.length, venues.length],
  );

  const completionIssues = useMemo(() => {
    const highConfidenceDuplicates =
      seedReviewItems.filter((item) => item.bucket === "duplicate" && item.nearest?.confidence === "high").length +
      liveReviewItems.filter((item) => item.bucket === "duplicate" && item.nearest?.confidence === "high").length;
    const reviewNeedsEdit =
      seedReviewItems.filter((item) => item.bucket === "needs_edit").length +
      liveReviewItems.filter((item) => item.bucket === "needs_edit").length;

    return {
      highConfidenceDuplicates,
      reviewNeedsEdit,
      remainingDrafts: seedPreviewVenues.length,
      canMarkComplete:
        selectedReviewCity != null &&
        highConfidenceDuplicates === 0 &&
        reviewNeedsEdit === 0 &&
        seedPreviewVenues.length === 0,
    };
  }, [liveReviewItems, seedPreviewVenues.length, seedReviewItems, selectedReviewCity]);

  const mapTitle = useMemo(() => {
    if (!selectedReviewCity) return "Choose a city";
    return selectedVenue || selectedSeedPreviewVenue
      ? `${selectedReviewCity.cityName} review map · 1 selected`
      : `${selectedReviewCity.cityName} review map`;
  }, [selectedReviewCity, selectedSeedPreviewVenue, selectedVenue]);

  const workspaceMapsUrl = useMemo(() => {
    if (selectedVenue) return googleMapsVenueUrl(selectedVenue);
    if (selectedSeedPreviewDraft) {
      return googleMapsVenueUrl({
        name: selectedSeedPreviewDraft.name,
        address: selectedSeedPreviewDraft.address,
        city: selectedSeedPreviewDraft.city,
        lat: quickNumberOrNull(selectedSeedPreviewDraft.lat),
        lng: quickNumberOrNull(selectedSeedPreviewDraft.lng),
      });
    }
    return null;
  }, [selectedSeedPreviewDraft, selectedVenue]);

  const selectedCityMetrics = useMemo(() => {
    if (!selectedCity) return null;
    return {
      shown: selectedCity.approved_count,
      hidden: selectedCity.hidden_count,
      needsAttention:
        selectedCity.missing_address_count +
        selectedCity.missing_tables_count +
        selectedCity.unknown_condition_count +
        selectedCity.duplicate_name_groups +
        selectedCity.flagged_review_count,
      missingAddress: selectedCity.missing_address_count,
      possibleDuplicates: selectedCity.duplicate_name_groups,
      defaultTableCount: selectedCity.missing_tables_count,
    };
  }, [selectedCity]);

  const venueSourceCounts = useMemo(() => {
    return venues.reduce(
      (acc, venue) => {
        const source = getVenueImportSource(venue, seedVenueKeys);
        acc[source] += 1;
        return acc;
      },
      { in_app: 0, staged_osm: 0, unknown: 0 } satisfies Record<VenueImportSource, number>,
    );
  }, [seedVenueKeys, venues]);

  const venueSources = useMemo(() => {
    return Object.fromEntries(
      cityVenues.map((venue) => [venue.id, getVenueImportSource(venue, seedVenueKeys)]),
    ) as Record<number, VenueImportSource>;
  }, [cityVenues, seedVenueKeys]);

  const mapVenues = useMemo(() => {
    if (!selectedVenue || venues.some((venue) => venue.id === selectedVenue.id)) return venues;
    return [...venues, selectedVenue];
  }, [selectedVenue, venues]);

  const recordRecentAction = useCallback((action: RecentAdminActionInput) => {
    setRecentActions((current) => [
      {
        ...action,
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        createdAt: new Date().toISOString(),
      } as RecentAdminAction,
      ...current,
    ].slice(0, 12));
  }, []);

  const loadCities = useCallback(async () => {
    setCitiesLoading(true);
    setCityError(null);
    const { data, error } = await getAdminCityReviewQueue({
      countryCode: countryCode || null,
      expansionStatus: status || null,
      query: citySearch || null,
      limit: 120,
    });
    if (error) {
      setCityError(error.message);
      setCities([]);
      setCitiesLoading(false);
      return;
    }
    const rows = (data ?? []) as AdminCityReviewRow[];
    setCities(rows);
    setSelectedCityId((current) => {
      if (current && rows.some((city) => city.city_id === current)) return current;
      const targetName = selectedReviewCity?.cityName || citySearch.trim();
      if (targetName) {
        const normalizedTarget = targetName.toLowerCase();
        const exact = rows.find((city) => city.city_name.toLowerCase() === normalizedTarget);
        if (exact) return exact.city_id;
      }
      return rows[0]?.city_id ?? null;
    });
    setCitiesLoading(false);
  }, [citySearch, countryCode, selectedReviewCity, status]);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/osm-location-counts.json")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: OsmSeedInventory | null) => {
        if (!cancelled) setSeedInventory(data);
      })
      .catch(() => {
        if (!cancelled) setSeedInventory(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (venueType && !venueTypes.some((option) => option.value === venueType)) {
      setVenueType("");
    }
    if (status && !statusOptions.some((option) => option.value === status)) {
      setStatus("");
    }
  }, [status, venueType]);

  useEffect(() => {
    const manifestCountryCode = selectedReviewCity?.countryCode || countryCode;
    if (!manifestCountryCode) {
      setSeedVenueManifest(null);
      return;
    }
    let cancelled = false;
    setSeedVenueManifestLoading(true);
    fetch(`/data/osm-seed-venues/${manifestCountryCode.toLowerCase()}.json`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: OsmSeedCountryVenueManifest | null) => {
        if (cancelled) return;
        setSeedVenueManifest(data);
        setSeedVenueManifestLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSeedVenueManifest(null);
        setSeedVenueManifestLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [countryCode, selectedReviewCity]);

  const loadVenues = useCallback(async () => {
    if (!bounds) return;
    setVenuesLoading(true);
    setVenueError(null);
    const approved = approvedFilterFromVisibility(visibility);
    const { data, error } = await getAdminVenuesInViewport({
      minLat: bounds.minLat,
      minLng: bounds.minLng,
      maxLat: bounds.maxLat,
      maxLng: bounds.maxLng,
      cityId: selectedCityId,
      approved,
      type: venueType || null,
      query: venueSearch || null,
      needsAttention,
      limit: 700,
    });
    if (error) {
      setVenueError(error.message);
      setVenues([]);
      setVenuesLoading(false);
      return;
    }
    const rows = (data ?? []) as AdminVenue[];
    const visibleRows = rows.filter((venue) => {
      if (needsAttention && !venueNeedsAttention(venue)) return false;
      if (sourceFilter && getVenueImportSource(venue, seedVenueKeys) !== sourceFilter) return false;
      return true;
    });
    setVenues(visibleRows);
    setSelectedVenue((current) => {
      if (!current) return null;
      if (selectedCityId && current.city_id !== selectedCityId) return null;
      if (visibleRows.some((venue) => venue.id === current.id)) return current;
      if (cityVenues.some((venue) => venue.id === current.id)) return current;
      if (selectedReviewCity && !selectedCity && selectedSeedVenues.length) return null;
      return null;
    });
    setVenuesLoading(false);
  }, [
    bounds,
    needsAttention,
    cityVenues,
    seedVenueKeys,
    selectedCity,
    selectedCityId,
    selectedReviewCity,
    selectedSeedVenues.length,
    sourceFilter,
    venueSearch,
    venueType,
    visibility,
  ]);

  const loadCityVenues = useCallback(async () => {
    if (!selectedCityId) {
      setCityVenues([]);
      return;
    }

    setCityVenuesLoading(true);
    const { data, error } = await getAdminVenuesInViewport({
      minLat: -90,
      minLng: -180,
      maxLat: 90,
      maxLng: 180,
      cityId: selectedCityId,
      approved: null,
      type: null,
      query: null,
      needsAttention: false,
      limit: 2000,
    });
    setCityVenuesLoading(false);

    if (error) {
      setCityVenues([]);
      return;
    }

    setCityVenues((data ?? []) as AdminVenue[]);
  }, [selectedCityId]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    loadCities();
  }, [isAdmin, loadCities, user]);

  useEffect(() => {
    if (!selectedReviewCity || !selectedCity) return;
    if (
      selectedCity.country_code !== selectedReviewCity.countryCode ||
      selectedCity.city_name.toLowerCase() !== selectedReviewCity.cityName.toLowerCase()
    ) {
      return;
    }
    if (
      selectedReviewCity.cityId === selectedCity.city_id &&
      selectedReviewCity.lat === selectedCity.lat &&
      selectedReviewCity.lng === selectedCity.lng &&
      selectedReviewCity.zoom === selectedCity.zoom
    ) {
      return;
    }
    setSelectedReviewCity((current) =>
      current
        ? {
            ...current,
            cityId: selectedCity.city_id,
            lat: selectedCity.lat,
            lng: selectedCity.lng,
            zoom: selectedCity.zoom,
          }
        : current,
    );
  }, [selectedCity, selectedReviewCity]);

  useEffect(() => {
    if (!user || !isAdmin || !bounds) return;
    if (venueDebounceRef.current) clearTimeout(venueDebounceRef.current);
    venueDebounceRef.current = setTimeout(() => {
      loadVenues();
    }, venueSearch ? 350 : 80);
    return () => {
      if (venueDebounceRef.current) clearTimeout(venueDebounceRef.current);
    };
  }, [bounds, isAdmin, loadVenues, user, venueSearch]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    loadCityVenues();
  }, [isAdmin, loadCityVenues, user]);

  useEffect(() => {
    if (!selectedVenue) {
      setReviewContext(null);
      return;
    }
    let cancelled = false;
    setReviewLoading(true);
    getAdminVenueReviewContext(selectedVenue.id).then(({ data }) => {
      if (cancelled) return;
      setReviewContext((data as AdminVenueReviewContext | null) ?? null);
      setReviewLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedVenue]);

  useEffect(() => {
    if (selectedSeedPreviewIndex == null) return;
    if (selectedSeedPreviewIndex >= seedPreviewVenues.length) {
      setSelectedSeedPreviewIndex(seedPreviewVenues.length ? 0 : null);
    }
  }, [seedPreviewVenues.length, selectedSeedPreviewIndex]);

  useEffect(() => {
    if (workspaceTab === "review" && !selectedVenue && !selectedSeedPreviewVenue) {
      setWorkspaceTab("map");
    }
  }, [selectedSeedPreviewVenue, selectedVenue, workspaceTab]);

  useEffect(() => {
    if (!selectedReviewCity || selectedCity || selectedVenue || selectedSeedPreviewIndex != null) return;
    if (seedPreviewVenues.length) setSelectedSeedPreviewIndex(0);
  }, [
    seedPreviewVenues.length,
    selectedCity,
    selectedReviewCity,
    selectedSeedPreviewIndex,
    selectedVenue,
  ]);

  async function handleVenueVisibility(venue: AdminVenue, approved: boolean, advance = false) {
    setActionLoading(`venue-${venue.id}`);
    const { data, error } = await setVenueApproved(venue.id, approved);
    setActionLoading(null);
    if (error) {
      alert(error.message);
      return;
    }
    const updated = { ...venue, ...((data ?? {}) as Partial<AdminVenue>), approved };
    setVenues((prev) => prev.map((item) => (item.id === venue.id ? updated : item)));
    setCityVenues((prev) => prev.map((item) => (item.id === venue.id ? updated : item)));
    setSelectedVenue((current) => (current?.id === venue.id ? updated : current));
    recordRecentAction({
      kind: "venue_update",
      label: approved ? "Shown in app" : "Hidden from app",
      detail: `#${venue.id} ${venue.name}`,
      before: venue,
      after: updated,
    });
    if (advance) handleSelectNextQueueItem();
  }

  async function handleVenueReviewState(
    venue: AdminVenue,
    updates: {
      reviewStatus?: AdminVenue["review_status"] | null;
      duplicateOfVenueId?: number | null;
      needsManualPin?: boolean | null;
      notes?: string | null;
      approved?: boolean | null;
    },
    advance = true,
  ) {
    setActionLoading(`venue-${venue.id}`);
    const { data, error } = await setVenueReviewState(venue.id, updates);
    setActionLoading(null);
    if (error) {
      alert(error.message);
      return;
    }
    const updated = {
      ...venue,
      ...((data ?? {}) as Partial<AdminVenue>),
      approved: updates.approved ?? venue.approved,
      review_status: updates.reviewStatus ?? venue.review_status,
      duplicate_of_venue_id: updates.duplicateOfVenueId ?? venue.duplicate_of_venue_id,
      needs_manual_pin: updates.needsManualPin ?? venue.needs_manual_pin,
      admin_review_notes: updates.notes ?? venue.admin_review_notes,
    };
    setVenues((prev) => prev.map((item) => (item.id === venue.id ? updated : item)));
    setCityVenues((prev) => prev.map((item) => (item.id === venue.id ? updated : item)));
    setSelectedVenue((current) => (current?.id === venue.id ? updated : current));
    recordRecentAction({
      kind: "venue_update",
      label: updates.reviewStatus === "duplicate_candidate" ? "Marked duplicate" : "Review state changed",
      detail: `#${venue.id} ${venue.name}`,
      before: venue,
      after: updated,
    });
    if (advance) handleSelectNextQueueItem();
  }

  function handleSeedDraftSkip() {
    if (!selectedSeedPreviewVenue) return;
    const seedKey = getVenueSeedKey(selectedSeedPreviewVenue);
    if (seedKey) {
      setSkippedSeedVenueKeys((current) =>
        current.includes(seedKey) ? current : [...current, seedKey],
      );
      recordRecentAction({
        kind: "skip",
        label: "Skipped seed draft",
        detail: selectedSeedPreviewVenue.name,
        seedKey,
      });
    }
  }

  async function handleCityStatus(active: boolean, expansionStatus: string) {
    if (!selectedCity) return;
    setActionLoading(`city-${selectedCity.city_id}`);
    const { error } = await updateAdminCityReviewStatus(
      selectedCity.city_id,
      active,
      expansionStatus,
    );
    setActionLoading(null);
    if (error) {
      alert(error.message);
      return;
    }
    recordRecentAction({
      kind: "city_status",
      label: active ? "City activated" : "City hidden",
      detail: selectedCity.city_name,
      cityId: selectedCity.city_id,
      before: { active: selectedCity.active, expansionStatus: selectedCity.expansion_status },
      after: { active, expansionStatus },
    });
    await loadCities();
  }

  function handleSaved(updated: AdminVenue, shouldRecordAction = true) {
    const previous = cityVenues.find((venue) => venue.id === updated.id) ?? venues.find((venue) => venue.id === updated.id) ?? null;
    setVenues((prev) => {
      if (prev.some((venue) => venue.id === updated.id)) {
        return prev.map((venue) => (venue.id === updated.id ? { ...venue, ...updated } : venue));
      }
      return [updated, ...prev];
    });
    setCityVenues((prev) => {
      if (prev.some((venue) => venue.id === updated.id)) {
        return prev.map((venue) => (venue.id === updated.id ? { ...venue, ...updated } : venue));
      }
      return [updated, ...prev];
    });
    setSelectedVenue((current) =>
      current?.id === updated.id ? { ...current, ...updated } : current,
    );
    setEditTarget((current) => (current?.id === updated.id ? { ...current, ...updated } : current));
    if (previous && shouldRecordAction) {
      recordRecentAction({
        kind: "venue_update",
        label: "Venue edited",
        detail: `#${updated.id} ${updated.name}`,
        before: previous,
        after: updated,
      });
    }
  }

  async function handleSeedDraftImported(importedVenue: AdminVenue) {
    const currentPreviewIndex = selectedSeedPreviewIndex ?? 0;
    const currentSeedKey = selectedSeedPreviewVenue ? getVenueSeedKey(selectedSeedPreviewVenue) : "";
    const previousVenue = cityVenues.find((venue) => venue.id === importedVenue.id)
      ?? venues.find((venue) => venue.id === importedVenue.id)
      ?? null;
    const remainingPreviewVenues = currentSeedKey
      ? seedPreviewVenues.filter((venue) => getVenueSeedKey(venue) !== currentSeedKey)
      : seedPreviewVenues;

    if (selectedSeedPreviewVenue) {
      const seedKey = getVenueSeedKey(selectedSeedPreviewVenue);
      if (seedKey) {
        setImportedSeedVenueKeys((current) =>
          current.includes(seedKey) ? current : [...current, seedKey],
        );
      }
    }
    handleSaved(importedVenue, false);
    if (currentSeedKey) {
      if (previousVenue) {
        recordRecentAction({
          kind: "venue_update",
          label: "Import updated venue",
          detail: `#${importedVenue.id} ${importedVenue.name}`,
          before: previousVenue,
          after: importedVenue,
          seedKey: currentSeedKey,
        });
      } else {
        recordRecentAction({
          kind: "import",
          label: importedVenue.approved ? "Imported and shown" : "Imported hidden",
          detail: `#${importedVenue.id} ${importedVenue.name}`,
          venue: importedVenue,
          seedKey: currentSeedKey,
        });
      }
    }
    setSelectedCityId(importedVenue.city_id ?? selectedCityId);
    if (remainingPreviewVenues.length) {
      setSelectedVenue(null);
      setSelectedSeedPreviewIndex(Math.min(currentPreviewIndex, remainingPreviewVenues.length - 1));
    } else {
      setSelectedVenue(importedVenue);
      setSelectedSeedPreviewIndex(null);
    }
    await loadCities();
    await loadCityVenues();
  }

  async function handleUndoRecentAction(action: RecentAdminAction) {
    setActionLoading(`undo-${action.id}`);

    if (action.kind === "skip") {
      setSkippedSeedVenueKeys((current) => current.filter((key) => key !== action.seedKey));
      setRecentActions((current) => current.filter((item) => item.id !== action.id));
      setActionLoading(null);
      return;
    }

    if (action.kind === "import") {
      const { error } = await deleteVenue(action.venue.id);
      setActionLoading(null);
      if (error) {
        alert(error.message);
        return;
      }
      setVenues((current) => current.filter((venue) => venue.id !== action.venue.id));
      setCityVenues((current) => current.filter((venue) => venue.id !== action.venue.id));
      setImportedSeedVenueKeys((current) => current.filter((key) => key !== action.seedKey));
      setSelectedVenue((current) => (current?.id === action.venue.id ? null : current));
      setRecentActions((current) => current.filter((item) => item.id !== action.id));
      await loadCities();
      return;
    }

    if (action.kind === "venue_update") {
      const before = action.before;
      const { data, error } = await updateVenue(before.id, {
        name: before.name,
        address: before.address,
        city: before.city,
        city_id: before.city_id ?? null,
        county: before.county ?? null,
        sector: before.sector ?? null,
        type: before.type,
        tables_count: before.tables_count,
        condition: before.condition ?? null,
        hours: before.hours ?? null,
        description: before.description,
        tags: before.tags ?? null,
        photos: before.photos ?? null,
        free_access: before.free_access ?? null,
        night_lighting: before.night_lighting ?? null,
        nets: before.nets ?? null,
        verified: before.verified ?? null,
        tariff: before.tariff ?? null,
        website: before.website ?? null,
        approved: before.approved,
        review_status: before.review_status ?? null,
        duplicate_of_venue_id: before.duplicate_of_venue_id ?? null,
        needs_manual_pin: before.needs_manual_pin ?? null,
        admin_review_notes: before.admin_review_notes ?? null,
        lat: before.lat,
        lng: before.lng,
      });
      setActionLoading(null);
      if (error) {
        alert(error.message);
        return;
      }
      const restored = { ...before, ...((data ?? {}) as Partial<AdminVenue>) };
      setVenues((current) => current.map((venue) => (venue.id === restored.id ? restored : venue)));
      setCityVenues((current) => current.map((venue) => (venue.id === restored.id ? restored : venue)));
      setSelectedVenue((current) => (current?.id === restored.id ? restored : current));
      if (action.seedKey) {
        setImportedSeedVenueKeys((current) => current.filter((key) => key !== action.seedKey));
      }
      setRecentActions((current) => current.filter((item) => item.id !== action.id));
      return;
    }

    const { error } = await updateAdminCityReviewStatus(
      action.cityId,
      action.before.active,
      action.before.expansionStatus,
    );
    setActionLoading(null);
    if (error) {
      alert(error.message);
      return;
    }
    setRecentActions((current) => current.filter((item) => item.id !== action.id));
    await loadCities();
  }

  function handleSelectNextQueueItem() {
    if (selectedSeedPreviewIndex != null && seedPreviewVenues.length) {
      const nextIndex = selectedSeedPreviewIndex + 1;
      if (nextIndex < seedPreviewVenues.length) {
        setSelectedSeedPreviewIndex(nextIndex);
        setSelectedVenue(null);
        return;
      }
    }

    if (selectedVenue) {
      const currentIndex = cityVenues.findIndex((venue) => venue.id === selectedVenue.id);
      const nextVenue = currentIndex >= 0 ? cityVenues[currentIndex + 1] : null;
      if (nextVenue) {
        handleVenueSelect(nextVenue);
        return;
      }
      if (seedPreviewVenues.length) {
        handleSeedPreviewSelect(seedPreviewVenues[0], 0);
        return;
      }
    }

    if (seedPreviewVenues.length) {
      handleSeedPreviewSelect(seedPreviewVenues[0], 0);
      return;
    }

    if (cityVenues.length) handleVenueSelect(cityVenues[0]);
  }

  function handleSelectPreviousQueueItem() {
    if (selectedSeedPreviewIndex != null && seedPreviewVenues.length) {
      if (selectedSeedPreviewIndex > 0) {
        setSelectedSeedPreviewIndex(selectedSeedPreviewIndex - 1);
        setSelectedVenue(null);
        return;
      }
      if (cityVenues.length) {
        handleVenueSelect(cityVenues[cityVenues.length - 1]);
        return;
      }
    }

    if (selectedVenue) {
      const currentIndex = cityVenues.findIndex((venue) => venue.id === selectedVenue.id);
      if (currentIndex > 0) {
        handleVenueSelect(cityVenues[currentIndex - 1]);
        return;
      }
      if (seedPreviewVenues.length) {
        handleSeedPreviewSelect(seedPreviewVenues[seedPreviewVenues.length - 1], seedPreviewVenues.length - 1);
      }
      return;
    }

    if (cityVenues.length) {
      handleVenueSelect(cityVenues[cityVenues.length - 1]);
      return;
    }

    if (seedPreviewVenues.length) {
      handleSeedPreviewSelect(seedPreviewVenues[seedPreviewVenues.length - 1], seedPreviewVenues.length - 1);
    }
  }

  function handleSeedCountryChange(code: string) {
    setSeedCountryCode(code);
    setCityPickerOpen(true);
    setSeedCitySearch("");
    setSelectedReviewCity(null);
    setSelectedSeedPreviewIndex(null);
    setImportedSeedVenueKeys([]);
    setSkippedSeedVenueKeys([]);
    setCountryCode(code);
    setCityVenues([]);
  }

  function handleSeedCitySelect(city: OsmSeedCity, countryOverride?: OsmSeedCountry) {
    const country = countryOverride ?? selectedSeedCountry;
    if (!country) return;
    setSelectedReviewCity({
      countryCode: country.code,
      countryName: getLocalizedCountryName(country.code, locale, country.name),
      cityName: city.name,
      locations: city.locations,
      seedRank: city.rank,
    });
    setSeedCountryCode(country.code);
    setCountryCode(country.code);
    setCitySearch(city.name);
    setStatus("");
    setVenueSearch("");
    setSelectedCityId(null);
    setSelectedVenue(null);
    setSelectedSeedPreviewIndex(0);
    setImportedSeedVenueKeys([]);
    setSkippedSeedVenueKeys([]);
    setVenues([]);
    setCityVenues([]);
    setCityPickerOpen(false);
    setWorkspaceTab("map");
  }

  function handleLiveCitySearchChange(value: string) {
    setCitySearch(value);
    if (
      selectedReviewCity &&
      value.trim().toLowerCase() !== selectedReviewCity.cityName.toLowerCase()
    ) {
      setSelectedReviewCity(null);
      setSelectedSeedPreviewIndex(null);
      setImportedSeedVenueKeys([]);
      setSkippedSeedVenueKeys([]);
      setCityVenues([]);
    }
  }

  function handleLiveCountryChange(value: string) {
    setCountryCode(value);
    if (selectedReviewCity && value !== selectedReviewCity.countryCode) {
      setSelectedReviewCity(null);
      setSelectedSeedPreviewIndex(null);
      setImportedSeedVenueKeys([]);
      setSkippedSeedVenueKeys([]);
      setCityVenues([]);
    }
  }

  function handleLiveStatusChange(value: string) {
    setStatus(value);
    if (selectedReviewCity) {
      setSelectedReviewCity(null);
      setSelectedSeedPreviewIndex(null);
      setImportedSeedVenueKeys([]);
      setSkippedSeedVenueKeys([]);
      setCityVenues([]);
    }
  }

  function handleClearCity() {
    setSelectedReviewCity(null);
    setSelectedCityId(null);
    setSelectedVenue(null);
    setSelectedSeedPreviewIndex(null);
    setImportedSeedVenueKeys([]);
    setSkippedSeedVenueKeys([]);
    setVenues([]);
    setCityVenues([]);
    setCityPickerOpen(true);
  }

  function handleQueueCitySelect(city: AdminCityReviewRow) {
    setSelectedCityId(city.city_id);
    setSelectedVenue(null);
    setSelectedSeedPreviewIndex(null);
    setImportedSeedVenueKeys([]);
    setSkippedSeedVenueKeys([]);
    setCityVenues([]);
    setSelectedReviewCity({
      countryCode: city.country_code,
      countryName: getLocalizedCountryName(city.country_code, locale, city.country_name),
      cityName: city.city_name,
      locations: city.venue_count,
      seedRank: 0,
      cityId: city.city_id,
      lat: city.lat,
      lng: city.lng,
      zoom: city.zoom,
    });
    setCityPickerOpen(false);
    setWorkspaceTab("map");
  }

  function handleVenueSelect(venue: AdminVenue) {
    setSelectedSeedPreviewIndex(null);
    setSelectedVenue(venue);
    setWorkspaceTab("review");
  }

  function handleSeedPreviewSelect(_venue: OsmSeedVenue, index: number) {
    setSelectedVenue(null);
    setSelectedSeedPreviewIndex(index);
    setWorkspaceTab("review");
  }

  function handleSeedPreviewDraftChange(nextDraft: SeedVenueDraft) {
    if (!selectedSeedPreviewDraftKey) return;
    setSeedPreviewDrafts((current) => ({
      ...current,
      [selectedSeedPreviewDraftKey]: nextDraft,
    }));
  }

  function handleSeedPreviewDraftReset() {
    if (!selectedSeedPreviewDraftKey) return;
    setSeedPreviewDrafts((current) => {
      const next = { ...current };
      delete next[selectedSeedPreviewDraftKey];
      return next;
    });
  }

  if (adminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <Loader2 className="h-8 w-8 animate-spin text-moss-700" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper">
        <ShieldAlert className="h-16 w-16 text-ink-300" />
        <h1 className="font-heading text-[26px] font-bold tracking-tight text-ink-900">
          Admin access required
        </h1>
        <p className="text-[14px] text-ink-600">Sign in with an admin account to continue.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-paper lg:h-screen lg:overflow-hidden">
      <header className="border-b border-ink-100 bg-surface px-4 py-2 md:px-5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <Link
              href="../admin"
              className="inline-flex w-fit items-center gap-1 text-[11px] font-semibold text-ink-500 hover:text-moss-800"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Current admin
            </Link>
            <span className="kicker text-clay-700">Venue Review</span>
            <h1 className="font-heading text-[21px] font-bold tracking-tight text-ink-900">
              Location dashboard
            </h1>
            <p className="text-[12px] text-ink-500">
              City queue, map verification, and Supabase-ready review.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-right">
            <Metric label="Venues" value={formatDashboardNumber(totals.venues)} compact />
            <Metric label="Hidden" value={formatDashboardNumber(totals.hidden)} compact />
            <Metric label="Signals" value={formatDashboardNumber(totals.attention)} compact />
          </div>
        </div>
      </header>

      <main className="grid min-h-[calc(100vh-68px)] grid-cols-1 lg:h-[calc(100vh-68px)] lg:grid-cols-[370px_minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-b border-ink-100 bg-surface lg:border-b-0 lg:border-r">
          <div className={`${selectedReviewCity && !cityPickerOpen ? "shrink-0" : "min-h-0 flex-1 overflow-y-auto"}`}>
            <UnifiedCityQueue
              inventory={seedInventory}
              selectedCountry={selectedSeedCountry}
              selectedCountryCode={seedCountryCode}
              citySearch={seedCitySearch}
              cities={seedCities}
              liveCities={cities}
              selectedCityId={selectedCityId}
              selectedReviewCity={selectedReviewCity}
              countries={countries}
              countryLabel={(code, fallback) => getLocalizedCountryName(code, locale, fallback)}
              status={status}
              citiesLoading={citiesLoading}
              cityError={cityError}
              onCountryChange={handleSeedCountryChange}
              onCitySearchChange={(value) => {
                setSeedCitySearch(value);
                handleLiveCitySearchChange(value);
              }}
              onStatusChange={handleLiveStatusChange}
              onCitySelect={handleSeedCitySelect}
              onGlobalCitySelect={(country, city) => handleSeedCitySelect(city, country)}
              onLiveCitySelect={handleQueueCitySelect}
              onRefresh={loadCities}
              collapsed={Boolean(selectedReviewCity) && !cityPickerOpen}
              onChangeCity={() => setCityPickerOpen(true)}
              onCollapse={() => setCityPickerOpen(false)}
            />
          </div>

          {selectedReviewCity ? (
            <div className="flex min-h-0 flex-1 flex-col border-t border-ink-100">
              <VenueQueueBar
                stats={queueStats}
                hasCurrent={Boolean(selectedVenue || selectedSeedPreviewVenue)}
                hasNext={queueStats.seedRemaining + queueStats.supabase > 0}
                hasPrevious={queueStats.seedRemaining + queueStats.supabase > 0}
                onPrevious={handleSelectPreviousQueueItem}
                onNext={handleSelectNextQueueItem}
              />
              <CityCompletionGuard issues={completionIssues} loading={cityVenuesLoading || seedVenueManifestLoading} />
              <RecentActionsPanel
                actions={recentActions}
                loadingActionId={actionLoading?.startsWith("undo-") ? actionLoading.slice(5) : null}
                onUndo={handleUndoRecentAction}
              />
              <div className="min-h-0 flex-1 overflow-y-auto bg-paper/60">
              {cityVenues.length || seedPreviewVenues.length ? (
                <CityVenueList
                  venues={cityVenues}
                  previewVenues={seedPreviewVenues}
                  seedItems={seedReviewItems}
                  liveItems={liveReviewItems}
                  selectedVenueId={selectedVenue?.id ?? null}
                  selectedPreviewIndex={selectedSeedPreviewIndex}
                  venueSources={venueSources}
                  onVenueSelect={handleVenueSelect}
                  onPreviewSelect={handleSeedPreviewSelect}
                />
              ) : (
                <EmptyBlock text="No venues loaded for this city yet." />
              )}
              </div>
            </div>
          ) : null}
        </aside>

        <section className="flex min-h-[640px] min-w-0 flex-col bg-ink-50/50 lg:min-h-0">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-ink-100 bg-surface px-3 py-2">
            <div className="min-w-0">
              <span className="kicker text-ink-500">Workspace</span>
              <h2 className="truncate font-heading text-[17px] font-bold text-ink-900">
                {workspaceTab === "map" ? mapTitle : selectedVenue?.name ?? selectedSeedPreviewDraft?.name ?? "Review venue"}
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {workspaceMapsUrl ? (
                <a
                  href={workspaceMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 bg-paper px-2.5 py-1.5 text-[12px] font-semibold text-ink-700 hover:bg-ink-50"
                >
                  <MapPinned className="h-3.5 w-3.5" />
                  Maps
                </a>
              ) : null}
              {workspaceTab === "review" && selectedReviewCity ? (
                <div className="hidden gap-1.5 md:flex">
                  <button
                    onClick={handleSelectPreviousQueueItem}
                    disabled={queueStats.seedRemaining + queueStats.supabase === 0}
                    className="rounded-md border border-ink-200 px-2.5 py-1.5 text-[12px] font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={handleSelectNextQueueItem}
                    disabled={queueStats.seedRemaining + queueStats.supabase === 0}
                    className="btn-moss rounded-md px-2.5 py-1.5 text-[12px] font-semibold disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              ) : null}
              <div className="inline-flex rounded-md border border-ink-200 bg-paper p-1">
                <button
                  onClick={() => setWorkspaceTab("map")}
                  className={`rounded px-3 py-1.5 text-[12px] font-bold ${workspaceTab === "map" ? "bg-moss-700 text-white" : "text-ink-600 hover:bg-ink-50"}`}
                >
                  Map
                </button>
                <button
                  onClick={() => setWorkspaceTab("review")}
                  disabled={!selectedVenue && !selectedSeedPreviewVenue}
                  className={`rounded px-3 py-1.5 text-[12px] font-bold disabled:opacity-50 ${workspaceTab === "review" ? "bg-moss-700 text-white" : "text-ink-600 hover:bg-ink-50"}`}
                >
                  Review
                </button>
              </div>
            </div>
          </div>

          {workspaceTab === "map" ? (
            <div className="flex min-h-0 flex-1 flex-col">
              {!selectedReviewCity ? (
                <div className="flex min-h-0 flex-1 items-center justify-center bg-paper p-6">
                  <div className="max-w-[520px] rounded-md border border-ink-100 bg-surface p-5 text-center shadow-card">
                    <span className="kicker text-clay-700">Start with a city</span>
                    <h3 className="mt-2 font-heading text-[22px] font-bold text-ink-900">
                      Pick a country, then a city from the left queue
                    </h3>
                    <p className="mt-2 text-[13px] leading-6 text-ink-500">
                      The workspace will switch to that city map, load the OSM seed pins and any Supabase venues, then open the venue queue for review.
                    </p>
                  </div>
                </div>
              ) : (
                <>
              <div className="flex shrink-0 flex-col gap-1.5 border-b border-ink-100 bg-surface p-2.5">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <SelectedCitySummaryCompact selectedCity={selectedReviewCity} metrics={selectedCityMetrics} />
                  {selectedCity ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusPill label={selectedCity.active ? selectedCity.expansion_status : "hidden"} tone={selectedCity.active ? "ok" : "neutral"} />
                      <button
                        onClick={() => handleCityStatus(true, "active")}
                        disabled={actionLoading === `city-${selectedCity.city_id}` || (selectedCity.active && selectedCity.expansion_status === "active")}
                        className="btn-moss inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-semibold disabled:opacity-60"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Activate city
                      </button>
                      <button
                        onClick={() => handleCityStatus(false, "hidden")}
                        disabled={actionLoading === `city-${selectedCity.city_id}` || (!selectedCity.active && selectedCity.expansion_status === "hidden")}
                        className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 px-2.5 py-1.5 text-[12px] font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-60"
                      >
                        <EyeOff className="h-3.5 w-3.5" />
                        Hide city
                      </button>
                    </div>
                  ) : null}
                </div>

                {selectedReviewCity && !selectedCity ? (
                  <div className="rounded-md border border-clay-100 bg-clay-50 px-2.5 py-1.5 text-[11.5px] font-semibold text-clay-700">
                    Previewing {seedVenueManifestLoading ? "the local OSM seed file" : `${formatDashboardNumber(seedPreviewVenues.length || selectedReviewCity.locations)} OSM seed pins`} for {selectedReviewCity.cityName}.
                  </div>
                ) : null}

                <div className="flex flex-col gap-1.5 rounded-md border border-ink-100 bg-paper p-1.5 min-[1180px]:flex-row min-[1180px]:items-center">
                  <PinSourceLegend counts={venueSourceCounts} seedCount={selectedSeedVenues.length} previewCount={seedPreviewVenues.length} loading={seedVenueManifestLoading} />
                  <SearchField value={venueSearch} onChange={setVenueSearch} placeholder="Search visible map venues" />
                  <select value={venueType} onChange={(event) => setVenueType(event.target.value)} className="input-control min-[1180px]:w-[126px]">
                    {venueTypes.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <select value={visibility} onChange={(event) => setVisibility(event.target.value)} className="input-control min-[1180px]:w-[136px]">
                    {visibilityOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as VenueImportSource | "")} className="input-control min-[1180px]:w-[126px]">
                    {sourceOptions.map((option) => (
                      <option key={option.value || "all"} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <label className="inline-flex min-h-[36px] items-center gap-2 rounded-md border border-ink-200 bg-paper px-2.5 text-[12px] font-semibold text-ink-700 min-[1180px]:w-[152px]">
                    <input type="checkbox" checked={needsAttention} onChange={(event) => setNeedsAttention(event.target.checked)} className="h-4 w-4 accent-moss-700" />
                    <Filter className="h-3.5 w-3.5" />
                    Needs attention
                  </label>
                </div>
              </div>

              <div className="relative min-h-[360px] flex-1 overflow-hidden">
                <AdminVenueMap
                  city={selectedCity}
                  seedCity={selectedSeedCityFocus}
                  seedPreviewVenues={seedPreviewVenues}
                  venues={mapVenues}
                  venueSources={venueSources}
                  selectedVenueId={selectedVenue?.id ?? null}
                  selectedSeedPreviewIndex={selectedSeedPreviewIndex}
                  onBoundsChange={setBounds}
                  onVenueSelect={handleVenueSelect}
                  onSeedPreviewSelect={handleSeedPreviewSelect}
                />
                <div className="pointer-events-none absolute left-4 top-4 rounded-md border border-ink-100 bg-surface/95 px-3 py-2 text-[12px] font-semibold text-ink-700 shadow-card">
                  {venuesLoading ? "Loading map pins" : `${formatDashboardNumber(venues.length + seedPreviewVenues.length)} visible map pins`}
                </div>
                {venueError ? (
                  <div className="absolute bottom-4 left-4 right-4 rounded-md bg-clay-600 px-3 py-2 text-[13px] font-semibold text-paper">
                    {venueError}
                  </div>
                ) : null}
              </div>
                </>
              )}
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto bg-surface">
              {selectedVenue ? (
                <VenueDetail
                  venue={selectedVenue}
                  context={reviewContext}
                  reviewLoading={reviewLoading}
                  actionLoading={actionLoading === `venue-${selectedVenue.id}`}
                  onEdit={() => setEditTarget(selectedVenue)}
                  onShow={() => handleVenueVisibility(selectedVenue, true)}
                  onHide={() => handleVenueVisibility(selectedVenue, false)}
                  onApproveNext={() => handleVenueVisibility(selectedVenue, true, true)}
                  onHideNext={() => handleVenueVisibility(selectedVenue, false, true)}
                  onMarkDuplicate={(duplicateOfVenueId) =>
                    handleVenueReviewState(
                      selectedVenue,
                      {
                        reviewStatus: "duplicate_candidate",
                        duplicateOfVenueId,
                        approved: false,
                        notes: duplicateOfVenueId ? `Possible duplicate of venue #${duplicateOfVenueId}.` : "Marked as possible duplicate.",
                      },
                      true,
                    )
                  }
                  onSaved={handleSaved}
                  source={venueSources[selectedVenue.id] ?? "unknown"}
                  nearestVenue={liveReviewItems.find((item) => item.kind === "venue" && item.venue.id === selectedVenue.id)?.nearest ?? null}
                />
              ) : selectedSeedPreviewVenue && selectedSeedPreviewDraft && selectedReviewCity ? (
                <SeedPreviewDetail
                  venue={selectedSeedPreviewVenue}
                  draft={selectedSeedPreviewDraft}
                  city={selectedReviewCity}
                  seedCityFocus={selectedSeedCityFocus}
                  onDraftChange={handleSeedPreviewDraftChange}
                  onReset={handleSeedPreviewDraftReset}
                  onSkip={handleSeedDraftSkip}
                  onImported={handleSeedDraftImported}
                  nearestVenue={seedReviewItems.find((item) => item.index === selectedSeedPreviewIndex)?.nearest ?? null}
                />
              ) : (
                <div className="p-6">
                  <p className="rounded-md border border-dashed border-ink-200 bg-paper px-3 py-8 text-center text-[12.5px] text-ink-400">
                    Select a venue from the side queue or map to start reviewing.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      <VenueRecordEditor
        venue={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={handleSaved}
      />
    </div>
  );
}

function VenueQueueBar({
  stats,
  hasCurrent,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
}: {
  stats: {
    supabase: number;
    mapSupabase: number;
    seedRemaining: number;
    seedTotal: number;
    seedImported: number;
    ready: number;
    duplicates: number;
    needsEdit: number;
    reviewed: number;
  };
  hasCurrent: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <section className="shrink-0 border-b border-ink-100 bg-paper px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="kicker text-moss-700">Venue queue</span>
          <p className="truncate text-[11px] font-semibold text-ink-500">
            {formatDashboardNumber(stats.seedRemaining)} left / {formatDashboardNumber(stats.ready)} ready /{" "}
            {formatDashboardNumber(stats.duplicates)} dupes / {formatDashboardNumber(stats.needsEdit)} needs edit
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={onPrevious}
            disabled={!hasPrevious}
            className="rounded-md border border-ink-200 px-2.5 py-1.5 text-[12px] font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={onNext}
            disabled={!hasNext}
            className="btn-moss rounded-md px-2.5 py-1.5 text-[12px] font-semibold disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
      <p className="mt-1.5 truncate text-[11px] font-semibold text-ink-400">
        {formatDashboardNumber(stats.supabase)} city records /{" "}
        {formatDashboardNumber(stats.mapSupabase)} visible map records /{" "}
        {formatDashboardNumber(stats.seedImported)} handled from seed /{" "}
        {formatDashboardNumber(stats.reviewed)} reviewed records
      </p>
      {stats.seedTotal ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100">
          <div
            className="h-full bg-moss-700"
            style={{
              width: `${Math.min(100, Math.round((stats.seedImported / stats.seedTotal) * 100))}%`,
            }}
          />
        </div>
      ) : null}
    </section>
  );
}

function CityCompletionGuard({
  issues,
  loading,
}: {
  issues: {
    highConfidenceDuplicates: number;
    reviewNeedsEdit: number;
    remainingDrafts: number;
    canMarkComplete: boolean;
  };
  loading: boolean;
}) {
  const blockers = [
    issues.highConfidenceDuplicates
      ? `${formatDashboardNumber(issues.highConfidenceDuplicates)} high-confidence duplicate${issues.highConfidenceDuplicates === 1 ? "" : "s"}`
      : null,
    issues.reviewNeedsEdit
      ? `${formatDashboardNumber(issues.reviewNeedsEdit)} item${issues.reviewNeedsEdit === 1 ? "" : "s"} need edit`
      : null,
    issues.remainingDrafts
      ? `${formatDashboardNumber(issues.remainingDrafts)} seed draft${issues.remainingDrafts === 1 ? "" : "s"} left`
      : null,
  ].filter(Boolean);

  return (
    <section
      className={`shrink-0 border-b px-3 py-2 ${
        issues.canMarkComplete ? "border-moss-100 bg-moss-50/70" : "border-clay-100 bg-clay-50/50"
      }`}
    >
      <div className="flex items-start gap-2">
        {issues.canMarkComplete ? (
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-moss-700" />
        ) : (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-clay-700" />
        )}
        <div className="min-w-0">
          <p className={`text-[12px] font-bold ${issues.canMarkComplete ? "text-moss-800" : "text-clay-800"}`}>
            {loading ? "Checking city completion" : issues.canMarkComplete ? "City is ready to close" : "City still needs review"}
          </p>
          <p className="mt-0.5 truncate text-[11px] font-semibold text-ink-500">
            {loading ? "Loading city-wide records and seed manifest." : blockers.length ? blockers.join(" / ") : "No duplicate or edit blockers detected."}
          </p>
        </div>
      </div>
    </section>
  );
}

function RecentActionsPanel({
  actions,
  loadingActionId,
  onUndo,
}: {
  actions: RecentAdminAction[];
  loadingActionId: string | null;
  onUndo: (action: RecentAdminAction) => void;
}) {
  if (!actions.length) return null;

  return (
    <section className="shrink-0 border-b border-ink-100 bg-surface px-3 py-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 kicker text-ink-500">
          <History className="h-3.5 w-3.5" />
          Recent admin actions
        </span>
        <span className="text-[10.5px] font-bold uppercase text-ink-400">This session</span>
      </div>
      <div className="flex flex-col gap-1">
        {actions.slice(0, 3).map((action) => (
          <div key={action.id} className="flex items-center justify-between gap-2 rounded-md bg-paper px-2 py-1.5">
            <div className="min-w-0">
              <p className="truncate text-[11.5px] font-bold text-ink-800">{action.label}</p>
              <p className="truncate text-[10.5px] font-semibold text-ink-400">{action.detail}</p>
            </div>
            <button
              onClick={() => onUndo(action)}
              disabled={loadingActionId === action.id}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-ink-200 bg-surface px-2 py-1 text-[10.5px] font-bold text-ink-700 hover:bg-ink-50 disabled:opacity-60"
            >
              {loadingActionId === action.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
              Undo
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

type QueueBucket = "duplicate" | "needs_edit" | "ready" | "approved" | "hidden";

type SeedReviewItem = {
  kind: "seed";
  venue: OsmSeedVenue;
  index: number;
  bucket: QueueBucket;
  flags: string[];
  nearest: DuplicateVenueCandidate | null;
};

type LiveReviewItem = {
  kind: "venue";
  venue: AdminVenue;
  bucket: QueueBucket;
  flags: ReturnType<typeof getVenueAttentionFlags>;
  nearest: DuplicateVenueCandidate | null;
};

function findNearestVenueForSeed(
  venue: OsmSeedVenue,
  candidates: AdminVenue[],
  maxDistanceMeters = 120,
  maxNameMatchDistanceMeters = 700,
) {
  let nearest: DuplicateVenueCandidate | null = null;
  candidates.forEach((candidate) => {
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

function getSeedVenueFlags(
  venue: OsmSeedVenue,
  nearest: { venue: AdminVenue; distanceMeters: number } | null,
) {
  const flags: string[] = [];
  if (!venue.address?.trim()) flags.push("Missing address");
  if (!venue.type) flags.push("Missing type");
  if (!Number.isFinite(venue.lat) || !Number.isFinite(venue.lng)) flags.push("Missing coordinates");
  if (nearest && (nearest.distanceMeters <= 65 || isVenueDuplicateNameMatch(nearest.venue.name, venue.name))) {
    flags.push("Likely duplicate");
  }
  return flags;
}

function getSeedVenueBucket(
  venue: OsmSeedVenue,
  nearest: { venue: AdminVenue; distanceMeters: number } | null,
): QueueBucket {
  const flags = getSeedVenueFlags(venue, nearest);
  if (flags.includes("Likely duplicate")) return "duplicate";
  if (flags.length) return "needs_edit";
  return "ready";
}

function getLiveVenueBucket(
  venue: AdminVenue,
  nearest: DuplicateVenueCandidate | null,
): QueueBucket {
  if (venue.review_status === "duplicate_candidate" || venue.duplicate_of_venue_id) return "duplicate";
  if (nearest && (nearest.distanceMeters <= 65 || isVenueDuplicateNameMatch(venue.name, nearest.venue.name))) return "duplicate";
  if (venueNeedsAttention(venue)) return "needs_edit";
  return venue.approved ? "approved" : "hidden";
}

function normalizedVenueName(name: string | null | undefined) {
  return normalizeVenueDuplicateName(name);
}

function getDuplicateCandidateLabel(candidate: DuplicateVenueCandidate) {
  const reason =
    candidate.reason === "name_and_location"
      ? "same normalized name and nearby"
      : candidate.reason === "same_name"
        ? "same normalized name"
        : "nearby";
  return `${reason}, ${candidate.distanceMeters}m away, ${candidate.confidence} confidence`;
}

function queueGroupBg(tone: "warn" | "danger" | "ok" | "neutral") {
  if (tone === "danger") return "bg-clay-50/80";
  if (tone === "warn") return "bg-amber-50/80";
  if (tone === "ok") return "bg-moss-50/80";
  return "bg-ink-50/80";
}

function bucketLabel(bucket: QueueBucket) {
  if (bucket === "duplicate") return "duplicate?";
  if (bucket === "needs_edit") return "needs edit";
  if (bucket === "ready") return "ready";
  if (bucket === "approved") return "approved";
  return "hidden";
}

function bucketTone(bucket: QueueBucket): "ok" | "warn" | "danger" | "neutral" {
  if (bucket === "duplicate") return "danger";
  if (bucket === "needs_edit") return "warn";
  if (bucket === "ready" || bucket === "approved") return "ok";
  return "neutral";
}

function SeedQueueRow({
  item,
  selected,
  onSelect,
}: {
  item: SeedReviewItem;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-start justify-between gap-2 border-b border-ink-100 px-3 py-2 text-left hover:bg-clay-50 ${
        selected ? "bg-clay-50" : ""
      }`}
    >
      <div className="min-w-0">
        <p className="truncate text-[12.5px] font-semibold text-ink-900">{item.venue.name}</p>
        <p className="line-clamp-1 text-[11px] text-ink-500">
          {item.venue.address ?? "No address"}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          <StatusPill label="OSM draft" tone="warn" />
          <StatusPill label={bucketLabel(item.bucket)} tone={bucketTone(item.bucket)} />
          {item.nearest ? (
            <StatusPill label={`#${item.nearest.venue.id} ${item.nearest.confidence}`} tone="danger" />
          ) : null}
        </div>
      </div>
      <span className="rounded-md bg-clay-100 px-2 py-0.5 text-[10.5px] font-bold tabular-nums text-clay-700">
        OSM
      </span>
    </button>
  );
}

function LiveQueueRow({
  item,
  selected,
  source,
  onSelect,
}: {
  item: LiveReviewItem;
  selected: boolean;
  source: VenueImportSource;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-start justify-between gap-2 border-b border-ink-100 px-3 py-2 text-left hover:bg-ink-50 ${
        selected ? "bg-moss-50" : ""
      }`}
    >
      <div className="min-w-0">
        <p className="truncate text-[12.5px] font-semibold text-ink-900">{item.venue.name}</p>
        <p className="line-clamp-1 text-[11px] text-ink-500">
          {item.venue.address ?? "No address"}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          <SourcePill source={source} />
          <StatusPill label={bucketLabel(item.bucket)} tone={bucketTone(item.bucket)} />
          {item.nearest ? (
            <StatusPill label={`#${item.nearest.venue.id} ${item.nearest.confidence}`} tone="danger" />
          ) : null}
          <AttentionChips flags={item.flags.slice(0, 2)} compact />
        </div>
      </div>
      <StatusPill label={item.venue.approved ? "shown" : "hidden"} tone={item.venue.approved ? "ok" : "neutral"} />
    </button>
  );
}

function CityVenueList({
  venues,
  previewVenues,
  seedItems,
  liveItems,
  selectedVenueId,
  selectedPreviewIndex,
  venueSources,
  onVenueSelect,
  onPreviewSelect,
}: {
  venues: AdminVenue[];
  previewVenues: OsmSeedVenue[];
  seedItems: SeedReviewItem[];
  liveItems: LiveReviewItem[];
  selectedVenueId: number | null;
  selectedPreviewIndex: number | null;
  venueSources: Record<number, VenueImportSource>;
  onVenueSelect: (venue: AdminVenue) => void;
  onPreviewSelect: (venue: OsmSeedVenue, index: number) => void;
}) {
  const groups: Array<{ title: string; tone: "warn" | "danger" | "ok" | "neutral"; items: Array<SeedReviewItem | LiveReviewItem> }> = [
    {
      title: "Likely duplicates",
      tone: "danger",
      items: [
        ...seedItems.filter((item) => item.bucket === "duplicate"),
        ...liveItems.filter((item) => item.bucket === "duplicate"),
      ],
    },
    {
      title: "Needs edit",
      tone: "warn",
      items: [
        ...seedItems.filter((item) => item.bucket === "needs_edit"),
        ...liveItems.filter((item) => item.bucket === "needs_edit"),
      ],
    },
    {
      title: "Ready to import",
      tone: "ok",
      items: seedItems.filter((item) => item.bucket === "ready"),
    },
    {
      title: "Supabase reviewed",
      tone: "neutral",
      items: liveItems.filter((item) => item.bucket === "approved" || item.bucket === "hidden"),
    },
  ];
  const shownCount = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <section>
      <div className="sticky top-0 z-10 border-b border-ink-100 bg-surface px-3 py-2.5">
        <span className="kicker text-ink-500">Queue items</span>
        <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-semibold text-ink-500">
          <span>{formatDashboardNumber(venues.length)} Supabase</span>
          <span>{formatDashboardNumber(previewVenues.length)} OSM drafts left</span>
        </div>
      </div>

      {groups.map((group) =>
        group.items.length ? (
          <div key={group.title}>
            <div className={`border-b border-ink-100 px-3 py-2 ${queueGroupBg(group.tone)}`}>
              <span className="text-[11px] font-bold uppercase text-ink-700">
                {group.title} / {formatDashboardNumber(group.items.length)}
              </span>
            </div>
            {group.items.slice(0, 180).map((item) =>
              item.kind === "seed" ? (
                <SeedQueueRow
                  key={`preview-list-${item.venue.name}-${item.venue.lat}-${item.venue.lng}-${item.index}`}
                  item={item}
                  selected={selectedPreviewIndex === item.index}
                  onSelect={() => onPreviewSelect(item.venue, item.index)}
                />
              ) : (
                <LiveQueueRow
                  key={item.venue.id}
                  item={item}
                  selected={selectedVenueId === item.venue.id}
                  source={venueSources[item.venue.id] ?? "unknown"}
                  onSelect={() => onVenueSelect(item.venue)}
                />
              ),
            )}
          </div>
        ) : null,
      )}

      {venues.length + previewVenues.length > shownCount ? (
        <div className="px-3 py-3 text-[11px] font-semibold text-ink-400">
          Some locations are hidden by queue grouping or panel limits. Use map/search filters to narrow the city.
        </div>
      ) : null}
    </section>
  );
}

function SeedPreviewDetail({
  venue,
  draft,
  city,
  seedCityFocus,
  onDraftChange,
  onReset,
  onSkip,
  onImported,
  nearestVenue,
}: {
  venue: OsmSeedVenue;
  draft: SeedVenueDraft;
  city: NonNullable<SeedCitySelection>;
  seedCityFocus: AdminSeedCityFocus | null;
  onDraftChange: (draft: SeedVenueDraft) => void;
  onReset: () => void;
  onSkip: () => void;
  onImported: (venue: AdminVenue) => void;
  nearestVenue: DuplicateVenueCandidate | null;
}) {
  const mapsUrl = googleMapsVenueUrl({
    name: draft.name,
    address: draft.address,
    city: draft.city,
    lat: quickNumberOrNull(draft.lat),
    lng: quickNumberOrNull(draft.lng),
  });
  const coordinates = `${Number(draft.lat).toFixed(6)}, ${Number(draft.lng).toFixed(6)}`;
  const mappedPayload = useMemo(() => seedDraftToVenuePayload(draft), [draft]);
  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(seedVenueToDraft(venue)),
    [draft, venue],
  );
  const detectedDuplicateId = quickNumberOrNull(draft.duplicateOfVenueId) ?? nearestVenue?.venue.id ?? null;
  const [importing, setImporting] = useState<"hidden" | "shown" | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (!nearestVenue || draft.duplicateOfVenueId) return;
    if (nearestVenue.confidence !== "high") return;
    onDraftChange({
      ...draft,
      duplicateOfVenueId: String(nearestVenue.venue.id),
      notes:
        draft.notes ||
        `Likely duplicate of venue #${nearestVenue.venue.id} (${getDuplicateCandidateLabel(nearestVenue)}).`,
    });
  }, [draft, nearestVenue, onDraftChange]);

  function update<K extends keyof SeedVenueDraft>(key: K, value: SeedVenueDraft[K]) {
    onDraftChange({ ...draft, [key]: value });
  }

  async function copyCoordinates() {
    await navigator.clipboard?.writeText(coordinates);
  }

  async function copyMappedPayload() {
    await navigator.clipboard?.writeText(JSON.stringify(mappedPayload, null, 2));
  }

  async function importDraft(showInApp: boolean) {
    if (!draft.name.trim()) {
      setImportError("Name is required before import.");
      return;
    }
    if (!draft.address.trim()) {
      setImportError("Address is required before import.");
      return;
    }
    if (mappedPayload.lat == null || mappedPayload.lng == null) {
      setImportError("Valid coordinates are required before import.");
      return;
    }

    setImporting(showInApp ? "shown" : "hidden");
    setImportError(null);
    const { data, error } = await importOsmSeedVenue(
      city.countryCode,
      getCanonicalCountryName(city.countryCode, city.countryName),
      city.cityName,
      seedCityFocus?.lat ?? null,
      seedCityFocus?.lng ?? null,
      seedCityFocus?.zoom ?? 12,
      {
        ...mappedPayload,
        approved: showInApp,
        review_status: showInApp ? "approved" : mappedPayload.review_status,
      },
      showInApp,
    );
    setImporting(null);

    if (error) {
      setImportError(error.message);
      return;
    }

    onImported(data as AdminVenue);
  }

  async function markDuplicate() {
    const duplicateId = quickNumberOrNull(draft.duplicateOfVenueId) ?? nearestVenue?.venue.id ?? null;
    if (!duplicateId) {
      setImportError("No duplicate target was detected for this draft.");
      return;
    }
    const nextDraft = {
      ...draft,
      approved: false,
      reviewStatus: "duplicate_candidate" as const,
      duplicateOfVenueId: String(duplicateId),
      notes:
        draft.notes ||
        (nearestVenue
          ? `Likely duplicate of venue #${duplicateId} (${getDuplicateCandidateLabel(nearestVenue)}).`
          : `Possible duplicate of venue #${duplicateId}.`),
    };
    onDraftChange(nextDraft);
    setImporting("hidden");
    setImportError(null);
    const { data, error } = await importOsmSeedVenue(
      city.countryCode,
      getCanonicalCountryName(city.countryCode, city.countryName),
      city.cityName,
      seedCityFocus?.lat ?? null,
      seedCityFocus?.lng ?? null,
      seedCityFocus?.zoom ?? 12,
      seedDraftToVenuePayload(nextDraft),
      false,
    );
    setImporting(null);
    if (error) {
      setImportError(error.message);
      return;
    }
    onImported(data as AdminVenue);
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="kicker text-clay-700">OSM import draft</span>
          <h3 className="font-heading text-[18px] font-bold leading-tight text-ink-900">
            {draft.name}
          </h3>
          <p className="mt-1 text-[12.5px] text-ink-500">
            {[draft.address, draft.city].filter(Boolean).join(", ") || "No address"}
          </p>
        </div>
        <StatusPill label="not imported" tone="warn" />
      </div>

      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-y border-ink-100 bg-surface/95 py-2 backdrop-blur">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-[11.5px] font-semibold text-ink-500">
            Review mapped DB fields, then import or skip.
          </span>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 bg-paper px-2.5 py-1.5 text-[12px] font-semibold text-ink-700 hover:bg-ink-50"
          >
            <MapPinned className="h-3.5 w-3.5" />
            Maps
          </a>
          <button
            onClick={copyCoordinates}
            className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 bg-paper px-2.5 py-1.5 text-[12px] font-semibold text-ink-700 hover:bg-ink-50"
          >
            <Clipboard className="h-3.5 w-3.5" />
            Coordinates
          </button>
          <button
            onClick={copyMappedPayload}
            className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 bg-paper px-2.5 py-1.5 text-[12px] font-semibold text-ink-700 hover:bg-ink-50"
          >
            <Clipboard className="h-3.5 w-3.5" />
            Payload
          </button>
          {dirty ? (
            <button
              onClick={onReset}
              className="inline-flex items-center gap-1.5 rounded-md border border-clay-200 px-2.5 py-1.5 text-[12px] font-semibold text-clay-700 hover:bg-clay-50"
            >
              <X className="h-3.5 w-3.5" />
              Reset
            </button>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            onClick={onSkip}
            disabled={importing !== null}
            className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 px-2.5 py-1.5 text-[12px] font-semibold text-ink-600 hover:bg-ink-50 disabled:opacity-60"
          >
            Skip
          </button>
          <button
            onClick={markDuplicate}
            disabled={importing !== null || !detectedDuplicateId}
            className="inline-flex items-center gap-1.5 rounded-md border border-clay-200 px-2.5 py-1.5 text-[12px] font-semibold text-clay-700 hover:bg-clay-50 disabled:opacity-60"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            {detectedDuplicateId
              ? `Duplicate of #${detectedDuplicateId}`
              : "No duplicate"}
          </button>
          <button
            onClick={() => importDraft(false)}
            disabled={importing !== null}
            className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 bg-paper px-2.5 py-1.5 text-[12px] font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-60"
          >
            {importing === "hidden" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
            Import hidden
          </button>
          <button
            onClick={() => importDraft(true)}
            disabled={importing !== null}
            className="btn-moss inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-semibold disabled:opacity-60"
          >
            {importing === "shown" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Import & show
          </button>
        </div>
      </div>

      {nearestVenue ? (
        <div className="rounded-md border border-clay-200 bg-clay-50 px-3 py-2 text-[12px] text-clay-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold">Detected duplicate target</p>
              <p className="mt-0.5">
                #{nearestVenue.venue.id} {nearestVenue.venue.name} /{" "}
                {getDuplicateCandidateLabel(nearestVenue)}
              </p>
            </div>
            <button
              onClick={() => update("duplicateOfVenueId", String(nearestVenue.venue.id))}
              className="rounded-md border border-clay-200 bg-paper px-2 py-1 text-[11px] font-bold text-clay-700 hover:bg-clay-50"
            >
              Use ID
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-md border border-clay-100 bg-clay-50/30 p-3">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <span className="kicker text-clay-700">Mapped venue fields</span>
            <h4 className="font-heading text-[14px] font-bold text-ink-900">
              Values to review before import
            </h4>
          </div>
          {dirty ? <StatusPill label="draft edited" tone="warn" /> : null}
        </div>

        <div className="grid gap-2.5">
          <QuickField label="Name">
            <input value={draft.name} onChange={(event) => update("name", event.target.value)} className="editor-input" />
          </QuickField>
          <QuickField label="Address">
            <input value={draft.address} onChange={(event) => update("address", event.target.value)} className="editor-input" />
          </QuickField>
          <div className="grid grid-cols-2 gap-2">
            <QuickField label="City">
              <input value={draft.city} onChange={(event) => update("city", event.target.value)} className="editor-input" />
            </QuickField>
            <QuickField label="County / region">
              <input value={draft.county} onChange={(event) => update("county", event.target.value)} className="editor-input" />
            </QuickField>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <QuickField label="Type">
              <select value={draft.type} onChange={(event) => update("type", event.target.value)} className="editor-input">
                <option value="parc_exterior">Outdoor</option>
                <option value="sala_indoor">Indoor</option>
              </select>
            </QuickField>
            <QuickField label="Tables">
              <input type="number" min={0} value={draft.tablesCount} onChange={(event) => update("tablesCount", event.target.value)} className="editor-input" />
            </QuickField>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <QuickField label="Latitude">
              <input type="number" step="any" value={draft.lat} onChange={(event) => update("lat", event.target.value)} className="editor-input" />
            </QuickField>
            <QuickField label="Longitude">
              <input type="number" step="any" value={draft.lng} onChange={(event) => update("lng", event.target.value)} className="editor-input" />
            </QuickField>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <QuickField label="Condition">
              <select value={draft.condition} onChange={(event) => update("condition", event.target.value)} className="editor-input">
                <option value="necunoscuta">Unknown</option>
                <option value="buna">Good</option>
                <option value="acceptabila">Acceptable</option>
                <option value="deteriorata">Damaged</option>
                <option value="profesionala">Professional</option>
              </select>
            </QuickField>
            <QuickField label="Review status">
              <select value={draft.reviewStatus} onChange={(event) => update("reviewStatus", event.target.value as SeedVenueDraft["reviewStatus"])} className="editor-input">
                {reviewStatusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </QuickField>
          </div>
          <details className="rounded-md border border-ink-100 bg-paper px-3 py-2">
            <summary className="cursor-pointer text-[12px] font-bold text-ink-700">Details, admin notes, and source tools</summary>
            <div className="mt-3 grid gap-2.5">
              <QuickField label="Description">
                <textarea value={draft.description} onChange={(event) => update("description", event.target.value)} rows={1} className="editor-input resize-none" />
              </QuickField>
              <div className="grid grid-cols-2 gap-2">
                <label className="inline-flex min-h-[36px] items-center justify-between gap-3 rounded-md border border-ink-200 bg-paper px-2.5 text-[12px] font-semibold text-ink-700">
                  Free access
                  <input type="checkbox" checked={draft.freeAccess} onChange={(event) => update("freeAccess", event.target.checked)} className="h-4 w-4 accent-moss-700" />
                </label>
                <label className="inline-flex min-h-[36px] items-center justify-between gap-3 rounded-md border border-ink-200 bg-paper px-2.5 text-[12px] font-semibold text-ink-700">
                  Night lighting
                  <input type="checkbox" checked={draft.nightLighting} onChange={(event) => update("nightLighting", event.target.checked)} className="h-4 w-4 accent-moss-700" />
                </label>
                <label className="inline-flex min-h-[36px] items-center justify-between gap-3 rounded-md border border-ink-200 bg-paper px-2.5 text-[12px] font-semibold text-ink-700">
                  Nets
                  <input type="checkbox" checked={draft.nets} onChange={(event) => update("nets", event.target.checked)} className="h-4 w-4 accent-moss-700" />
                </label>
                <label className="inline-flex min-h-[36px] items-center justify-between gap-3 rounded-md border border-ink-200 bg-paper px-2.5 text-[12px] font-semibold text-ink-700">
                  Verified
                  <input type="checkbox" checked={draft.verified} onChange={(event) => update("verified", event.target.checked)} className="h-4 w-4 accent-moss-700" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="inline-flex min-h-[36px] items-center justify-between gap-3 rounded-md border border-ink-200 bg-paper px-2.5 text-[12px] font-semibold text-ink-700">
                  Show in app after import
                  <input type="checkbox" checked={draft.approved} onChange={(event) => update("approved", event.target.checked)} className="h-4 w-4 accent-moss-700" />
                </label>
                <label className="inline-flex min-h-[36px] items-center justify-between gap-3 rounded-md border border-ink-200 bg-paper px-2.5 text-[12px] font-semibold text-ink-700">
                  Needs pin fix
                  <input type="checkbox" checked={draft.needsManualPin} onChange={(event) => update("needsManualPin", event.target.checked)} className="h-4 w-4 accent-moss-700" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <QuickField label="Duplicate of ID">
                  <input type="number" min={1} value={draft.duplicateOfVenueId} onChange={(event) => update("duplicateOfVenueId", event.target.value)} className="editor-input" placeholder="Optional" />
                </QuickField>
                <QuickField label="Admin notes">
                  <input value={draft.notes} onChange={(event) => update("notes", event.target.value)} className="editor-input" placeholder="Internal only" />
                </QuickField>
              </div>
            </div>
          </details>
        </div>
      </div>

      {importError ? (
        <p className="rounded-md bg-clay-50 px-2.5 py-1.5 text-[12px] font-semibold text-clay-700">
          {importError}
        </p>
      ) : null}

      <div className="rounded-md border border-ink-100 bg-paper p-3">
        <div className="grid grid-cols-2 gap-2 text-[12px] text-ink-600">
          <Info label="Source" value="OSM seed" />
          <Info label="Supabase row" value="Not created yet" />
          <Info label="Original name" value={venue.name} />
          <Info label="Original address" value={venue.address ?? "Missing"} />
        </div>
      </div>
    </div>
  );
}

type QuickVenueForm = {
  name: string;
  address: string;
  type: string;
  tablesCount: string;
  condition: string;
  lat: string;
  lng: string;
  approved: boolean;
  reviewStatus: NonNullable<AdminVenue["review_status"]>;
  needsManualPin: boolean;
  duplicateOfVenueId: string;
  notes: string;
};

function getSeedPreviewDraftKey(venue: OsmSeedVenue, index: number) {
  return `${venue.city}|${venue.name}|${venue.lat}|${venue.lng}`;
}

function seedVenueToDraft(venue: OsmSeedVenue): SeedVenueDraft {
  const nameParts = extractVenueTableCountFromName(venue.name);
  return {
    name: nameParts.name,
    type: venue.type || "parc_exterior",
    city: venue.city ?? "",
    county: venue.county ?? "",
    address: venue.address ?? "",
    lat: String(venue.lat),
    lng: String(venue.lng),
    tablesCount: String(nameParts.tableCount ?? 1),
    condition: "necunoscuta",
    description: "",
    freeAccess: true,
    nightLighting: false,
    nets: true,
    verified: false,
    approved: false,
    reviewStatus: "pending",
    needsManualPin: false,
    duplicateOfVenueId: "",
    notes: "",
  };
}

function seedDraftToVenuePayload(draft: SeedVenueDraft) {
  return {
    name: draft.name.trim(),
    type: draft.type || "parc_exterior",
    city: draft.city.trim(),
    county: quickEmptyToNull(draft.county),
    sector: null,
    address: draft.address.trim(),
    lat: quickNumberOrNull(draft.lat),
    lng: quickNumberOrNull(draft.lng),
    tables_count: quickNumberOrNull(draft.tablesCount) ?? 1,
    condition: draft.condition || "necunoscuta",
    hours: null,
    description: quickEmptyToNull(draft.description),
    tags: [],
    photos: [],
    free_access: draft.freeAccess,
    night_lighting: draft.nightLighting,
    nets: draft.nets,
    verified: draft.verified,
    approved: draft.approved,
    tariff: null,
    website: null,
    review_status: draft.reviewStatus,
    duplicate_of_venue_id: quickNumberOrNull(draft.duplicateOfVenueId),
    needs_manual_pin: draft.needsManualPin,
    admin_review_notes: quickEmptyToNull(draft.notes),
  };
}

function QuickVenueEditor({
  venue,
  onSaved,
}: {
  venue: AdminVenue;
  onSaved: (venue: AdminVenue) => void;
}) {
  const [form, setForm] = useState(() => quickVenueFormFromVenue(venue));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm(quickVenueFormFromVenue(venue));
    setError(null);
    setSaved(false);
  }, [venue]);

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(quickVenueFormFromVenue(venue)),
    [form, venue],
  );

  function update<K extends keyof QuickVenueForm>(key: K, value: QuickVenueForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function save(nextApproved?: boolean) {
    const lat = quickNumberOrNull(form.lat);
    const lng = quickNumberOrNull(form.lng);
    const tablesCount = quickNumberOrNull(form.tablesCount);
    const duplicateOfVenueId = quickNumberOrNull(form.duplicateOfVenueId);

    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!form.address.trim()) {
      setError("Address is required.");
      return;
    }
    if (lat == null || lng == null) {
      setError("Latitude and longitude are required.");
      return;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setError("Coordinates are outside valid latitude/longitude ranges.");
      return;
    }

    setSaving(true);
    setError(null);
    const approved = nextApproved ?? form.approved;
    const payload = {
      name: form.name.trim(),
      address: form.address.trim(),
      type: form.type,
      tables_count: tablesCount ?? 0,
      condition: form.condition,
      lat,
      lng,
      approved,
      review_status: form.reviewStatus,
      needs_manual_pin: form.needsManualPin,
      duplicate_of_venue_id: duplicateOfVenueId,
      admin_review_notes: quickEmptyToNull(form.notes),
    };
    const { data, error: saveError } = await updateVenue(venue.id, payload);
    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    const updated = { ...venue, ...payload, ...((data ?? {}) as Partial<AdminVenue>) };
    setForm(quickVenueFormFromVenue(updated));
    setSaved(true);
    onSaved(updated as AdminVenue);
  }

  return (
    <section className="rounded-md border border-moss-100 bg-moss-50/40 p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <span className="kicker text-moss-700">Review edit</span>
          <h4 className="font-heading text-[14px] font-bold text-ink-900">
            Fields that affect the app
          </h4>
        </div>
        {saved ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-moss-700">
            <Check className="h-3.5 w-3.5" />
            Saved
          </span>
        ) : null}
      </div>

      <div className="grid gap-2.5">
        <QuickField label="Name">
          <input value={form.name} onChange={(event) => update("name", event.target.value)} className="editor-input" />
        </QuickField>
        <QuickField label="Address">
          <input value={form.address} onChange={(event) => update("address", event.target.value)} className="editor-input" />
        </QuickField>
        <div className="grid grid-cols-2 gap-2">
          <QuickField label="Type">
            <select value={form.type} onChange={(event) => update("type", event.target.value)} className="editor-input">
              <option value="parc_exterior">Outdoor</option>
              <option value="sala_indoor">Indoor</option>
            </select>
          </QuickField>
          <QuickField label="Tables">
            <input type="number" min={0} value={form.tablesCount} onChange={(event) => update("tablesCount", event.target.value)} className="editor-input" />
          </QuickField>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <QuickField label="Latitude">
            <input type="number" step="any" value={form.lat} onChange={(event) => update("lat", event.target.value)} className="editor-input" />
          </QuickField>
          <QuickField label="Longitude">
            <input type="number" step="any" value={form.lng} onChange={(event) => update("lng", event.target.value)} className="editor-input" />
          </QuickField>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <QuickField label="Condition">
            <select value={form.condition} onChange={(event) => update("condition", event.target.value)} className="editor-input">
              <option value="necunoscuta">Unknown</option>
              <option value="buna">Good</option>
              <option value="acceptabila">Acceptable</option>
              <option value="deteriorata">Damaged</option>
              <option value="profesionala">Professional</option>
            </select>
          </QuickField>
          <QuickField label="Review status">
            <select value={form.reviewStatus} onChange={(event) => update("reviewStatus", event.target.value as QuickVenueForm["reviewStatus"])} className="editor-input">
              {reviewStatusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </QuickField>
        </div>
        <details className="rounded-md border border-ink-100 bg-paper px-3 py-2">
          <summary className="cursor-pointer text-[12px] font-bold text-ink-700">Admin flags and notes</summary>
          <div className="mt-3 grid gap-2.5">
            <div className="grid grid-cols-2 gap-2">
              <QuickField label="Duplicate of ID">
                <input type="number" min={1} value={form.duplicateOfVenueId} onChange={(event) => update("duplicateOfVenueId", event.target.value)} className="editor-input" placeholder="Optional" />
              </QuickField>
              <label className="inline-flex min-h-[42px] items-center justify-between gap-3 rounded-md border border-ink-200 bg-paper px-3 text-[12px] font-semibold text-ink-700">
                Needs pin fix
                <input
                  type="checkbox"
                  checked={form.needsManualPin}
                  onChange={(event) => update("needsManualPin", event.target.checked)}
                  className="h-4 w-4 accent-moss-700"
                />
              </label>
            </div>
            <QuickField label="Admin notes">
              <textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} rows={1} className="editor-input resize-none" placeholder="Internal review note" />
            </QuickField>
          </div>
        </details>
      </div>

      {error ? (
        <p className="mt-3 rounded-md bg-clay-50 px-3 py-2 text-[12px] font-semibold text-clay-700">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-moss-100 pt-3">
        <label className="inline-flex items-center gap-2 text-[12px] font-semibold text-ink-700">
          <input
            type="checkbox"
            checked={form.approved}
            onChange={(event) => update("approved", event.target.checked)}
            className="h-4 w-4 accent-moss-700"
          />
          Show in app
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => save()}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 bg-paper px-2.5 py-1.5 text-[12px] font-semibold text-ink-700 hover:bg-surface disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </button>
          {!form.approved ? (
            <button
              onClick={() => save(true)}
              disabled={saving}
              className="btn-moss inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-semibold disabled:opacity-60"
            >
              <Check className="h-3.5 w-3.5" />
              Save & show
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function QuickField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase text-ink-500">{label}</span>
      {children}
    </label>
  );
}

function quickVenueFormFromVenue(venue: AdminVenue): QuickVenueForm {
  return {
    name: venue.name ?? "",
    address: venue.address ?? "",
    type: venue.type || "parc_exterior",
    tablesCount: venue.tables_count == null ? "" : String(venue.tables_count),
    condition: venue.condition || "necunoscuta",
    lat: venue.lat == null ? "" : String(venue.lat),
    lng: venue.lng == null ? "" : String(venue.lng),
    approved: venue.approved ?? false,
    reviewStatus: venue.review_status ?? (venue.approved ? "approved" : "pending"),
    needsManualPin: venue.needs_manual_pin ?? false,
    duplicateOfVenueId:
      venue.duplicate_of_venue_id == null ? "" : String(venue.duplicate_of_venue_id),
    notes: venue.admin_review_notes ?? "",
  };
}

function quickNumberOrNull(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function quickEmptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function VenueDetail({
  venue,
  context,
  reviewLoading,
  actionLoading,
  source,
  onEdit,
  onShow,
  onHide,
  onApproveNext,
  onHideNext,
  onMarkDuplicate,
  onSaved,
  nearestVenue,
}: {
  venue: AdminVenue;
  context: AdminVenueReviewContext | null;
  reviewLoading: boolean;
  actionLoading: boolean;
  source: VenueImportSource;
  onEdit: () => void;
  onShow: () => void;
  onHide: () => void;
  onApproveNext: () => void;
  onHideNext: () => void;
  onMarkDuplicate: (duplicateOfVenueId: number | null) => void;
  onSaved: (venue: AdminVenue) => void;
  nearestVenue: DuplicateVenueCandidate | null;
}) {
  const mapsUrl = googleMapsVenueUrl(venue);
  const attentionFlags = getVenueAttentionFlags(venue);
  const coordinates =
    venue.lat != null && venue.lng != null ? `${venue.lat.toFixed(6)}, ${venue.lng.toFixed(6)}` : null;

  async function copyCoordinates() {
    if (!coordinates) return;
    await navigator.clipboard?.writeText(coordinates);
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="kicker text-moss-700">Selected venue</span>
          <h3 className="font-heading text-[20px] font-bold leading-tight text-ink-900">
            {venue.name}
          </h3>
          <p className="mt-1 text-[12.5px] text-ink-500">
            {[venue.address, venue.city].filter(Boolean).join(", ") || "No address"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusPill label={venue.approved ? "shown" : "hidden"} tone={venue.approved ? "ok" : "neutral"} />
          <SourcePill source={source} />
        </div>
      </div>

      <AttentionChips flags={attentionFlags} />

      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-y border-ink-100 bg-surface/95 py-2 backdrop-blur">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 px-2.5 py-1.5 text-[12px] font-semibold text-ink-700 hover:bg-ink-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Advanced edit
          </button>
          {venue.approved ? (
            <button
              onClick={onHide}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 rounded-md border border-clay-200 px-2.5 py-1.5 text-[12px] font-semibold text-clay-700 hover:bg-clay-50 disabled:opacity-60"
            >
              <EyeOff className="h-3.5 w-3.5" />
              Hide
            </button>
          ) : (
            <button
              onClick={onShow}
              disabled={actionLoading}
              className="btn-moss inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-semibold disabled:opacity-60"
            >
              <Eye className="h-3.5 w-3.5" />
              Show
            </button>
          )}
          <button
            onClick={venue.approved ? onHideNext : onApproveNext}
            disabled={actionLoading}
            className="inline-flex items-center gap-1.5 rounded-md border border-moss-200 px-2.5 py-1.5 text-[12px] font-semibold text-moss-700 hover:bg-moss-50 disabled:opacity-60"
          >
            <Check className="h-3.5 w-3.5" />
            {venue.approved ? "Hide & next" : "Approve & next"}
          </button>
          <button
            onClick={() => nearestVenue && onMarkDuplicate(nearestVenue.venue.id)}
            disabled={actionLoading || !nearestVenue}
            className="inline-flex items-center gap-1.5 rounded-md border border-clay-200 px-2.5 py-1.5 text-[12px] font-semibold text-clay-700 hover:bg-clay-50 disabled:opacity-60"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            {nearestVenue ? `Duplicate of #${nearestVenue.venue.id}` : "No duplicate"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 px-2.5 py-1.5 text-[12px] font-semibold text-ink-700 hover:bg-ink-50"
          >
            <MapPinned className="h-3.5 w-3.5" />
            Maps
          </a>
          {coordinates ? (
            <button
              onClick={copyCoordinates}
              className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 px-2.5 py-1.5 text-[12px] font-semibold text-ink-700 hover:bg-ink-50"
            >
              <Clipboard className="h-3.5 w-3.5" />
              Coordinates
            </button>
          ) : null}
        </div>
      </div>

      {nearestVenue ? (
        <div className="rounded-md border border-clay-200 bg-clay-50 px-3 py-2 text-[12.5px] text-clay-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold">Detected duplicate target</p>
              <p className="mt-0.5">
                #{nearestVenue.venue.id} {nearestVenue.venue.name} /{" "}
                {getDuplicateCandidateLabel(nearestVenue)}
              </p>
            </div>
            <button
              onClick={() => onMarkDuplicate(nearestVenue.venue.id)}
              disabled={actionLoading}
              className="rounded-md border border-clay-200 bg-paper px-2 py-1 text-[11px] font-bold text-clay-700 hover:bg-clay-50 disabled:opacity-60"
            >
              Mark
            </button>
          </div>
        </div>
      ) : null}

      <QuickVenueEditor venue={venue} onSaved={onSaved} />

      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Tables" value={venue.tables_count ?? "?"} />
        <MiniStat label="Reviews" value={context?.stats?.review_count ?? venue.review_count ?? 0} />
        <MiniStat label="Check-ins" value={context?.stats?.checkin_count ?? venue.checkin_count ?? 0} />
      </div>

      <div className="rounded-md border border-ink-100 bg-paper p-3">
        <div className="grid grid-cols-2 gap-2 text-[12px] text-ink-600">
          <Info label="Type" value={venue.type ?? "Unknown"} />
          <Info label="Condition" value={venue.condition ?? "Unknown"} />
          <Info label="Lat" value={venue.lat?.toFixed(6) ?? "Missing"} />
          <Info label="Lng" value={venue.lng?.toFixed(6) ?? "Missing"} />
        </div>
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="font-heading text-[15px] font-bold text-ink-900">Review context</h4>
          {reviewLoading ? <Loader2 className="h-4 w-4 animate-spin text-ink-400" /> : null}
        </div>
        {context?.reviews?.length ? (
          <div className="flex flex-col gap-2">
            {context.reviews.map((review) => (
              <div key={review.id} className="rounded-md border border-ink-100 bg-paper p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-[12px] font-bold text-ink-700">
                    <Star className="h-3.5 w-3.5 fill-clay-500 text-clay-500" />
                    {review.rating ?? "?"}
                  </span>
                  {review.flagged ? <StatusPill label={`${review.flag_count} flags`} tone="danger" /> : null}
                </div>
                <p className="whitespace-pre-line text-[12.5px] text-ink-700">
                  {review.body || "No comment"}
                </p>
                <p className="mt-1 text-[11px] text-ink-400">
                  {review.full_name ?? "Anonymous"} · {new Date(review.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-ink-200 bg-paper px-3 py-5 text-center text-[12.5px] text-ink-400">
            No reviews for this venue yet.
          </p>
        )}
      </section>
    </div>
  );
}

function SelectedCitySummaryCompact({
  selectedCity,
  metrics,
}: {
  selectedCity: NonNullable<SeedCitySelection>;
  metrics: {
    shown: number;
    hidden: number;
    needsAttention: number;
    missingAddress: number;
    possibleDuplicates: number;
    defaultTableCount: number;
  } | null;
}) {
  const items = [
    ["Shown", metrics?.shown ?? "-"],
    ["Hidden", metrics?.hidden ?? "-"],
    ["Attention", metrics?.needsAttention ?? "-"],
    ["Address", metrics?.missingAddress ?? "-"],
    ["Dupes", metrics?.possibleDuplicates ?? "-"],
    ["Tables", metrics?.defaultTableCount ?? "-"],
  ] as const;

  return (
    <section className="min-w-0 flex-1 rounded-md border border-ink-100 bg-paper px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="kicker text-moss-700">Selected city</span>
        <h3 className="truncate font-heading text-[14px] font-bold text-ink-900">
          {selectedCity.cityName}, {selectedCity.countryName}
        </h3>
        <span className="text-[11.5px] font-semibold text-ink-500">
          {formatDashboardNumber(selectedCity.locations)} seed total
          {selectedCity.seedRank ? ` / rank ${selectedCity.seedRank}` : ""}
        </span>
        <div className="flex flex-wrap items-center gap-1">
          {items.slice(0, 4).map(([label, value]) => (
            <span key={label} className="rounded bg-ink-50 px-1.5 py-0.5 text-[10.5px] font-bold text-ink-600">
              {label}: {value}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function SelectedCitySummary({
  selectedCity,
  metrics,
}: {
  selectedCity: NonNullable<SeedCitySelection>;
  metrics: {
    shown: number;
    hidden: number;
    needsAttention: number;
    missingAddress: number;
    possibleDuplicates: number;
    defaultTableCount: number;
  } | null;
}) {
  return (
    <section className="rounded-md border border-ink-100 bg-paper px-3 py-2">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <span className="kicker text-moss-700">Selected city</span>
          <h3 className="truncate font-heading text-[15px] font-bold text-ink-900">
            {selectedCity.cityName}, {selectedCity.countryName}
          </h3>
          <p className="text-[11.5px] font-medium text-ink-500">
            {formatDashboardNumber(selectedCity.locations)} seed venues
            {selectedCity.seedRank ? ` · Seed rank ${selectedCity.seedRank}` : ""}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-1.5 xl:grid-cols-6">
          <SummaryMetric label="Shown" value={metrics?.shown ?? "—"} />
          <SummaryMetric label="Hidden" value={metrics?.hidden ?? "—"} />
          <SummaryMetric label="Needs attention" value={metrics?.needsAttention ?? "—"} />
          <SummaryMetric label="Missing address" value={metrics?.missingAddress ?? "—"} />
          <SummaryMetric label="Possible dupes" value={metrics?.possibleDuplicates ?? "—"} />
          <SummaryMetric label="Default tables" value={metrics?.defaultTableCount ?? "—"} />
        </div>
      </div>
    </section>
  );
}

function PinSourceLegend({
  counts,
  seedCount,
  previewCount,
  loading,
}: {
  counts: Record<VenueImportSource, number>;
  seedCount: number;
  previewCount: number;
  loading: boolean;
}) {
  return (
    <div className="flex min-w-fit flex-wrap items-center gap-2 px-2 text-[11.5px] font-semibold text-ink-600">
      <span className="kicker text-ink-500">Pin colors</span>
      <LegendDot color="#1a5a37" label={`Visible app pins: ${formatDashboardNumber(counts.in_app)}`} />
      <LegendDot color="#d97706" label={`Visible imported seed pins: ${formatDashboardNumber(counts.staged_osm)}`} />
      {previewCount ? (
        <LegendDot color="#f59e0b" label={`Remaining seed drafts: ${formatDashboardNumber(previewCount)}`} />
      ) : null}
      {counts.unknown ? (
        <LegendDot color="#8b9a91" label={`Unclassified: ${formatDashboardNumber(counts.unknown)}`} />
      ) : null}
      <span className="text-ink-400">
        {loading
          ? "Loading seed manifest"
          : seedCount
            ? `${formatDashboardNumber(seedCount)} OSM seed venues for this city`
            : "No city seed manifest loaded"}
      </span>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function UnifiedCityQueue({
  inventory,
  selectedCountry,
  selectedCountryCode,
  citySearch,
  cities,
  liveCities,
  selectedCityId,
  selectedReviewCity,
  countries,
  countryLabel,
  status,
  citiesLoading,
  cityError,
  onCountryChange,
  onCitySearchChange,
  onStatusChange,
  onCitySelect,
  onGlobalCitySelect,
  onLiveCitySelect,
  onRefresh,
  collapsed,
  onChangeCity,
  onCollapse,
}: {
  inventory: OsmSeedInventory | null;
  selectedCountry: OsmSeedCountry | null;
  selectedCountryCode: string;
  citySearch: string;
  cities: OsmSeedCity[];
  liveCities: AdminCityReviewRow[];
  selectedCityId: number | null;
  selectedReviewCity: SeedCitySelection;
  countries: [string, string][];
  countryLabel: (code: string, fallback?: string | null) => string;
  status: string;
  citiesLoading: boolean;
  cityError: string | null;
  onCountryChange: (code: string) => void;
  onCitySearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onCitySelect: (city: OsmSeedCity) => void;
  onGlobalCitySelect: (country: OsmSeedCountry, city: OsmSeedCity) => void;
  onLiveCitySelect: (city: AdminCityReviewRow) => void;
  onRefresh: () => void;
  collapsed: boolean;
  onChangeCity: () => void;
  onCollapse: () => void;
}) {
  const cityQuery = citySearch.trim().toLowerCase();
  const visibleCities = cities.slice(0, 160);
  const globalCityMatches = useMemo(() => {
    if (!inventory || selectedCountry || cityQuery.length < 2) return [];
    return inventory.countries
      .flatMap((country) =>
        (inventory.cityGroups[country.code] ?? [])
          .filter((city) => city.name.toLowerCase().includes(cityQuery))
          .map((city) => ({ country, city })),
      )
      .sort((a, b) => b.city.locations - a.city.locations)
      .slice(0, 160);
  }, [cityQuery, inventory, selectedCountry]);
  const liveCityByName = useMemo(() => {
    const map = new Map<string, AdminCityReviewRow>();
    liveCities.forEach((city) => map.set(city.city_name.toLowerCase(), city));
    return map;
  }, [liveCities]);

  if (collapsed && selectedReviewCity) {
    return (
      <section className="border-b border-ink-100 bg-paper">
        <div className="flex items-start justify-between gap-3 p-3">
          <div className="min-w-0">
            <span className="kicker text-clay-700">City queue</span>
            <h2 className="truncate font-heading text-[15px] font-bold text-ink-900">
              {selectedReviewCity.cityName}, {selectedReviewCity.countryName}
            </h2>
            <p className="text-[11px] font-semibold text-ink-500">
              {formatDashboardNumber(selectedReviewCity.locations)} venues
              {selectedReviewCity.seedRank ? ` / seed rank ${selectedReviewCity.seedRank}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={onRefresh}
              className="rounded-md p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
              aria-label="Refresh cities"
            >
              <RefreshCw className={`h-4 w-4 ${citiesLoading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onChangeCity}
              className="rounded-md border border-ink-200 bg-surface px-2.5 py-1.5 text-[12px] font-semibold text-ink-700 hover:bg-ink-50"
            >
              Change city
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="border-b border-ink-100 bg-paper/70">
      <div className="flex items-start justify-between gap-3 border-b border-ink-100 p-3">
        <div>
          <span className="kicker text-clay-700">City queue</span>
          <h2 className="font-heading text-[15px] font-bold text-ink-900">Cities</h2>
        </div>
        <button
          onClick={onRefresh}
          className="rounded-md p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
          aria-label="Refresh cities"
        >
          <RefreshCw className={`h-4 w-4 ${citiesLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {inventory ? (
        <div className="flex flex-col gap-2 p-3">
          <div className="rounded-md border border-ink-100 bg-surface px-2.5 py-2 text-[11.5px] font-semibold text-ink-500">
            <span className="font-bold text-ink-900">
              {formatDashboardNumber(inventory.metrics.totalLocations)}
            </span>{" "}
            venues / <span className="font-bold text-ink-900">{inventory.metrics.countries}</span>{" "}
            countries /{" "}
            <span className="font-bold text-ink-900">
              {formatDashboardNumber(inventory.metrics.cities)}
            </span>{" "}
            cities
          </div>

          {selectedReviewCity ? (
            <div className="rounded-md border border-moss-100 bg-moss-50 px-2.5 py-2 text-[12px] text-moss-900">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                <SlidersHorizontal className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p className="truncate">
                  Reviewing{" "}
                  <strong>
                    {selectedReviewCity.cityName}, {selectedReviewCity.countryName}
                  </strong>
                </p>
                </div>
                <button
                  onClick={onCollapse}
                  className="shrink-0 rounded-md border border-moss-100 bg-surface px-2 py-1 text-[11px] font-bold text-moss-700 hover:bg-moss-50"
                >
                  Done
                </button>
              </div>
            </div>
          ) : null}

          <SearchField value={citySearch} onChange={onCitySearchChange} placeholder="Search city" />

          <div className="grid grid-cols-1 gap-2 2xl:grid-cols-2">
            <select
              value={selectedCountryCode}
              onChange={(event) => onCountryChange(event.target.value)}
              className="input-control"
            >
              <option value="">All countries</option>
              {inventory.countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {countryLabel(country.code, country.name)} ({formatDashboardNumber(country.locations)})
                </option>
              ))}
              {countries
                .filter(([code]) => !inventory.countries.some((country) => country.code === code))
                .map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
            </select>
            <select
              value={status}
              onChange={(event) => onStatusChange(event.target.value)}
              className="input-control"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {cityError ? <ErrorBlock text={cityError} /> : null}

          {!selectedCountry && cityQuery.length >= 2 ? (
            <div className="rounded-md border border-ink-100 bg-surface">
              <div className="border-b border-ink-100 px-3 py-2">
                <span className="kicker text-ink-500">City results</span>
              </div>
              <div className="max-h-[330px] overflow-y-auto">
                {globalCityMatches.length ? (
                  globalCityMatches.map(({ country, city }) => (
                    <button
                      key={`${country.code}-${city.rank}-${city.name}`}
                      onClick={() => onGlobalCitySelect(country, city)}
                      className="flex w-full items-center justify-between gap-3 border-b border-ink-100 px-3 py-2 text-left last:border-b-0 hover:bg-moss-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-semibold text-ink-900">
                          {city.name}
                        </p>
                        <p className="text-[10.5px] font-medium text-ink-400">
                          {countryLabel(country.code, country.name)} / seed rank {city.rank}
                        </p>
                      </div>
                      <span className="rounded-md bg-ink-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-ink-700">
                        {formatDashboardNumber(city.locations)}
                      </span>
                    </button>
                  ))
                ) : (
                  <EmptyBlock text="No seed cities match that search." />
                )}
              </div>
            </div>
          ) : selectedCountry ? (
            <div className="rounded-md border border-ink-100 bg-surface">
              <div className="border-b border-ink-100 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-[12px] font-bold text-ink-900">
                      <Globe2 className="h-3.5 w-3.5 text-moss-700" />
                      {countryLabel(selectedCountry.code, selectedCountry.name)}
                    </div>
                    <p className="mt-0.5 text-[11px] text-ink-500">
                      {formatDashboardNumber(selectedCountry.locations)} venues across{" "}
                      {formatDashboardNumber(selectedCountry.cities)} cities
                    </p>
                  </div>
                  <StatusPill label={selectedCountry.code} tone="neutral" />
                </div>
              </div>

              <div className="max-h-[230px] overflow-y-auto">
                {visibleCities.length ? (
                  visibleCities.map((city) => {
                    const liveCity = liveCityByName.get(city.name.toLowerCase());
                    const selected =
                      (liveCity && selectedCityId === liveCity.city_id) ||
                      selectedReviewCity?.cityName.toLowerCase() === city.name.toLowerCase();
                    return (
                    <button
                      key={`${selectedCountry.code}-${city.rank}-${city.name}`}
                      onClick={() => onCitySelect(city)}
                      className={`flex w-full items-center justify-between gap-3 border-b border-ink-100 px-3 py-2 text-left last:border-b-0 hover:bg-moss-50 ${
                        selected ? "bg-moss-50" : ""
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-semibold text-ink-900">
                          {city.name}
                        </p>
                        <p className="text-[10.5px] font-medium text-ink-400">
                          Seed rank {city.rank}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {liveCity ? (
                            <>
                              <StatusPill label={`${liveCity.venue_count} imported`} tone="ok" />
                              <StatusPill label={liveCity.expansion_status} tone="neutral" />
                            </>
                          ) : (
                            <StatusPill label="seed only" tone="warn" />
                          )}
                        </div>
                      </div>
                      <span className="rounded-md bg-ink-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-ink-700">
                        {formatDashboardNumber(city.locations)}
                      </span>
                    </button>
                    );
                  })
                ) : (
                  <EmptyBlock text="No seed cities match that search." />
                )}
              </div>
              {cities.length > visibleCities.length ? (
                <div className="border-t border-ink-100 px-3 py-2 text-[11px] font-semibold text-ink-400">
                  Showing {formatDashboardNumber(visibleCities.length)} of{" "}
                  {formatDashboardNumber(cities.length)} cities
                </div>
              ) : null}
            </div>
          ) : (
            <div className="max-h-[230px] overflow-y-auto rounded-md border border-ink-100 bg-surface">
              {inventory.countries.map((country) => (
                <button
                  key={country.code}
                  onClick={() => onCountryChange(country.code)}
                className="flex w-full items-center justify-between gap-3 border-b border-ink-100 px-3 py-2 text-left last:border-b-0 hover:bg-ink-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-semibold text-ink-900">
                      {countryLabel(country.code, country.name)}
                    </p>
                    <p className="text-[10.5px] font-medium text-ink-400">
                      {formatDashboardNumber(country.cities)} cities
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-[12px] font-bold tabular-nums text-ink-800">
                      {formatDashboardNumber(country.locations)}
                    </div>
                    <div className="text-[10px] font-bold uppercase text-ink-400">
                      {country.code}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!selectedCountry && liveCities.length ? (
            <div className="rounded-md border border-ink-100 bg-surface">
              <div className="border-b border-ink-100 px-3 py-2">
                <span className="kicker text-ink-500">Imported cities</span>
              </div>
              <div className="max-h-[190px] overflow-y-auto">
                {liveCities.map((city) => (
                  <button
                    key={city.city_id}
                    onClick={() => onLiveCitySelect(city)}
                    className={`flex w-full items-center justify-between gap-3 border-b border-ink-100 px-3 py-2 text-left last:border-b-0 hover:bg-moss-50 ${
                      selectedCityId === city.city_id ? "bg-moss-50" : ""
                    }`}
                  >
                    <div>
                      <p className="text-[12.5px] font-semibold text-ink-900">{city.city_name}</p>
                      <p className="text-[10.5px] font-medium text-ink-400">
                        {[city.admin_area, countryLabel(city.country_code, city.country_name)].filter(Boolean).join(", ")}
                      </p>
                    </div>
                    <span className="rounded-md bg-ink-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-ink-700">
                      {city.venue_count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <LoadingBlock text="Loading seed inventory" />
      )}
    </section>
  );
}

function Metric({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={`rounded-md border border-ink-100 bg-paper ${compact ? "px-2.5 py-1.5" : "px-3 py-2"}`}>
      <div className={`font-heading font-bold text-ink-900 ${compact ? "text-[14px]" : "text-[17px]"}`}>{value}</div>
      <div className={`font-bold uppercase text-ink-500 ${compact ? "text-[9px] tracking-[0.16em]" : "text-[10px] tracking-[0.18em]"}`}>{label}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-ink-100 bg-paper px-2.5 py-1.5">
      <div className="font-heading text-[15px] font-bold text-ink-900">{value}</div>
      <div className="text-[10px] font-semibold uppercase text-ink-400">{label}</div>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-[88px] rounded-md border border-ink-100 bg-surface px-2.5 py-2">
      <div className="font-heading text-[15px] font-bold text-ink-900">{value}</div>
      <div className="text-[10px] font-semibold uppercase leading-tight text-ink-400">
        {label}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] font-bold uppercase text-ink-400">{label}</div>
      <div className="font-semibold text-ink-800">{value}</div>
    </div>
  );
}

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex min-h-[42px] items-center gap-2 rounded-md border border-ink-200 bg-paper px-3">
      <Search className="h-4 w-4 text-ink-400" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-ink-900 outline-none placeholder:text-ink-400"
      />
      {value ? (
        <button onClick={() => onChange("")} className="text-ink-400 hover:text-ink-800">
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "ok" | "warn" | "danger" | "neutral" }) {
  const cls =
    tone === "ok"
      ? "bg-moss-100 text-moss-800"
      : tone === "danger"
        ? "bg-clay-100 text-clay-700"
        : tone === "warn"
          ? "bg-clay-50 text-clay-700"
          : "bg-ink-100 text-ink-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase ${cls}`}>
      {label.replaceAll("_", " ")}
    </span>
  );
}

function SourcePill({ source }: { source: VenueImportSource }) {
  const cls =
    source === "staged_osm"
      ? "bg-amber-100 text-amber-800"
      : source === "in_app"
        ? "bg-moss-100 text-moss-800"
        : "bg-ink-100 text-ink-600";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${cls}`}>
      {getVenueImportSourceLabel(source)}
    </span>
  );
}

function AttentionChips({
  flags,
  compact = false,
}: {
  flags: ReturnType<typeof getVenueAttentionFlags>;
  compact?: boolean;
}) {
  if (!flags.length) return null;
  return (
    <div className={`flex flex-wrap gap-1 ${compact ? "mt-1" : ""}`}>
      {flags.map((flag) => (
        <span
          key={flag}
          className={`inline-flex rounded-full bg-clay-50 font-bold uppercase text-clay-700 ${
            compact ? "px-1.5 py-0.5 text-[9.5px]" : "px-2 py-0.5 text-[10.5px]"
          }`}
        >
          {getVenueAttentionLabel(flag)}
        </span>
      ))}
    </div>
  );
}

function LoadingBlock({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-12 text-[13px] text-ink-400">
      <Loader2 className="h-4 w-4 animate-spin" />
      {text}
    </div>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="px-4 py-12 text-center text-[13px] text-ink-400">
      {text}
    </div>
  );
}

function ErrorBlock({ text }: { text: string }) {
  return (
    <div className="m-4 rounded-md bg-clay-50 px-3 py-2 text-[13px] font-semibold text-clay-700">
      {text}
    </div>
  );
}
