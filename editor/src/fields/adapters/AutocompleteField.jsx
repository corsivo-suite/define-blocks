import { useCallback, useMemo } from "@wordpress/element";
import apiFetch from "@wordpress/api-fetch";
import { addQueryArgs } from "@wordpress/url";
import { AsyncCombobox } from "@corsivo-suite/wp-admin-ui/async-combobox";
import { getSelectionI18n } from "./control-i18n";
import { normalizeFieldOptions } from "./value-contracts";

export default function AutocompleteField({
  name,
  field,
  value,
  onChange,
  onBlur,
  error,
}) {
  const options = useMemo(
    () => normalizeFieldOptions(field.options),
    [field.options],
  );
  const minimumQueryLength = field.postType ? 2 : 0;
  const controlI18n = getSelectionI18n(field.placeholder, minimumQueryLength);
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
  const resolveValue = useCallback(async (selectedValue, { signal }) => {
    const post = await apiFetch({
      path: `/defb/v1/posts/preview/${String(selectedValue)}`,
      signal,
    });

    return post?.post_title
      ? {
          value: String(selectedValue),
          label: post.post_title,
        }
      : null;
  }, []);

  return (
    <AsyncCombobox
      id={name}
      label={field.label}
      help={field.description}
      error={error}
      value={value ?? ""}
      onChange={(selectedValue) => onChange(selectedValue ?? "")}
      onBlur={onBlur}
      options={options}
      loadOptions={field.postType ? loadOptions : undefined}
      resolveValue={field.postType ? resolveValue : undefined}
      minQueryLength={minimumQueryLength}
      debounceMs={300}
      clearable={field.clearable !== false}
      {...controlI18n}
    />
  );
}

AutocompleteField.handlesError = true;
