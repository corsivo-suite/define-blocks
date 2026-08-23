import { __, sprintf } from "@wordpress/i18n";

const formatRemoveLabel = (itemLabel) =>
  sprintf(__("Remove %s", "define-blocks"), itemLabel);

const formatHandleLabel = (itemLabel) =>
  sprintf(__("Reorder %s", "define-blocks"), itemLabel);

const screenReaderInstructions = __(
  "To pick up an item, press space or enter. Use the arrow keys to move it, press space or enter to drop it, or press escape to cancel.",
  "define-blocks",
);

const announcements = {
  onDragStart: ({ itemLabel }) =>
    sprintf(__("Picked up %s.", "define-blocks"), itemLabel),
  onDragOver: ({ itemLabel, overId, position, total }) =>
    overId === null
      ? sprintf(
          __("%s is no longer over a drop target.", "define-blocks"),
          itemLabel,
        )
      : sprintf(
          __("%1$s is over position %2$d of %3$d.", "define-blocks"),
          itemLabel,
          position,
          total,
        ),
  onDragEnd: ({ itemLabel, overId, position, total }) =>
    overId === null
      ? sprintf(
          __("%s was dropped without moving.", "define-blocks"),
          itemLabel,
        )
      : sprintf(
          __("Dropped %1$s at position %2$d of %3$d.", "define-blocks"),
          itemLabel,
          position,
          total,
        ),
  onDragCancel: ({ itemLabel }) =>
    sprintf(__("Moving %s was cancelled.", "define-blocks"), itemLabel),
};

export function getSelectionI18n(placeholder, minimumQueryLength = 0) {
  return {
    placeholder: placeholder || __("Search…", "define-blocks"),
    noOptionsMessage: __("No results found.", "define-blocks"),
    loadingMessage: __("Loading results…", "define-blocks"),
    loadErrorMessage: __("Unable to load results.", "define-blocks"),
    minimumQueryMessage:
      minimumQueryLength > 0
        ? sprintf(
            __("Type at least %d characters to search.", "define-blocks"),
            minimumQueryLength,
          )
        : __("Type more characters to search.", "define-blocks"),
    clearLabel: __("Clear selection", "define-blocks"),
    selectedItemsLabel: __("Selected items", "define-blocks"),
    removeItemLabel: __("Remove", "define-blocks"),
    formatRemoveLabel,
  };
}

export function getUrlI18n(placeholder, postType, minimumQueryLength = 0) {
  return {
    searchLabel: __("Search content", "define-blocks"),
    searchPlaceholder: __("Search…", "define-blocks"),
    placeholder: placeholder || "https://",
    noSuggestionsMessage: sprintf(
      __("No %s found.", "define-blocks"),
      postType || __("links", "define-blocks"),
    ),
    loadingMessage: __("Searching links…", "define-blocks"),
    loadErrorMessage: __("Unable to search links.", "define-blocks"),
    minimumQueryMessage:
      minimumQueryLength > 0
        ? sprintf(
            __("Type at least %d characters to search.", "define-blocks"),
            minimumQueryLength,
          )
        : __("Type more characters to search.", "define-blocks"),
  };
}

export function getSortableI18n() {
  return {
    formatHandleLabel,
    screenReaderInstructions,
    announcements,
  };
}
