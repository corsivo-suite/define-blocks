import { useCallback } from "@wordpress/element";
import { UrlControl } from "@corsivo-suite/wp-admin-ui/url-control";
import { getUrlI18n } from "./control-i18n";
import { loadPostOptions } from "./post-options";

export default function UrlField({
  name,
  field,
  value,
  onChange,
  onBlur,
  error,
}) {
  const loadSuggestions = useCallback(
    (query, context) => loadPostOptions(field.postType, query, context),
    [field.postType],
  );
  const minimumQueryLength = field.postType ? 2 : 0;
  const controlI18n = getUrlI18n(
    field.placeholder,
    field.postType,
    minimumQueryLength,
  );

  return (
    <UrlControl
      id={name}
      label={field.label}
      help={field.description}
      error={error}
      value={value ?? ""}
      onChange={onChange}
      onBlur={onBlur}
      loadSuggestions={field.postType ? loadSuggestions : undefined}
      minQueryLength={minimumQueryLength}
      debounceMs={300}
      {...controlI18n}
    />
  );
}

UrlField.handlesError = true;
