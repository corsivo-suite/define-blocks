import { useCallback } from "@wordpress/element";
import { __ } from "@wordpress/i18n";
import { LinkControl } from "@corsivo-suite/wp-admin-ui/link-control";
import { getUrlI18n } from "./control-i18n";
import { mergeLinkChange, normalizeLinkValue } from "./value-contracts";
import { loadPostOptions } from "./post-options";

export default function LinkField({
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
  const handleChange = useCallback(
    (nextValue, metadata) => {
      onChange(mergeLinkChange(value, nextValue, metadata));
    },
    [onChange, value],
  );
  const minimumQueryLength = field.postType ? 2 : 0;
  const controlI18n = getUrlI18n(
    field.placeholder,
    field.postType,
    minimumQueryLength,
  );

  return (
    <LinkControl
      id={name}
      label={field.label}
      help={field.description}
      error={error}
      value={normalizeLinkValue(value)}
      onChange={handleChange}
      onBlur={onBlur}
      loadSuggestions={field.postType ? loadSuggestions : undefined}
      urlLabel={__("URL", "define-blocks")}
      titleLabel={field.titlePlaceholder || __("Link text", "define-blocks")}
      newTabLabel={__("Open in new tab", "define-blocks")}
      minQueryLength={minimumQueryLength}
      debounceMs={300}
      {...controlI18n}
    />
  );
}

LinkField.handlesError = true;
