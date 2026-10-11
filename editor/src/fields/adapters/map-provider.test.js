const mockCreateMapboxGeocoder = jest.fn((options) => options);
const mockCreateMapboxRenderer = jest.fn((options) => options);
const mockCreateLeafletRenderer = jest.fn((options) => options);

jest.mock("@corsivo-suite/wp-admin-maps", () => ({
  hasCoordinates: jest.fn(),
  normalizeLocation: jest.fn(),
}));
jest.mock("@corsivo-suite/wp-admin-maps/google", () => ({
  createGoogleGeocoder: jest.fn(),
  createGoogleRenderer: jest.fn(),
}));
jest.mock("@corsivo-suite/wp-admin-maps/leaflet", () => ({
  createLeafletRenderer: (options) => mockCreateLeafletRenderer(options),
}));
jest.mock("@corsivo-suite/wp-admin-maps/mapbox", () => ({
  createMapboxGeocoder: (options) => mockCreateMapboxGeocoder(options),
  createMapboxRenderer: (options) => mockCreateMapboxRenderer(options),
}));

import { createFieldGeocoder, createFieldRenderer } from "./map-provider";

describe("map provider adapter", () => {
  it("forwards dedicated OSM endpoints from the field schema", async () => {
    const originalFetch = window.fetch;
    window.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [] });
    try {
      const geocoder = createFieldGeocoder("osm", {
        searchEndpoint: "https://geo.example.test/search",
        reverseEndpoint: "https://geo.example.test/reverse",
      }, {});
      expect(geocoder.requiresSubmit).toBe(false);
      await geocoder.search("Roma");
      expect(window.fetch.mock.calls[0][0].origin).toBe("https://geo.example.test");
    } finally {
      window.fetch = originalFetch;
    }
  });
  it("forces permanent Mapbox geocoding when results are persisted", () => {
    createFieldGeocoder(
      "mapbox",
      {
        geocodingOptions: { language: "it", permanent: false },
        reverseGeocodingOptions: { types: ["address"], permanent: false },
      },
      { mapbox: "token" },
    );

    expect(mockCreateMapboxGeocoder).toHaveBeenCalledWith({
      accessToken: "token",
      searchOptions: { language: "it", permanent: true },
      reverseOptions: { types: ["address"], permanent: true },
    });
  });

  it("passes map options to the Leaflet renderers", () => {
    const mapOptions = { scrollWheelZoom: false, dragging: false };

    createFieldRenderer(
      "mapbox",
      { mapOptions, zoom: 10 },
      { mapbox: "token" },
    );
    createFieldRenderer("osm", { mapOptions, zoom: 10 }, {});

    expect(mockCreateMapboxRenderer).toHaveBeenCalledWith(
      expect.objectContaining({
        mapOptions,
        scrollWheelZoomModifier: "Control",
      }),
    );
    expect(mockCreateLeafletRenderer).toHaveBeenCalledWith(
      expect.objectContaining({
        mapOptions,
        scrollWheelZoomModifier: "Control",
      }),
    );
  });
});
