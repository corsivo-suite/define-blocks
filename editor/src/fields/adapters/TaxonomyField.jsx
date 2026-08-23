import { useCallback, useEffect, useMemo, useState } from "@wordpress/element";
import { useDispatch, useSelect } from "@wordpress/data";
import { __ } from "@wordpress/i18n";
import apiFetch from "@wordpress/api-fetch";
import { addQueryArgs } from "@wordpress/url";
import { CreatableSortableMultiSelect } from "@corsivo-suite/wp-admin-ui/creatable-sortable-multi-select";
import { getSelectionI18n, getSortableI18n } from "./control-i18n";
import {
  getLegacySelectionValues,
  normalizeLegacySelections,
  toLegacySelections,
} from "./value-contracts";
import {
  buildTaxonomyRestPath,
  normalizeTermOption,
  replacePendingTermOption,
} from "./taxonomy-options";

const TERMS_PER_PAGE = 100;

export default function TaxonomyField({
  name,
  field,
  value,
  onChange,
  onBlur,
  error,
}) {
  const taxonomySlug = field.taxonomy || "category";
  const { createErrorNotice } = useDispatch("core/notices");
  const [terms, setTerms] = useState(null);
  const selectedOptions = useMemo(
    () => normalizeLegacySelections(value),
    [value],
  );
  const selectedValues = useMemo(
    () => getLegacySelectionValues(value),
    [value],
  );
  const taxonomy = useSelect(
    (select) => select("core").getTaxonomy(taxonomySlug),
    [taxonomySlug],
  );
  const resolvedRestBase = field.restBase || taxonomy?.rest_base;
  const resolvedRestNamespace =
    field.restNamespace || taxonomy?.rest_namespace || "wp/v2";
  const restPath = resolvedRestBase
    ? buildTaxonomyRestPath(resolvedRestNamespace, resolvedRestBase)
    : "";

  useEffect(() => {
    setTerms(null);
    if (!restPath) {
      return undefined;
    }

    const controller = new AbortController();
    const loadTerms = async () => {
      const loadedTerms = [];
      let page = 1;

      while (true) {
        let response;
        try {
          response = await apiFetch({
            path: addQueryArgs(restPath, {
              per_page: TERMS_PER_PAGE,
              page,
              _fields: "id,name",
            }),
            parse: false,
            signal: controller.signal,
          });
        } catch (requestError) {
          if (
            page > 1 &&
            /invalid_page_number$/.test(requestError?.code || "")
          ) {
            break;
          }
          throw requestError;
        }

        const pageTerms = await response.json();
        if (!Array.isArray(pageTerms)) {
          throw new Error(__("Could not load the terms.", "define-blocks"));
        }

        loadedTerms.push(...pageTerms);
        const totalPages = Number.parseInt(
          response.headers.get("X-WP-TotalPages"),
          10,
        );
        if (
          (Number.isFinite(totalPages) && page >= totalPages) ||
          (!Number.isFinite(totalPages) && pageTerms.length < TERMS_PER_PAGE)
        ) {
          break;
        }
        page++;
      }

      if (!controller.signal.aborted) {
        setTerms(loadedTerms);
      }
    };

    loadTerms().catch((requestError) => {
      if (controller.signal.aborted) {
        return;
      }
      setTerms(null);
      createErrorNotice(
        requestError?.message ||
          __("Could not load the terms.", "define-blocks"),
        { type: "snackbar" },
      );
    });

    return () => controller.abort();
  }, [createErrorNotice, restPath]);

  const termOptions = useMemo(
    () => (terms || []).map(normalizeTermOption).filter(Boolean),
    [terms],
  );
  const options = useMemo(() => {
    const optionValues = new Set(termOptions.map((option) => option.value));
    return [
      ...termOptions,
      ...selectedOptions.filter((option) => !optionValues.has(option.value)),
    ];
  }, [selectedOptions, termOptions]);
  const canCreate = Boolean(
    field.allowCreate && restPath && Array.isArray(terms),
  );
  const createLabel = field.createLabel || __("Create", "define-blocks");
  const controlI18n = getSelectionI18n(field.placeholder);
  const sortableI18n = getSortableI18n();

  const handleChange = useCallback(
    async (nextValues, nextOptions, change) => {
      if (change?.type !== "create" || !canCreate) {
        onChange(toLegacySelections(nextValues, nextOptions, selectedOptions));
        return;
      }

      const pendingOption = change.option;
      try {
        const createdTerm = await apiFetch({
          path: restPath,
          method: "POST",
          data: { name: pendingOption.label },
        });
        setTerms((currentTerms) => [
          ...(Array.isArray(currentTerms) ? currentTerms : []),
          createdTerm,
        ]);
        const resolvedOptions = replacePendingTermOption(
          nextOptions,
          pendingOption.value,
          createdTerm,
        );
        onChange(
          toLegacySelections(
            resolvedOptions.map((option) => option.value),
            resolvedOptions,
            selectedOptions,
          ),
        );
      } catch (requestError) {
        if (
          requestError?.code === "term_exists" &&
          requestError?.data?.term_id
        ) {
          const existingTerm = {
            id: requestError.data.term_id,
            name: pendingOption.label,
          };
          const resolvedOptions = replacePendingTermOption(
            nextOptions,
            pendingOption.value,
            existingTerm,
          );
          onChange(
            toLegacySelections(
              resolvedOptions.map((option) => option.value),
              resolvedOptions,
              selectedOptions,
            ),
          );
          return;
        }

        createErrorNotice(
          requestError?.message ||
            __("Could not create the term.", "define-blocks"),
          { type: "snackbar" },
        );
      }
    },
    [canCreate, createErrorNotice, onChange, restPath, selectedOptions],
  );

  return (
    <CreatableSortableMultiSelect
      id={name}
      label={field.label}
      help={field.description}
      error={error}
      value={selectedValues}
      onChange={handleChange}
      onBlur={onBlur}
      options={options}
      allowCreate={canCreate}
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

TaxonomyField.handlesError = true;
