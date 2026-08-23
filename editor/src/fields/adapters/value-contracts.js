export function parseLegacyObject(value) {
  if (typeof value !== "string") {
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

export function normalizeFieldOption(option) {
  if (typeof option === "string" || typeof option === "number") {
    return { value: String(option), label: String(option) };
  }

  if (!option || typeof option !== "object" || option.value === undefined) {
    return null;
  }

  return {
    ...option,
    value: String(option.value),
    label: String(option.label ?? option.value),
  };
}

export function normalizeFieldOptions(options) {
  return (Array.isArray(options) ? options : [])
    .map(normalizeFieldOption)
    .filter(Boolean);
}

export function normalizeLegacySelections(selections) {
  return (Array.isArray(selections) ? selections : [])
    .map(normalizeFieldOption)
    .filter(Boolean);
}

export function getLegacySelectionValues(selections) {
  return normalizeLegacySelections(selections).map((option) => option.value);
}

export function toLegacySelections(
  values,
  options = [],
  previousSelections = [],
) {
  const candidates = [
    ...normalizeFieldOptions(options),
    ...normalizeLegacySelections(previousSelections),
  ];

  return (Array.isArray(values) ? values : []).map((value) => {
    const normalizedValue = String(value);
    const option = candidates.find(
      (candidate) => candidate.value === normalizedValue,
    );
    return {
      value: normalizedValue,
      label: option?.label || normalizedValue,
    };
  });
}

export function toSemanticLocation(value) {
  const legacyLocation = parseLegacyObject(value);
  const rawLatitude = legacyLocation.latitude ?? legacyLocation.lat;
  const rawLongitude = legacyLocation.longitude ?? legacyLocation.lng;
  const hasLatitude =
    rawLatitude !== null && rawLatitude !== undefined && rawLatitude !== "";
  const hasLongitude =
    rawLongitude !== null && rawLongitude !== undefined && rawLongitude !== "";
  const latitude = !hasLatitude ? null : Number(rawLatitude);
  const longitude = !hasLongitude ? null : Number(rawLongitude);
  if (
    (hasLatitude &&
      (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
    (hasLongitude &&
      (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))
  ) {
    return null;
  }

  const address = String(
    legacyLocation.address ?? legacyLocation.formatted_address ?? "",
  );

  if (!hasLatitude && !hasLongitude && !address) {
    return null;
  }

  return {
    latitude,
    longitude,
    address,
  };
}

function getLocationQuery(metadata) {
  if (typeof metadata === "string") {
    return metadata;
  }

  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }

  const candidates = [
    metadata.query,
    metadata.metadata?.query,
    metadata.option?.query,
    metadata.suggestion?.query,
  ];
  const query = candidates.find((candidate) => candidate !== undefined);
  return query === undefined ? undefined : String(query ?? "");
}

export function toLegacyLocation(location, previousValue = {}, metadata) {
  const semanticLocation =
    location && typeof location === "object" && !Array.isArray(location)
      ? location
      : {};

  const rawLatitude = semanticLocation.latitude ?? semanticLocation.lat;
  const rawLongitude = semanticLocation.longitude ?? semanticLocation.lng;
  const latitude =
    rawLatitude === null || rawLatitude === undefined || rawLatitude === ""
      ? null
      : Number(rawLatitude);
  const longitude =
    rawLongitude === null || rawLongitude === undefined || rawLongitude === ""
      ? null
      : Number(rawLongitude);
  const hasLatitude =
    Number.isFinite(latitude) && latitude >= -90 && latitude <= 90;
  const hasLongitude =
    Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
  const address = String(
    semanticLocation.address ?? semanticLocation.formatted_address ?? "",
  );
  const metadataQuery = getLocationQuery(metadata);

  if (!hasLatitude && !hasLongitude && !address && !metadataQuery) {
    return {};
  }

  const previousLocation = parseLegacyObject(previousValue);

  return {
    ...(hasLatitude ? { lat: latitude, latitude } : {}),
    ...(hasLongitude ? { lng: longitude, longitude } : {}),
    formatted_address: address,
    address,
    query: metadataQuery ?? String(previousLocation.query ?? address),
  };
}

export function normalizeLinkValue(value) {
  const link = parseLegacyObject(value);
  return {
    url: String(link.url || ""),
    title: String(link.title || ""),
    opensInNewTab: Boolean(link.opensInNewTab),
  };
}

function getSuggestionTitle(metadata) {
  if (!metadata || typeof metadata !== "object") {
    return "";
  }

  const suggestion =
    metadata.suggestion && typeof metadata.suggestion === "object"
      ? metadata.suggestion
      : metadata;
  const candidates = [
    suggestion.title,
    suggestion.label,
    suggestion.metadata?.title,
    metadata.metadata?.title,
  ];
  const title = candidates.find((candidate) => String(candidate ?? "").trim());
  return title === undefined ? "" : String(title);
}

export function mergeLinkChange(previousValue, nextValue, metadata) {
  const previousLink = normalizeLinkValue(previousValue);
  const nextLink = normalizeLinkValue({
    ...previousLink,
    ...parseLegacyObject(nextValue),
  });
  const suggestionTitle = getSuggestionTitle(metadata);

  if (suggestionTitle) {
    if (previousLink.title.trim()) {
      nextLink.title = previousLink.title;
    } else if (!nextLink.title.trim()) {
      nextLink.title = suggestionTitle;
    }
  }

  return nextLink;
}

export function normalizeMediaValue(media, kind = "media") {
  if (!media || typeof media !== "object" || Array.isArray(media)) {
    return {};
  }

  if (kind === "file") {
    return {
      id: media.id,
      url: media.url || "",
      name: media.filename || media.name || media.title || "",
      size: media.filesizeHumanReadable || media.size || "",
      mime: media.mime || "",
    };
  }

  return {
    id: media.id ?? media.ID,
    url: media.url || "",
    alt: media.alt || "",
    title: media.title || "",
    sizes: media.sizes && typeof media.sizes === "object" ? media.sizes : {},
  };
}

export function normalizeGalleryImage(media) {
  const normalizedMedia = normalizeMediaValue(media);

  if (normalizedMedia.id === undefined || normalizedMedia.id === null) {
    return {};
  }

  return {
    id: normalizedMedia.id,
    url: normalizedMedia.url,
    alt: normalizedMedia.alt,
    title: normalizedMedia.title,
  };
}
