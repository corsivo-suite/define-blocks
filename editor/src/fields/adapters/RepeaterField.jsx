import { useCallback, useEffect, useMemo, useState } from "@wordpress/element";
import { __, sprintf } from "@wordpress/i18n";
import { Repeater } from "@corsivo-suite/wp-admin-ui/repeater";
import { getSortableI18n } from "./control-i18n";
import { buildEmpty } from "../../engine/values";
import { uid } from "../../engine/uid";
import { evaluateCondition } from "../../engine/conditions";
import { useBlockContext } from "../../store/hooks";
import { resolveType } from "../aliases";
import { getFieldComponent } from "../registry";
import { partitionRepeaterFields } from "../repeater";
import {
  createRepeaterItem,
  duplicateRepeaterItem,
  normalizeRepeaterItems,
  normalizeRepeaterLimit,
  repeaterFieldsNeedRootValues,
} from "./repeater-contract";

const getItemId = (item) => item._defb_id;

const formatExpandLabel = (itemLabel) =>
  sprintf(__("Expand %s", "define-blocks"), itemLabel);

const formatCollapseLabel = (itemLabel) =>
  sprintf(__("Collapse %s", "define-blocks"), itemLabel);

const formatDuplicateLabel = (itemLabel) =>
  sprintf(__("Duplicate %s", "define-blocks"), itemLabel);

const formatRemoveLabel = (itemLabel) =>
  sprintf(__("Remove %s", "define-blocks"), itemLabel);

export default function RepeaterField({ name, field, value, onChange }) {
  const rawItems = useMemo(() => (Array.isArray(value) ? value : []), [value]);
  const items = useMemo(
    () => normalizeRepeaterItems(rawItems, uid),
    [rawItems],
  );
  const fields = useMemo(() => field.fields || {}, [field.fields]);
  const { inlineFields, bodyFields } = useMemo(
    () => partitionRepeaterFields(fields),
    [fields],
  );
  const hasInlineFields = Object.keys(inlineFields).length > 0;
  const hasBodyFields = Object.keys(bodyFields).length > 0;
  const needsRootValues = useMemo(
    () => repeaterFieldsNeedRootValues(fields),
    [fields],
  );
  const { getData, subscribeAny, getFieldError, validateFields } =
    useBlockContext();
  const [rootValues, setRootValues] = useState(getData);
  const sortableI18n = getSortableI18n();

  useEffect(() => {
    if (!items.some((item, index) => item !== rawItems[index])) {
      return;
    }
    onChange(items);
  }, [items, onChange, rawItems]);

  useEffect(() => {
    if (!needsRootValues) {
      return undefined;
    }

    return subscribeAny((nextValues) => setRootValues(nextValues));
  }, [needsRootValues, subscribeAny]);

  const createItem = useCallback(
    () => createRepeaterItem(fields, uid, buildEmpty),
    [fields],
  );
  const duplicateItem = useCallback(
    (item) => duplicateRepeaterItem(item, uid),
    [],
  );
  const getItemLabel = useCallback(
    (item, index) => {
      if (field.previewKey && item[field.previewKey]) {
        return String(item[field.previewKey]);
      }
      return sprintf(__("Item %d", "define-blocks"), index + 1);
    },
    [field.previewKey],
  );

  const renderFields = useCallback(
    (fieldDefinitions, itemContext, placement = "body") => {
      const { item, index, onChange: onItemChange } = itemContext;
      const conditionValues = { ...item, $index: index, root: rootValues };

      return Object.entries(fieldDefinitions || {}).map(
        ([key, fieldDefinition]) => {
          if (
            fieldDefinition.condition &&
            !evaluateCondition(fieldDefinition.condition, conditionValues)
          ) {
            return null;
          }
          if (
            fieldDefinition.conditionHide &&
            evaluateCondition(fieldDefinition.conditionHide, conditionValues)
          ) {
            return null;
          }
          if (fieldDefinition.visible === false) {
            return null;
          }

          const resolvedType = resolveType(fieldDefinition.type);
          const Component = getFieldComponent(resolvedType);
          const fieldPath = `${name}.${index}.${key}`;
          const error = getFieldError(fieldPath);
          const style = { ...(fieldDefinition.style || {}) };
          if (fieldDefinition.width) {
            style.width = `${fieldDefinition.width}%`;
          }

          const renderNestedFields = (nestedFields) =>
            renderFields(nestedFields, itemContext);

          return (
            <div
              key={key}
              className={`defb-field${
                placement === "inline"
                  ? " defb-repeater-item__inline-field"
                  : ""
              }${error ? " defb-field--error" : ""}`}
              style={style}
              data-field-type={resolvedType}
              data-field-name={fieldPath}
            >
              <Component
                name={fieldPath}
                field={fieldDefinition}
                type={resolvedType}
                value={item[key]}
                onChange={(nextValue) =>
                  onItemChange({
                    ...item,
                    [key]: nextValue,
                  })
                }
                onBlur={validateFields}
                error={error}
                inline={placement === "inline"}
                renderFields={renderNestedFields}
              />
              {error && !Component.handlesError && (
                <p className="defb-field__error">{error}</p>
              )}
            </div>
          );
        },
      );
    },
    [getFieldError, name, rootValues, validateFields],
  );

  const renderItemInline = useCallback(
    (itemContext) => renderFields(inlineFields, itemContext, "inline"),
    [inlineFields, renderFields],
  );
  const renderItem = useCallback(
    (itemContext) => renderFields(bodyFields, itemContext),
    [bodyFields, renderFields],
  );

  return (
    <Repeater
      id={name}
      label={field.label}
      help={field.description}
      items={items}
      onChange={onChange}
      getItemId={getItemId}
      getItemLabel={getItemLabel}
      createItem={createItem}
      duplicateItem={duplicateItem}
      renderItemHeader={({ item, index }) => {
        const showPreviewLabel =
          !field.previewKey || inlineFields[field.previewKey] === undefined;
        return showPreviewLabel ? getItemLabel(item, index) : null;
      }}
      renderItemInline={hasInlineFields ? renderItemInline : undefined}
      renderItem={renderItem}
      minItems={normalizeRepeaterLimit(field.min, 0)}
      maxItems={normalizeRepeaterLimit(field.max, Infinity)}
      collapsible={hasBodyFields}
      addLabel={field.addLabel || __("Add Item", "define-blocks")}
      emptyState={__("No items.", "define-blocks")}
      itemsLabel={field.label || __("Repeater items", "define-blocks")}
      formatExpandLabel={formatExpandLabel}
      formatCollapseLabel={formatCollapseLabel}
      formatDuplicateLabel={formatDuplicateLabel}
      formatRemoveLabel={formatRemoveLabel}
      {...sortableI18n}
      className="defb-repeater"
    />
  );
}
