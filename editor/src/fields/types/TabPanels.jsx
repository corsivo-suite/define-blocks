import { TabPanel, BaseControl } from '@wordpress/components';
import FieldsRenderer from '../Renderer';

export default function TabPanels( { name: fieldName, field, renderFields } ) {
	const tabsRaw = field.tabs ? Object.entries( field.tabs ) : [];
	if ( ! tabsRaw.length ) {
		return null;
	}

	const tabs = tabsRaw.map( ( [ key, tab ] ) => ( {
		name: tab.name || key,
		title: tab.title,
		fields: tab.fields,
	} ) );

	const tabDefs = tabs.map( ( { name, title } ) => ( { name, title } ) );

	const content = (
		<TabPanel tabs={ tabDefs }>
			{ ( tab ) => {
				const activeTab = tabs.find( ( t ) => t.name === tab.name );
				if ( ! activeTab || ! activeTab.fields ) {
					return null;
				}
				return renderFields
					? renderFields( activeTab.fields )
					: <FieldsRenderer fields={ activeTab.fields } />;
			} }
		</TabPanel>
	);

	if ( field.label ) {
		return (
			<BaseControl id={ fieldName } label={ field.label }>
				{ content }
			</BaseControl>
		);
	}

	return content;
}
