import { TabPanel, BaseControl } from '@wordpress/components';
import FieldsRenderer from '../Renderer';
import { resolveType } from '../aliases';

function getPersistentFields( fields ) {
	return Object.fromEntries( Object.entries( fields || {} ).flatMap( ( [ name, definition ] ) => {
		if ( resolveType( definition.type ) === 'innerblocks' ) {
			return [ [ name, definition ] ];
		}
		if ( definition.tabs ) {
			const tabs = Object.fromEntries( Object.entries( definition.tabs ).map( ( [ tabName, tab ] ) =>
				[ tabName, { ...tab, fields: getPersistentFields( tab.fields ) } ]
			) );
			return Object.values( tabs ).some( ( tab ) => Object.keys( tab.fields ).length )
				? [ [ name, { ...definition, tabs } ] ]
				: [];
		}
		const nestedFields = getPersistentFields( definition.fields );
		return Object.keys( nestedFields ).length
			? [ [ name, { ...definition, fields: nestedFields } ] ]
			: [];
	} ) );
}

export default function TabPanels( { id, field, renderFields } ) {
	const tabsRaw = field.tabs ? Object.entries( field.tabs ) : [];
	if ( ! tabsRaw.length ) {
		return null;
	}

	const tabs = tabsRaw.map( ( [ key, tab ] ) => ( {
		name: tab.name || key,
		title: tab.title,
		fields: tab.fields,
		persistentFields: getPersistentFields( tab.fields ),
	} ) );

	const tabDefs = tabs.map( ( { name, title } ) => ( { name, title } ) );

	const content = (
		<TabPanel tabs={ tabDefs }>
			{ ( activeTab ) => tabs.map( ( tab ) => {
				const active = tab.name === activeTab.name;
				const fields = active ? tab.fields : tab.persistentFields;
				if ( ! fields || ! Object.keys( fields ).length ) {
					return null;
				}
				return (
					<div key={ tab.name } hidden={ ! active }>
						{ renderFields ? renderFields( fields ) : <FieldsRenderer fields={ fields } /> }
					</div>
				);
			} ) }
		</TabPanel>
	);

	if ( field.label ) {
		return (
			<BaseControl id={ id } label={ field.label }>
				{ content }
			</BaseControl>
		);
	}

	return content;
}
