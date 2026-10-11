import {
  createGoogleGeocoder,
  createGoogleRenderer,
} from "@corsivo-suite/wp-admin-maps/google";
import { createLeafletRenderer } from "@corsivo-suite/wp-admin-maps/leaflet";
import {
  createMapboxGeocoder,
  createMapboxRenderer,
} from "@corsivo-suite/wp-admin-maps/mapbox";
import { createOsmGeocoder } from "./osm-geocoder";

const OPENSTREETMAP_TILES =
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OPENSTREETMAP_ATTRIBUTION = "&copy; OpenStreetMap contributors";

export function getMapProvider(type) {
  if (type === "mapbox-map" || type === "mapbox-geocoder") {
    return "mapbox";
  }

  if (type === "osm-map" || type === "osm-geocoder") {
    return "osm";
  }

  return "google";
}

export function createFieldGeocoder(provider, field, keys) {
  if (provider === "mapbox") {
    return createMapboxGeocoder({
      accessToken: keys.mapbox,
      searchOptions: {
        ...(field.geocodingOptions || {}),
        permanent: true,
      },
      reverseOptions: {
        ...(field.reverseGeocodingOptions || field.geocodingOptions || {}),
        permanent: true,
      },
    });
  }

  if (provider === "osm") {
    return createOsmGeocoder({
      language: field.language,
      searchEndpoint: field.searchEndpoint,
      reverseEndpoint: field.reverseEndpoint,
    });
  }

  return createGoogleGeocoder({
    apiKey: keys.googleMaps,
    loaderOptions: field.loaderOptions || {},
  });
}

export function createFieldRenderer(provider, field, keys, callbacks = {}) {
  const defaultZoom = Number(field.zoom) || 12;

  if (provider === "mapbox") {
    return createMapboxRenderer({
      accessToken: keys.mapbox,
      styleUrl: field.styleUrl,
      attribution: field.attribution,
      defaultZoom: defaultZoom + 1,
      mapOptions: field.mapOptions || {},
      scrollWheelZoomModifier: "Control",
      onStyleFallback: callbacks.onStyleFallback,
      onTileError: callbacks.onTileError,
    });
  }

  if (provider === "osm") {
    return createLeafletRenderer({
      tileUrl: field.tileUrl || OPENSTREETMAP_TILES,
      attribution: field.attribution || OPENSTREETMAP_ATTRIBUTION,
      defaultZoom,
      mapOptions: field.mapOptions || {},
      scrollWheelZoomModifier: "Control",
      onTileError: callbacks.onTileError,
    });
  }

  return createGoogleRenderer({
    apiKey: keys.googleMaps,
    defaultZoom,
    mapId: field.mapId || "DEMO_MAP_ID",
    mapOptions: field.mapOptions || {},
    loaderOptions: field.loaderOptions || {},
  });
}

export function providerNeedsKey(provider) {
  return provider === "google" || provider === "mapbox";
}
