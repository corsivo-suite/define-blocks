import { __ } from "@wordpress/i18n";
import { GalleryControl } from "@corsivo-suite/wp-admin-ui/gallery-control";
import { getSortableI18n } from "./control-i18n";
import { renderWordPressMediaPicker } from "./media-picker";
import { normalizeGalleryImage } from "./value-contracts";

export default function GalleryField({ id, field, value, onChange, onBlur }) {
  const images = (Array.isArray(value) ? value : [])
    .map(normalizeGalleryImage)
    .filter((image) => image.id !== undefined && image.id !== null);
  const sortableI18n = getSortableI18n();

  return (
    <GalleryControl
      id={id}
      label={field.label}
      help={field.description}
      value={images}
      onChange={(nextImages) => onChange(nextImages.map(normalizeGalleryImage))}
      onBlur={onBlur}
      renderMediaPicker={renderWordPressMediaPicker}
      allowedTypes={["image"]}
      selectLabel={field.buttonLabel || __("Add Images", "define-blocks")}
      editLabel={field.buttonLabel || __("Edit Gallery", "define-blocks")}
      removeLabel={__("Remove image", "define-blocks")}
      emptyState={__("No images selected.", "define-blocks")}
      itemsLabel={field.label || __("Gallery images", "define-blocks")}
      {...sortableI18n}
    />
  );
}
