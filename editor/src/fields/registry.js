import TextInput from './types/TextInput';
import Textarea from './types/Textarea';
import RichText from './types/RichText';
import Select from './types/Select';
import Checkbox from './types/Checkbox';
import Color from './adapters/ColorField';
import Range from './types/Range';
import Media from './adapters/MediaField';
import Hidden from './types/Hidden';
import Title from './types/Title';
import Value from './types/Value';
import Group from './types/Group';
import InnerBlocksField from './types/InnerBlocksField';
import Video from './adapters/VideoField';
import Url from './adapters/UrlField';
import Link from './adapters/LinkField';
import Time from './adapters/DateTimeField';
import TabPanels from './types/TabPanels';
import File from './adapters/FileField';
import Gallery from './adapters/GalleryField';
import Autocomplete from './adapters/AutocompleteField';
import MultiAutocomplete from './adapters/MultiAutocompleteField';
import Chips from './adapters/ChipsField';
import PostSelector from './adapters/PostSelectorField';
import Taxonomy from './adapters/TaxonomyField';
import Repeater from './adapters/RepeaterField';
import MapField from './adapters/MapField';
import Geocoder from './adapters/GeocoderField';
import ToolbarToggle from './types/ToolbarToggle';
import ToolbarSelect from './types/ToolbarSelect';
import ToolbarDropdown from './types/ToolbarDropdown';
import ToolbarInput from './types/ToolbarInput';
import ToolbarAutocomplete from './types/ToolbarAutocomplete';
import { resolveFieldComponent } from './registry-resolver';

const FIELD_COMPONENTS = {
	text: TextInput,
	'text-with-parser': TextInput,
	textarea: Textarea,
	richtext: RichText,
	select: Select,
	'multi-select': MultiAutocomplete,
	autocomplete: Autocomplete,
	'multi-autocomplete': MultiAutocomplete,
	checkbox: Checkbox,
	color: Color,
	range: Range,
	url: Url,
	link: Link,
	media: Media,
	file: File,
	gallery: Gallery,
	video: Video,
	hidden: Hidden,
	title: Title,
	value: Value,
	group: Group,
	innerblocks: InnerBlocksField,
	time: Time,
	date: Time,
	datetime: Time,
	chips: Chips,
	repeater: Repeater,
	tabpanels: TabPanels,
	'post-selector': PostSelector,
	taxonomy: Taxonomy,
	'google-map': MapField,
	'osm-map': MapField,
	'mapbox-map': MapField,
	'google-geocoder': Geocoder,
	'mapbox-geocoder': Geocoder,
	'osm-geocoder': Geocoder,
	'toolbar-toggle': ToolbarToggle,
	'toolbar-select': ToolbarSelect,
	'toolbar-dropdown': ToolbarDropdown,
	'toolbar-input': ToolbarInput,
	'toolbar-autocomplete': ToolbarAutocomplete,
};

export function getFieldComponent( type ) {
	return resolveFieldComponent(
		type,
		FIELD_COMPONENTS,
		window.DefineBlocks?.Extensions,
		TextInput
	);
}
