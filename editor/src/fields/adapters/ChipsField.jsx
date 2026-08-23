import { useMemo } from "@wordpress/element";
import { __ } from "@wordpress/i18n";
import { CreatableSortableMultiSelect } from "@corsivo-suite/wp-admin-ui/creatable-sortable-multi-select";
import { getSelectionI18n, getSortableI18n } from "./control-i18n";
import {
  getLegacySelectionValues,
  normalizeFieldOptions,
  normalizeLegacySelections,
  toLegacySelections,
} from "./value-contracts";

export default function ChipsField({
  name,
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
  const schemaOptions = useMemo(
    () => normalizeFieldOptions(field.options),
    [field.options],
  );
  const options = useMemo(
    () => [...schemaOptions, ...selectedOptions],
    [schemaOptions, selectedOptions],
  );
  const createLabel = field.createLabel || __("Create", "define-blocks");
  const controlI18n = getSelectionI18n(field.placeholder);
  const sortableI18n = getSortableI18n();

  return (
    <CreatableSortableMultiSelect
      id={name}
      label={field.label}
      help={field.description}
      error={error}
      value={getLegacySelectionValues(value)}
      onChange={(nextValues, nextOptions) =>
        onChange(toLegacySelections(nextValues, nextOptions, selectedOptions))
      }
      onBlur={onBlur}
      options={options}
      allowCreate
      allowReorder={Boolean(field.draggable)}
      createOption={(inputValue) => ({
        value: inputValue,
        label: inputValue,
        isCreated: true,
      })}
      renderOption={(option) =>
        option.isCreated ? `${createLabel}: ${option.label}` : option.label
      }
      {...controlI18n}
      {...sortableI18n}
    />
  );
}

ChipsField.handlesError = true;
