import { getSelectionI18n, getSortableI18n, getUrlI18n } from "./control-i18n";

describe("adapter control translations", () => {
  it("builds selection messages and accessible remove labels", () => {
    const labels = getSelectionI18n("", 2);

    expect(labels).toEqual(
      expect.objectContaining({
        placeholder: "Search…",
        noOptionsMessage: "No results found.",
        loadingMessage: "Loading results…",
        loadErrorMessage: "Unable to load results.",
        minimumQueryMessage: "Type at least 2 characters to search.",
        clearLabel: "Clear selection",
        selectedItemsLabel: "Selected items",
        removeItemLabel: "Remove",
      }),
    );
    expect(labels.formatRemoveLabel("Roma")).toBe("Remove Roma");
  });

  it("builds URL and content search messages separately", () => {
    expect(getUrlI18n("", "post", 2)).toEqual({
      searchLabel: "Search content",
      searchPlaceholder: "Search…",
      placeholder: "https://",
      noSuggestionsMessage: "No post found.",
      loadingMessage: "Searching links…",
      loadErrorMessage: "Unable to search links.",
      minimumQueryMessage: "Type at least 2 characters to search.",
    });
  });

  it("formats every sortable announcement in the consumer text domain", () => {
    const labels = getSortableI18n();
    const overContext = {
      itemLabel: "Roma",
      overId: "milan",
      position: 2,
      total: 3,
    };

    expect(labels.formatHandleLabel("Roma")).toBe("Reorder Roma");
    expect(labels.announcements.onDragStart(overContext)).toBe(
      "Picked up Roma.",
    );
    expect(labels.announcements.onDragOver(overContext)).toBe(
      "Roma is over position 2 of 3.",
    );
    expect(labels.announcements.onDragEnd(overContext)).toBe(
      "Dropped Roma at position 2 of 3.",
    );
    expect(labels.announcements.onDragCancel(overContext)).toBe(
      "Moving Roma was cancelled.",
    );
    expect(
      labels.announcements.onDragOver({ ...overContext, overId: null }),
    ).toBe("Roma is no longer over a drop target.");
    expect(
      labels.announcements.onDragEnd({ ...overContext, overId: null }),
    ).toBe("Roma was dropped without moving.");
  });
});
