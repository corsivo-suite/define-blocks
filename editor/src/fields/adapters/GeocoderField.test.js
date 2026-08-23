import { createRoot } from "@wordpress/element";
// eslint-disable-next-line import/no-extraneous-dependencies
import { act } from "react";

const mockGeocoderControl = jest.fn(() => null);

jest.mock(
  "@wordpress/components",
  () => ({
    BaseControl: ({ children }) => children,
    Notice: ({ children }) => children,
  }),
  { virtual: true },
);

jest.mock("@corsivo-suite/wp-admin-maps", () => ({
  GeocoderControl: (props) => mockGeocoderControl(props),
}));

jest.mock("./map-provider", () => ({
  createFieldGeocoder: jest.fn(() => ({ search: jest.fn() })),
  getMapProvider: jest.fn(() => "osm"),
  providerNeedsKey: jest.fn(() => false),
}));

import GeocoderField from "./GeocoderField";

describe("GeocoderField adapter", () => {
  let container;
  let root;

  beforeEach(() => {
    window.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockGeocoderControl.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("keeps the search query separate from the editable address", () => {
    const onChange = jest.fn();
    const value = {
      query: "Sydney Opera House",
      address: "Custom meeting point",
      formatted_address: "Custom meeting point",
      latitude: -33.8568,
      longitude: 151.2153,
    };

    act(() => {
      root.render(
        <GeocoderField
          name="location"
          field={{ label: "Location" }}
          type="osm-geocoder"
          value={value}
          onChange={onChange}
        />,
      );
    });

    const controlProps = mockGeocoderControl.mock.lastCall[0];
    expect(controlProps.query).toBe("Sydney Opera House");
    expect(controlProps.value.address).toBe("Custom meeting point");
    expect(controlProps.showAddress).toBe(true);

    act(() => controlProps.onQueryChange("Sydney Harbour"));
    expect(onChange).toHaveBeenLastCalledWith({
      lat: -33.8568,
      lng: 151.2153,
      latitude: -33.8568,
      longitude: 151.2153,
      formatted_address: "Custom meeting point",
      address: "Custom meeting point",
      query: "Sydney Harbour",
    });

    act(() =>
      controlProps.onChange(
        {
          latitude: -33.8568,
          longitude: 151.2153,
          address: "Entrance B",
        },
        { type: "address", query: "Sydney Harbour" },
      ),
    );
    expect(onChange).toHaveBeenLastCalledWith({
      lat: -33.8568,
      lng: 151.2153,
      latitude: -33.8568,
      longitude: 151.2153,
      formatted_address: "Entrance B",
      address: "Entrance B",
      query: "Sydney Harbour",
    });
  });
});
