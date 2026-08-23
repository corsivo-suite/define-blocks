import {
  getLegacySelectionValues,
  mergeLinkChange,
  normalizeFieldOptions,
  normalizeGalleryImage,
  normalizeLinkValue,
  normalizeMediaValue,
  toLegacyLocation,
  toLegacySelections,
  toSemanticLocation,
} from "./value-contracts";

describe("Define Blocks adapter value contracts", () => {
  it("normalizes schema options without losing option metadata", () => {
    expect(
      normalizeFieldOptions([
        "draft",
        { value: 7, label: "Published", count: 3 },
        null,
      ]),
    ).toEqual([
      { value: "draft", label: "draft" },
      { value: "7", label: "Published", count: 3 },
    ]);
  });

  it("round-trips legacy object selections through primitive package values", () => {
    const previous = [
      { value: "12", label: "Twelve" },
      { value: "18", label: "Eighteen" },
    ];
    expect(getLegacySelectionValues(previous)).toEqual(["12", "18"]);
    expect(
      toLegacySelections(
        ["18", "25"],
        [{ value: "25", label: "Twenty five", ignored: true }],
        previous,
      ),
    ).toEqual([
      { value: "18", label: "Eighteen" },
      { value: "25", label: "Twenty five" },
    ]);
  });

  it("round-trips legacy map aliases without leaking provider data", () => {
    const previous = {
      lat: "41.9",
      lng: "12.5",
      formatted_address: "Roma",
      query: "Colosseo",
      providerResult: { id: 1 },
    };
    expect(toSemanticLocation(JSON.stringify(previous))).toEqual({
      latitude: 41.9,
      longitude: 12.5,
      address: "Roma",
    });
    expect(
      toLegacyLocation(
        {
          latitude: 45.46,
          longitude: 9.19,
          address: "Milano",
        },
        previous,
      ),
    ).toEqual({
      lat: 45.46,
      lng: 9.19,
      latitude: 45.46,
      longitude: 9.19,
      formatted_address: "Milano",
      address: "Milano",
      query: "Colosseo",
    });
  });

  it("rejects coordinates outside geographic ranges", () => {
    expect(toSemanticLocation({ latitude: 91, longitude: 12 })).toBeNull();
    expect(toSemanticLocation({ latitude: 41, longitude: -181 })).toBeNull();
    expect(toSemanticLocation({ latitude: null, longitude: null })).toBeNull();
  });

  it("does not coerce cleared or partial coordinates to zero", () => {
    expect(
      toLegacyLocation(
        {
          latitude: null,
          longitude: null,
          address: "",
        },
        { query: "Previous search" },
      ),
    ).toEqual({});
    expect(
      toLegacyLocation(
        {
          latitude: 45.46,
          longitude: "",
          address: "",
        },
        { query: "Previous search" },
        { query: "Current search" },
      ),
    ).toEqual({
      lat: 45.46,
      latitude: 45.46,
      formatted_address: "",
      address: "",
      query: "Current search",
    });
  });

  it("preserves address-only, query-only and partial location drafts", () => {
    expect(
      toSemanticLocation({
        address: "Custom address",
        latitude: null,
        longitude: null,
      }),
    ).toEqual({
      latitude: null,
      longitude: null,
      address: "Custom address",
    });
    expect(
      toSemanticLocation({
        latitude: -33.86,
        longitude: "",
      }),
    ).toEqual({
      latitude: -33.86,
      longitude: null,
      address: "",
    });
    expect(toLegacyLocation(null, {}, { query: "Sydney" })).toEqual({
      formatted_address: "",
      address: "",
      query: "Sydney",
    });
  });

  it("preserves public link and media shapes", () => {
    expect(normalizeLinkValue(null)).toEqual({
      url: "",
      title: "",
      opensInNewTab: false,
    });
    expect(
      normalizeMediaValue(
        {
          id: 7,
          url: "/document.pdf",
          filename: "document.pdf",
          filesizeHumanReadable: "20 KB",
          mime: "application/pdf",
        },
        "file",
      ),
    ).toEqual({
      id: 7,
      url: "/document.pdf",
      name: "document.pdf",
      size: "20 KB",
      mime: "application/pdf",
    });
    expect(
      normalizeMediaValue({
        id: 9,
        url: "/image.jpg",
      }),
    ).toEqual({
      id: 9,
      url: "/image.jpg",
      alt: "",
      title: "",
      sizes: {},
    });
    expect(
      normalizeGalleryImage({
        id: 10,
        url: "/gallery.jpg",
        alt: "Alt",
        title: "Title",
        sizes: { thumbnail: { url: "/thumb.jpg" } },
        focus: { x: 0.5, y: 0.5 },
      }),
    ).toEqual({
      id: 10,
      url: "/gallery.jpg",
      alt: "Alt",
      title: "Title",
    });
  });

  it("fills a post suggestion title only when the link title is empty", () => {
    const suggestion = { url: "/post", title: "Suggested post" };

    expect(
      mergeLinkChange(
        { url: "/old", title: "Custom title", opensInNewTab: true },
        { url: "/post", title: "", opensInNewTab: true },
        suggestion,
      ),
    ).toEqual({
      url: "/post",
      title: "Custom title",
      opensInNewTab: true,
    });
    expect(
      mergeLinkChange(
        { url: "/old", title: "", opensInNewTab: false },
        { url: "/post", title: "", opensInNewTab: false },
        suggestion,
      ),
    ).toEqual({
      url: "/post",
      title: "Suggested post",
      opensInNewTab: false,
    });
  });
});
