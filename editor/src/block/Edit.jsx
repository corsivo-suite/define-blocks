import { useEffect, useRef } from '@wordpress/element';
import {
	useBlockProps,
	InspectorControls,
	BlockControls,
} from '@wordpress/block-editor';
import {
	PanelBody,
	ToolbarGroup,
	ToolbarButton,
	Dropdown,
	Icon,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { doAction } from '@wordpress/hooks';
import { BlockProvider } from '../store/Provider';
import { useValidationState } from '../store/hooks';
import FieldsRenderer from '../fields/Renderer';
import Dispatcher from '../fields/Dispatcher';
import BlockPreview from './BlockPreview';
import { schemaHasFieldType } from '../engine/schema';

function ValidationIndicator() {
	const hasErrors = useValidationState();
	const ref = useRef();
	useEffect( () => {
		const block = ref.current?.closest( '.defb-block' );
		if ( block ) {
			block.classList.toggle( 'defb-block--has-errors', hasErrors );
		}
	}, [ hasErrors ] );
	return <span ref={ ref } style={ { display: 'none' } } />;
}

export default function Edit( {
	attributes,
	setAttributes,
	clientId,
	blockData,
	schema,
	context,
} ) {
	const blockProps = useBlockProps( {
		className: `defb-block ${ blockData.wrapperClass || '' }`.trim(),
		draggable: false,
	} );

	const blockName = blockData.name;

	useEffect( () => {
		if ( ! window.DefineBlocks.Instances[ blockName ] ) {
			window.DefineBlocks.Instances[ blockName ] = {};
		}
		window.DefineBlocks.Instances[ blockName ][ clientId ] = { clientId };
		doAction( `defb.ready.${ blockName }`, clientId );

		return () => {
			delete window.DefineBlocks.Instances[ blockName ]?.[ clientId ];
		};
	}, [ blockName, clientId ] );

	const contentFields = schema.content?.fields || {};
	const inspectorPanels = schema.inspector || [];
	const advancedFields = schema[ 'inspector-advanced' ]?.fields || {};
	const toolbarGroups = schema.toolbar || [];

	const hasToolbar = toolbarGroups.length > 0;
	const settings = blockData.settings || {};
	const hasPreview = !! settings.frontendPreview;
	const canCollapse = !! settings.canCollapse;
	const isPreview = !! attributes.isPreview;
	const isCollapsed = !! attributes.collapsed;
	const hasInnerBlocks = schemaHasFieldType( schema, 'innerblocks' );

	const togglePreview = () => setAttributes( { isPreview: ! isPreview } );
	const toggleCollapse = () => setAttributes( { collapsed: ! isCollapsed } );

	return (
		<div { ...blockProps }>
			<BlockProvider
				blockName={ blockName }
				clientId={ clientId }
				attributes={ attributes }
				setAttributes={ setAttributes }
				schema={ schema }
				defaults={ blockData._defaults }
				context={ context }
			>
				<ValidationIndicator />
				<BlockControls>
					{ hasPreview && (
						<ToolbarGroup>
							<ToolbarButton
								icon={ isPreview ? 'edit' : 'visibility' }
								label={
									isPreview
										? __( 'Editor', 'define-blocks' )
										: __( 'Preview', 'define-blocks' )
								}
								onClick={ togglePreview }
								isPressed={ isPreview }
							/>
						</ToolbarGroup>
					) }
					{ canCollapse && ! isPreview && (
						<ToolbarGroup>
							<ToolbarButton
								icon={
									isCollapsed
										? 'arrow-down-alt2'
										: 'arrow-up-alt2'
								}
								label={
									isCollapsed
										? __( 'Expand', 'define-blocks' )
										: __( 'Collapse', 'define-blocks' )
								}
								onClick={ toggleCollapse }
							/>
						</ToolbarGroup>
					) }
					{ hasToolbar &&
						! isPreview &&
						toolbarGroups.map( ( group, gi ) =>
							group.type === 'dropdown' ? (
								<ToolbarGroup key={ gi }>
									<Dropdown
										popoverProps={ {
											className: 'defb-toolbar-dropdown',
										} }
										renderToggle={ ( {
											isOpen,
											onToggle,
										} ) => (
											<ToolbarButton
												icon={
													group.icon || 'ellipsis'
												}
												label={ group.label }
												onClick={ onToggle }
												aria-expanded={ isOpen }
											/>
										) }
										renderContent={ () => (
											<div className="defb-toolbar-dropdown__content">
												{ Object.entries(
													group.fields || {}
												).map(
													( [
														fieldName,
														fieldDef,
													] ) => (
														<Dispatcher
															key={ fieldName }
															name={ fieldName }
															field={ fieldDef }
															scope="toolbar-dropdown"
														/>
													)
												) }
											</div>
										) }
									/>
								</ToolbarGroup>
							) : (
								<ToolbarGroup key={ gi }>
									{ Object.entries( group.fields || {} ).map(
										( [ fieldName, fieldDef ] ) => (
											<Dispatcher
												key={ fieldName }
												name={ fieldName }
												field={ fieldDef }
												scope="toolbar"
											/>
										)
									) }
								</ToolbarGroup>
							)
						) }
				</BlockControls>

				{ isPreview && (
					<BlockPreview
						blockName={ blockName }
						attributes={ attributes }
						context={ context }
						onRestore={ togglePreview }
					/>
				) }
				{ ( ! isPreview || hasInnerBlocks ) && (
					<div hidden={ isPreview }>
						{ ! settings.hideTitle && (
							<div
								className="defb-block__header"
								onClick={
									canCollapse ? toggleCollapse : undefined
								}
								role={ canCollapse ? 'button' : undefined }
								tabIndex={ canCollapse ? 0 : undefined }
								onKeyDown={
									canCollapse
										? ( e ) => {
												if (
													e.key === 'Enter' ||
													e.key === ' '
												) {
													e.preventDefault();
													toggleCollapse();
												}
										  }
										: undefined
								}
							>
								{ blockData.icon && (
									<Icon icon={ blockData.icon } size={ 18 } />
								) }
								<span>{ blockData.title }</span>
								{ canCollapse && (
									<Icon
										icon={
											isCollapsed
												? 'arrow-down-alt2'
												: 'arrow-up-alt2'
										}
										size={ 16 }
									/>
								) }
							</div>
						) }

						{ ( ! isCollapsed || hasInnerBlocks ) &&
							Object.keys( contentFields ).length > 0 && (
								<div
									className="defb-block__content"
									hidden={ isCollapsed }
								>
									<FieldsRenderer fields={ contentFields } />
								</div>
							) }
					</div>
				) }

				{ ( inspectorPanels.length > 0 ||
					Object.keys( advancedFields ).length > 0 ) && (
					<InspectorControls>
						{ inspectorPanels.map( ( panel, i ) => (
							<PanelBody
								key={ i }
								title={ panel.panel }
								icon={ panel.icon || undefined }
								initialOpen={ panel.initialOpen !== false }
							>
								<FieldsRenderer fields={ panel.fields } />
							</PanelBody>
						) ) }

						{ Object.keys( advancedFields ).length > 0 && (
							<InspectorControls group="advanced">
								<FieldsRenderer fields={ advancedFields } />
							</InspectorControls>
						) }
					</InspectorControls>
				) }
			</BlockProvider>
		</div>
	);
}
