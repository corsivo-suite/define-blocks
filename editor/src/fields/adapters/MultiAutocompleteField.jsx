import { useCallback, useMemo } from "@wordpress/element";
import apiFetch from "@wordpress/api-fetch";
import { addQueryArgs } from "@wordpress/url";
import { AsyncMultiSelect } from "@corsivo-suite/wp-admin-ui/async-multi-select";
import { EntitySelector } from "@corsivo-suite/wp-admin-ui/entity-selector";
import { getSelectionI18n, getSortableI18n } from "./control-i18n";
import {
  getLegacySelectionValues,
  normalizeFieldOptions,
  normalizeLegacySelections,
  toLegacySelections,
} from "./value-contracts";

export default function MultiAutocompleteField({
  id,
  field,
  value,
  onChange,
  onBlur,
  error,
}) {
  const selectedOptions = useMemo(
    () => normalizeLegacySelections(value),
    [value],
  );
  const staticOptions = useMemo(
    () => normalizeFieldOptions(field.options),
    [field.options],
  );
  const options = useMemo(() => {
    const optionValues = new Set(staticOptions.map((option) => option.value));
    return [
      ...staticOptions,
      ...selectedOptions.filter((option) => !optionValues.has(option.value)),
    ];
  }, [selectedOptions, staticOptions]);
  const selectedValues = useMemo(
    () => getLegacySelectionValues(value),
    [value],
  );
  const minimumQueryLength = field.postType ? 2 : 0;
  const controlI18n = getSelectionI18n(field.placeholder, minimumQueryLength);
  const sortableI18n = getSortableI18n();
  const loadOptions = useCallback(
    async (query, { signal }) => {
      const posts = await apiFetch({
        path: addQueryArgs("/defb/v1/posts/search", {
          s: query,
          post_type: field.postType,
        }),
        signal,
      });

      return (posts || []).map((post) => ({
        value: String(post.id),
        label: post.title,
      }));
    },
    [field.postType],
  );
  const SelectionControl = field.draggable ? EntitySelector : AsyncMultiSelect;

  return (
    <SelectionControl
      id={id}
      label={field.label}
      help={field.description}
      error={error}
      value={selectedValues}
      onChange={(nextValues, nextOptions) =>
        onChange(toLegacySelections(nextValues, nextOptions, selectedOptions))
      }
      onBlur={onBlur}
      options={options}
      loadOptions={field.postType ? loadOptions : undefined}
      minQueryLength={minimumQueryLength}
      debounceMs={300}
      allowReorder={Boolean(field.draggable)}
      {...controlI18n}
      {...(field.draggable ? sortableI18n : {})}
    />
  );
}

MultiAutocompleteField.handlesError = true;
