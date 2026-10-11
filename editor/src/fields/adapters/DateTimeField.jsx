import { __ } from "@wordpress/i18n";
import { DateTimeControl } from "@corsivo-suite/wp-admin-ui/date-time-control";
import {
  getTimeControlValue,
  restoreLegacyTimeValue,
} from "./date-time-contract";

const getPlaceholder = (mode) => {
  if (mode === "date") {
    return __("Select date", "define-blocks");
  }

  if (mode === "time") {
    return __("Select time", "define-blocks");
  }

  return __("Select date and time", "define-blocks");
};

export default function DateTimeField({
  id,
  field,
  type,
  value,
  onChange,
  error,
}) {
  const mode = type || field.type || "date";
  const hasSeconds =
    typeof value === "string" && /:\d{2}:\d{2}(?:$|[+-Z])/.test(value);
  const includeSeconds =
    field.includeSeconds ?? (mode === "datetime" || hasSeconds);
  const controlValue =
    mode === "time" ? getTimeControlValue(value) : value || "";

  return (
    <DateTimeControl
      id={id}
      label={field.label}
      help={field.description}
      error={error}
      value={controlValue}
      onChange={(nextValue) =>
        onChange(
          mode === "time"
            ? restoreLegacyTimeValue(value, nextValue)
            : nextValue,
        )
      }
      mode={mode}
      placeholder={field.placeholder || getPlaceholder(mode)}
      includeSeconds={includeSeconds}
      startOfWeek={field.startOfWeek}
      clearable={field.clearable !== false}
      timeLabel={__("Time", "define-blocks")}
      clearLabel={__("Clear", "define-blocks")}
    />
  );
}

DateTimeField.handlesError = true;
