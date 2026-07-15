"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { LatLngBounds } from "leaflet";
import type { AdminCityReviewRow, AdminVenue } from "@/lib/admin-service";
import {
  getVenueAttentionFlags,
  getVenueAttentionLabel,
  getVenueImportSourceLabel,
  type OsmSeedVenue,
  type VenueImportSource,
  venueNeedsAttention,
} from "./venueDashboardUtils";
import "leaflet/dist/leaflet.css";

export type AdminMapBounds = {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
};

type AdminVenueMapProps = {
  city: AdminCityReviewRow | null;
  seedCity: AdminSeedCityFocus | null;
  seedPreviewVenues: OsmSeedVenue[];
  venues: AdminVenue[];
  venueSources: Record<number, VenueImportSource>;
  selectedVenueId: number | null;
  selectedSeedPreviewIndex: number | null;
  onBoundsChange: (bounds: AdminMapBounds) => void;
  onVenueSelect: (venue: AdminVenue) => void;
  onSeedPreviewSelect: (venue: OsmSeedVenue, index: number) => void;
};

export type AdminSeedCityFocus = {
  cityName: string;
  countryName: string;
  lat: number | null;
  lng: number | null;
  zoom?: number | null;
};

const europeCenter: [number, number] = [49.8, 10.4];

export function AdminVenueMap({
  city,
  seedCity,
  seedPreviewVenues,
  venues,
  venueSources,
  selectedVenueId,
  selectedSeedPreviewIndex,
  onBoundsChange,
  onVenueSelect,
  onSeedPreviewSelect,
}: AdminVenueMapProps) {
  const center = useMemo<[number, number]>(() => {
    if (city?.lat != null && city.lng != null) return [city.lat, city.lng];
    if (seedCity?.lat != null && seedCity.lng != null) return [seedCity.lat, seedCity.lng];
    const first = venues.find((venue) => venue.lat != null && venue.lng != null);
    if (first?.lat != null && first.lng != null) return [first.lat, first.lng];
    const firstPreview = seedPreviewVenues.find((venue) => validPoint(venue.lat, venue.lng));
    if (firstPreview) return [firstPreview.lat, firstPreview.lng];
    return europeCenter;
  }, [city, seedCity, seedPreviewVenues, venues]);

  return (
    <MapContainer
      center={center}
      zoom={city?.zoom ?? seedCity?.zoom ?? 5}
      minZoom={3}
      maxZoom={18}
      className="h-full min-h-[520px] w-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapBoundsReporter onBoundsChange={onBoundsChange} />
      <MapFocusController
        city={city}
        seedCity={seedCity}
        venue={venues.find((venue) => venue.id === selectedVenueId) ?? null}
        seedVenue={
          selectedSeedPreviewIndex == null ? null : seedPreviewVenues[selectedSeedPreviewIndex] ?? null
        }
      />
      {seedPreviewVenues.map((venue, index) => {
        if (!validPoint(venue.lat, venue.lng)) return null;
        const selected = selectedSeedPreviewIndex === index;
        return (
          <CircleMarker
            key={`seed-preview-${venue.name}-${venue.lat}-${venue.lng}-${index}`}
            center={[venue.lat, venue.lng]}
            radius={selected ? 13 : 5}
            pathOptions={{
              color: selected ? "#0f1d13" : "#92400e",
              fillColor: "#f59e0b",
              fillOpacity: selected ? 0.92 : 0.5,
              weight: selected ? 5 : 2,
              opacity: selected ? 1 : 0.9,
              dashArray: "4 3",
            }}
            eventHandlers={{
              click: () => onSeedPreviewSelect(venue, index),
            }}
          >
            <Tooltip direction="top" offset={[0, -4]} opacity={0.95}>
              <div className="text-[12px]">
                <strong>{venue.name}</strong>
                <br />
                OSM seed preview
                <br />
                {[venue.city, venue.address].filter(Boolean).join(" - ") || "No address"}
                <br />
                Import before editing or approving
                {selected ? (
                  <>
                    <br />
                    <strong>Selected preview</strong>
                  </>
                ) : null}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
      {venues.map((venue) => {
        if (venue.lat == null || venue.lng == null) return null;
        const selected = venue.id === selectedVenueId;
        const flagged = (venue.flagged_review_count ?? 0) > 0;
        const needsAttention = venueNeedsAttention(venue);
        const attentionFlags = getVenueAttentionFlags(venue);
        const source = venueSources[venue.id] ?? "unknown";
        const fillColor = !venue.approved
          ? "#8b9a91"
          : source === "staged_osm"
            ? "#d97706"
            : source === "in_app"
              ? "#1a5a37"
              : "#64736b";
        const strokeColor = selected ? "#0f1d13" : flagged || needsAttention ? "#c2410c" : fillColor;

        return (
          <CircleMarker
            key={venue.id}
            center={[venue.lat, venue.lng]}
            radius={selected ? 14 : 6}
            pathOptions={{
              color: strokeColor,
              fillColor,
              fillOpacity: selected ? 0.98 : 0.72,
              weight: selected ? 5 : 2,
              opacity: selected ? 1 : 0.85,
            }}
            eventHandlers={{
              click: () => onVenueSelect(venue),
            }}
          >
            <Tooltip direction="top" offset={[0, -4]} opacity={0.95}>
              <div className="text-[12px]">
                <strong>{venue.name}</strong>
                <br />
                {getVenueImportSourceLabel(source)}
                <br />
                {venue.city ?? "No city"} - {venue.tables_count ?? "?"} tables
                {selected ? (
                  <>
                    <br />
                    <strong>Selected venue</strong>
                  </>
                ) : null}
                {attentionFlags.length ? (
                  <>
                    <br />
                    {attentionFlags.slice(0, 3).map(getVenueAttentionLabel).join(" - ")}
                  </>
                ) : null}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}

function validPoint(lat: number | null | undefined, lng: number | null | undefined) {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function MapBoundsReporter({
  onBoundsChange,
}: {
  onBoundsChange: (bounds: AdminMapBounds) => void;
}) {
  const publish = useCallback(
    (bounds: LatLngBounds) => {
      onBoundsChange({
        minLat: bounds.getSouth(),
        minLng: bounds.getWest(),
        maxLat: bounds.getNorth(),
        maxLng: bounds.getEast(),
      });
    },
    [onBoundsChange],
  );

  const map = useMapEvents({
    moveend: () => publish(map.getBounds()),
    zoomend: () => publish(map.getBounds()),
  });

  useEffect(() => {
    publish(map.getBounds());
  }, [map, publish]);

  return null;
}

function MapFocusController({
  city,
  seedCity,
  venue,
  seedVenue,
}: {
  city: AdminCityReviewRow | null;
  seedCity: AdminSeedCityFocus | null;
  venue: AdminVenue | null;
  seedVenue: OsmSeedVenue | null;
}) {
  const map = useMap();
  const lastFocusKeyRef = useRef<string | null>(null);
  const focus = useMemo(() => {
    if (venue && validPoint(venue.lat, venue.lng)) {
      return {
        key: `venue-${venue.id}-${venue.lat}-${venue.lng}`,
        lat: Number(venue.lat),
        lng: Number(venue.lng),
        zoom: Math.max(map.getZoom(), 15),
        duration: 0.45,
      };
    }
    if (seedVenue && validPoint(seedVenue.lat, seedVenue.lng)) {
      return {
        key: `seed-${seedVenue.name}-${seedVenue.lat}-${seedVenue.lng}`,
        lat: Number(seedVenue.lat),
        lng: Number(seedVenue.lng),
        zoom: Math.max(map.getZoom(), 15),
        duration: 0.45,
      };
    }
    if (city?.lat != null && city.lng != null) {
      return {
        key: `city-${city.city_id}-${city.lat}-${city.lng}`,
        lat: Number(city.lat),
        lng: Number(city.lng),
        zoom: city.zoom ?? 12,
        duration: 0.7,
      };
    }
    if (seedCity?.lat != null && seedCity.lng != null) {
      return {
        key: `seed-city-${seedCity.cityName}-${seedCity.lat}-${seedCity.lng}`,
        lat: Number(seedCity.lat),
        lng: Number(seedCity.lng),
        zoom: seedCity.zoom ?? 12,
        duration: 0.7,
      };
    }
    return null;
  }, [city, map, seedCity, seedVenue, venue]);

  useEffect(() => {
    if (!focus) return;
    if (lastFocusKeyRef.current === focus.key) return;
    const center = map.getCenter();
    const alreadyFocused =
      Math.abs(center.lat - focus.lat) < 0.0002 &&
      Math.abs(center.lng - focus.lng) < 0.0002 &&
      Math.abs(map.getZoom() - focus.zoom) <= 1;
    if (alreadyFocused) {
      lastFocusKeyRef.current = focus.key;
      return;
    }
    lastFocusKeyRef.current = focus.key;
    map.flyTo([focus.lat, focus.lng], focus.zoom, {
      animate: true,
      duration: focus.duration,
    });
  }, [focus, map]);

  return null;
}
