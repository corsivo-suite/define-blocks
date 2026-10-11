import { useCallback, useMemo } from "@wordpress/element";
import { __ } from "@wordpress/i18n";
import { EntitySelector } from "@corsivo-suite/wp-admin-ui/entity-selector";
import { getSelectionI18n, getSortableI18n } from "./control-i18n";
import {
  loadPostOptions,
  normalizePostOption,
  toLegacyPosts,
} from "./post-options";

export default function PostSelectorField({
  id,
  field,
  value,
  onChange,
  onBlur,
  error,
}) {
  const selectedPosts = useMemo(
    () => (Array.isArray(value) ? value : []),
    [value],
  );
  const selectedOptions = useMemo(
    () => selectedPosts.map(normalizePostOption).filter(Boolean),
    [selectedPosts],
  );
  const loadOptions = useCallback(
    (query, context) =>
      loadPostOptions(field.postType || "post", query, context),
    [field.postType],
  );
  const controlI18n = getSelectionI18n(
    field.placeholder || __("Search posts…", "define-blocks"),
    2,
  );
  const sortableI18n = getSortableI18n();

  return (
    <EntitySelector
      id={id}
      label={field.label}
      help={field.description}
      error={error}
      value={selectedOptions.map((option) => option.value)}
      onChange={(nextValues, nextOptions) =>
        onChange(toLegacyPosts(nextValues, nextOptions, selectedPosts))
      }
      onBlur={onBlur}
      options={selectedOptions}
      loadOptions={loadOptions}
      minQueryLength={2}
      debounceMs={400}
      allowReorder
      renderSelectedItem={(option) => (
        <>
          {option.thumbnail && <img src={option.thumbnail} alt="" />}
          <span>{option.title || option.label}</span>
        </>
      )}
      {...controlI18n}
      {...sortableI18n}
    />
  );
}

PostSelectorField.handlesError = true;
