import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "@wordpress/element";
import { BaseControl, Notice } from "@wordpress/components";
import { __, sprintf } from "@wordpress/i18n";
import { GeocoderControl } from "@corsivo-suite/wp-admin-maps";
import {
  createFieldGeocoder,
  getMapProvider,
  providerNeedsKey,
} from "./map-provider";
import {
  parseLegacyObject,
  toLegacyLocation,
  toSemanticLocation,
} from "./value-contracts";

export default function GeocoderField({
  name,
  field,
  type,
  value,
  onChange,
  error,
}) {
  const provider = getMapProvider(type);
  const googleMapsKey = window.defineBlocks?.keys?.googleMaps;
  const mapboxKey = window.defineBlocks?.keys?.mapbox;
  const apiKey = provider === "google" ? googleMapsKey : mapboxKey;
  const { geocodingOptions, language, loaderOptions, reverseGeocodingOptions } =
    field;
  const location = useMemo(() => toSemanticLocation(value), [value]);
  const savedQuery = useMemo(() => {
    const legacyLocation = parseLegacyObject(value);
    return String(
      legacyLocation.query ??
        legacyLocation.address ??
        legacyLocation.formatted_address ??
        "",
    );
  }, [value]);
  const [query, setQuery] = useState(savedQuery);
  const queryRef = useRef(savedQuery);
  const geocoderField = useMemo(
    () => ({
      geocodingOptions,
      language,
      loaderOptions,
      reverseGeocodingOptions,
    }),
    [geocodingOptions, language, loaderOptions, reverseGeocodingOptions],
  );
  const providerKeys = useMemo(
    () => ({
      googleMaps: googleMapsKey,
      mapbox: mapboxKey,
    }),
    [googleMapsKey, mapboxKey],
  );
  const geocoder = useMemo(
    () => createFieldGeocoder(provider, geocoderField, providerKeys),
    [geocoderField, provider, providerKeys],
  );

  useEffect(() => {
    queryRef.current = savedQuery;
    setQuery(savedQuery);
  }, [savedQuery]);

  const handleQueryChange = useCallback(
    (nextQuery) => {
      const normalizedQuery = String(nextQuery ?? "");
      queryRef.current = normalizedQuery;
      setQuery(normalizedQuery);
      onChange(toLegacyLocation(location, value, { query: normalizedQuery }));
    },
    [location, onChange, value],
  );

  const handleLocationChange = useCallback(
    (nextLocation, metadata) => {
      const nextQuery = String(metadata?.query ?? queryRef.current);
      queryRef.current = nextQuery;
      setQuery(nextQuery);
      onChange(toLegacyLocation(nextLocation, value, { query: nextQuery }));
    },
    [onChange, value],
  );

  if (providerNeedsKey(provider) && !apiKey) {
    const filterName =
      provider === "google" ? "defb_google_maps_key" : "defb_mapbox_key";
    return (
      <BaseControl id={name} label={field.label} help={field.description}>
        <Notice status="error" isDismissible={false}>
          {sprintf(
            __("API key missing. Add it via the %s filter.", "define-blocks"),
            filterName,
          )}
        </Notice>
        {error && (
          <p className="defb-field__error" role="alert">
            {error}
          </p>
        )}
      </BaseControl>
    );
  }

  return (
    <GeocoderControl
      id={name}
      label={field.label}
      help={field.description}
      error={error}
      value={location}
      onChange={handleLocationChange}
      query={query}
      onQueryChange={handleQueryChange}
      geocoder={geocoder}
      showAddress
      labels={{
        searchPlaceholder:
          field.placeholder || __("Search address…", "define-blocks"),
        searchLoading: __("Searching addresses", "define-blocks"),
        searchEmpty: __("No addresses found.", "define-blocks"),
        searchError: __("Address search failed.", "define-blocks"),
        minimumQuery: __(
          "Type at least 2 characters to search.",
          "define-blocks",
        ),
        reverseError: __("Reverse geocoding failed.", "define-blocks"),
        address: __("Address", "define-blocks"),
        latitude: __("Latitude", "define-blocks"),
        longitude: __("Longitude", "define-blocks"),
        clear: __("Clear location", "define-blocks"),
      }}
    />
  );
}

GeocoderField.handlesError = true;
