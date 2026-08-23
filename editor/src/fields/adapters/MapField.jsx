import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "@wordpress/element";
import { InspectorControls } from "@wordpress/block-editor";
import { BaseControl, Notice, PanelBody } from "@wordpress/components";
import { __, sprintf } from "@wordpress/i18n";
import { GeocoderControl, MapCanvas } from "@corsivo-suite/wp-admin-maps";
import {
  createFieldGeocoder,
  createFieldRenderer,
  getMapProvider,
  providerNeedsKey,
} from "./map-provider";
import {
  createReverseCoordinator,
  shouldReverseCanvasLocation,
} from "./map-reverse";
import {
  parseLegacyObject,
  toLegacyLocation,
  toSemanticLocation,
} from "./value-contracts";

const getLabels = () => ({
  map: __("Map", "define-blocks"),
  loading: __("Loading map", "define-blocks"),
  error: __("The map could not be loaded.", "define-blocks"),
  searchPlaceholder: __("Search address…", "define-blocks"),
  searchLoading: __("Searching addresses", "define-blocks"),
  searchEmpty: __("No addresses found.", "define-blocks"),
  searchError: __("Address search failed.", "define-blocks"),
  minimumQuery: __("Type at least 2 characters to search.", "define-blocks"),
  reverseError: __("Reverse geocoding failed.", "define-blocks"),
  address: __("Address", "define-blocks"),
  latitude: __("Latitude", "define-blocks"),
  longitude: __("Longitude", "define-blocks"),
  clear: __("Clear location", "define-blocks"),
});

const getMetadataQuery = (metadata, fallback) => {
  if (typeof metadata === "string") {
    return metadata;
  }

  if (!metadata || typeof metadata !== "object") {
    return fallback;
  }

  const candidates = [
    metadata.query,
    metadata.metadata?.query,
    metadata.option?.query,
    metadata.suggestion?.query,
  ];
  const query = candidates.find((candidate) => candidate !== undefined);
  return query === undefined ? fallback : String(query ?? "");
};

export default function MapField({
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
  const {
    attribution,
    geocodingOptions,
    language,
    loaderOptions,
    mapId,
    mapOptions,
    reverseGeocodingOptions,
    styleUrl,
    tileUrl,
    zoom,
  } = field;
  const [providerError, setProviderError] = useState("");
  const reverseCoordinatorRef = useRef(null);
  const location = useMemo(() => toSemanticLocation(value), [value]);
  const savedQuery = useMemo(
    () => String(parseLegacyObject(value).query ?? ""),
    [value],
  );
  const [query, setQuery] = useState(savedQuery);
  const queryRef = useRef(savedQuery);
  if (!reverseCoordinatorRef.current) {
    reverseCoordinatorRef.current = createReverseCoordinator();
  }
  const geocoderField = useMemo(
    () => ({
      geocodingOptions,
      language,
      loaderOptions,
      reverseGeocodingOptions,
    }),
    [geocodingOptions, language, loaderOptions, reverseGeocodingOptions],
  );
  const rendererField = useMemo(
    () => ({
      attribution,
      loaderOptions,
      mapId,
      mapOptions,
      styleUrl,
      tileUrl,
      zoom,
    }),
    [attribution, loaderOptions, mapId, mapOptions, styleUrl, tileUrl, zoom],
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
  const renderer = useMemo(
    () =>
      createFieldRenderer(provider, rendererField, providerKeys, {
        onStyleFallback: () =>
          setProviderError(
            __(
              "This map style is not supported. The default Mapbox style is being used.",
              "define-blocks",
            ),
          ),
        onTileError: () =>
          setProviderError(
            __(
              "Map tiles could not be loaded. Check the provider configuration.",
              "define-blocks",
            ),
          ),
      }),
    [provider, providerKeys, rendererField],
  );
  const labels = useMemo(getLabels, []);

  const cancelReverse = useCallback(() => {
    reverseCoordinatorRef.current.cancel();
  }, []);

  useEffect(() => {
    queryRef.current = savedQuery;
    setQuery(savedQuery);
  }, [savedQuery]);

  useEffect(() => () => cancelReverse(), [cancelReverse]);

  const commitLocation = useCallback(
    (nextLocation, metadata) => {
      const nextQuery = getMetadataQuery(metadata, queryRef.current);
      const nextValue = toLegacyLocation(nextLocation, value, {
        query: nextQuery,
      });
      queryRef.current = Object.keys(nextValue).length ? nextQuery : "";
      onChange(nextValue);
    },
    [onChange, value],
  );

  const handleGeocoderChange = useCallback(
    (nextLocation, metadata) => {
      cancelReverse();
      commitLocation(nextLocation, metadata);
    },
    [cancelReverse, commitLocation],
  );

  const handleQueryChange = useCallback(
    (nextQuery) => {
      cancelReverse();
      const normalizedQuery = String(nextQuery ?? "");
      queryRef.current = normalizedQuery;
      setQuery(normalizedQuery);
      onChange(toLegacyLocation(location, value, { query: normalizedQuery }));
    },
    [cancelReverse, location, onChange, value],
  );

  const handleCanvasChange = useCallback(
    async (nextLocation) => {
      cancelReverse();
      commitLocation(nextLocation);

      if (!shouldReverseCanvasLocation(provider, geocoder)) {
        return;
      }

      await reverseCoordinatorRef.current.run(
        (signal) => geocoder.reverse(nextLocation, { signal }),
        (option) => {
          if (option?.location) {
            commitLocation(option.location, { query: queryRef.current });
          }
        },
        (reverseError) => {
          setProviderError(reverseError.message || labels.reverseError);
        },
      );
    },
    [cancelReverse, commitLocation, geocoder, labels.reverseError, provider],
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
    <>
      <InspectorControls>
        <PanelBody
          title={field.label || __("Map", "define-blocks")}
          initialOpen
        >
          <GeocoderControl
            id={`${name}-location`}
            value={location}
            onChange={handleGeocoderChange}
            query={query}
            onQueryChange={handleQueryChange}
            geocoder={geocoder}
            reverseGeocode={false}
            labels={labels}
            showCoordinates
            showAddress
            allowClear
          />
        </PanelBody>
      </InspectorControls>
      <BaseControl id={name} label={field.label} help={field.description}>
        <MapCanvas
          renderer={renderer}
          location={location}
          onLocationChange={handleCanvasChange}
          height={Number(field.height) || 320}
          labels={labels}
        />
        {providerError && (
          <Notice status="warning" isDismissible={false}>
            {providerError}
          </Notice>
        )}
        {error && (
          <p className="defb-field__error" role="alert">
            {error}
          </p>
        )}
      </BaseControl>
    </>
  );
}

MapField.handlesError = true;
