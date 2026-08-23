import { useSelect } from "@wordpress/data";
import { __ } from "@wordpress/i18n";
import { ColorControl } from "@corsivo-suite/wp-admin-ui/color-control";

export default function ColorField({
  name,
  field,
  value,
  onChange,
  error,
  inline = false,
}) {
  const themeColors = useSelect((select) => {
    return select("core/block-editor").getSettings()?.colors || [];
  }, []);
  const palette = field.options || themeColors;

  return (
    <ColorControl
      id={name}
      label={field.label}
      help={field.description}
      error={error}
      value={value || ""}
      onChange={onChange}
      palette={palette}
      allowCustom={!field.disableCustomColors}
      enableAlpha={Boolean(field.enableAlpha)}
      clearable={field.clearable !== false}
      compact={inline}
      colorLabel={__("Choose a color", "define-blocks")}
      customColorLabel={__("Choose a custom color", "define-blocks")}
      emptyColorLabel={__("No color", "define-blocks")}
      clearLabel={__("Clear color", "define-blocks")}
    />
  );
}

ColorField.handlesError = true;
