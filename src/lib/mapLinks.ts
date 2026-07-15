export interface MapDestination {
  latitude: number;
  longitude: number;
  name?: string | null;
  address?: string | null;
}

export interface MapAppLinks {
  google: string;
  apple: string;
  waze: string;
}

/** Build exact-coordinate navigation links while supplying a human label. */
export function buildMapAppLinks(destination: MapDestination): MapAppLinks {
  const { latitude, longitude } = destination;
  const coordinates = `${latitude},${longitude}`;
  const name = destination.name?.trim();
  const address = destination.address?.trim();
  const googleDestination = [name, address].filter(Boolean).join(', ') || coordinates;

  return {
    // Google displays the venue/address as the destination instead of a raw
    // coordinate pair. Address is preferred because it resolves reliably.
    google:
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(googleDestination)}` +
      '&travelmode=driving&dir_action=navigate',
    apple:
      `https://maps.apple.com/?daddr=${encodeURIComponent(coordinates)}` +
      `${name ? `&q=${encodeURIComponent(name)}` : ''}&dirflg=d`,
    waze:
      `https://www.waze.com/ul?ll=${encodeURIComponent(coordinates)}` +
      `${name ? `&q=${encodeURIComponent(name)}` : ''}&navigate=yes`,
  };
}
