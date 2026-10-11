import { createRoot, memo } from '@wordpress/element';
import { BlockProvider } from './Provider';
import {
	useBlockContext,
	useFieldError,
	useFieldErrors,
	useFieldValue,
} from './hooks';
import Dispatcher from '../fields/Dispatcher';

const { act } = jest.requireActual( 'react' );

jest.mock( '@wordpress/hooks', () => ( { doAction: jest.fn() } ), {
	virtual: true,
} );
jest.mock( '../fields/registry', () => ( {
	getFieldComponent:
		() =>
		( { id, name, value } ) => (
			<input id={ id } name={ name } value={ value || '' } readOnly />
		),
} ) );

describe( 'BlockProvider', () => {
	let container;
	let root;

	beforeEach( () => {
		window.IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement( 'div' );
		document.body.appendChild( container );
		root = createRoot( container );
	} );

	afterEach( () => {
		act( () => root.unmount() );
		container.remove();
	} );

	it( 'renders only the edited field among one hundred independent subscriptions', () => {
		const counts = new Map();
		const changes = new Map();
		const fields = Object.fromEntries(
			Array.from( { length: 100 }, ( unused, index ) => [
				`field${ index }`,
				{ type: 'text' },
			] )
		);
		const values = Object.fromEntries(
			Object.keys( fields ).map( ( name ) => [ name, '' ] )
		);
		const Probe = memo( ( { name } ) => {
			const [ value, onChange ] = useFieldValue( name );
			const error = useFieldError( name );
			changes.set( name, onChange );
			counts.set( name, ( counts.get( name ) || 0 ) + 1 );
			return (
				<span>
					{ value }
					{ error }
				</span>
			);
		} );
		act( () =>
			root.render(
				<BlockProvider
					blockName="demo/fields"
					clientId="fields"
					attributes={ { values } }
					defaults={ {} }
					schema={ { content: { fields } } }
					setAttributes={ jest.fn() }
				>
					{ Object.keys( fields ).map( ( name ) => (
						<Probe key={ name } name={ name } />
					) ) }
				</BlockProvider>
			)
		);
		counts.clear();
		act( () => changes.get( 'field0' )( 'Changed' ) );
		expect( [ ...counts.keys() ] ).toEqual( [ 'field0' ] );
		expect( container.textContent ).toBe( 'Changed' );
	} );

	it( 'updates nested errors and values after editing and undo without rerendering an unrelated field', () => {
		const schema = {
			content: {
				fields: {
					items: {
						type: 'repeater',
						fields: { title: { type: 'text', required: true } },
					},
					other: { type: 'text' },
				},
			},
		};
		const initial = { items: [ { title: '' } ], other: 'Unchanged' };
		let changeItems;
		let otherRenders = 0;
		function Items() {
			const [ value, onChange ] = useFieldValue( 'items' );
			const errors = useFieldErrors( 'items' );
			changeItems = onChange;
			return (
				<span>
					{ value[ 0 ].title }
					{ errors[ 'items.0.title' ] }
				</span>
			);
		}
		const Other = memo( () => {
			useFieldValue( 'other' );
			useFieldError( 'other' );
			otherRenders++;
			return null;
		} );
		const defaults = {};
		const setAttributes = jest.fn();
		const children = (
			<>
				<Items />
				<Other />
			</>
		);
		const render = ( values ) =>
			root.render(
				<BlockProvider
					blockName="demo/repeater"
					clientId="repeater"
					attributes={ { values } }
					defaults={ defaults }
					schema={ schema }
					setAttributes={ setAttributes }
				>
					{ children }
				</BlockProvider>
			);
		act( () => render( initial ) );
		expect( container.textContent ).toBe( 'This field is required' );
		otherRenders = 0;
		act( () => changeItems( [ { title: 'Fixed' } ] ) );
		expect( container.textContent ).toBe( 'Fixed' );
		expect( otherRenders ).toBe( 0 );
		act( () => render( { ...initial, items: [ { title: '' } ] } ) );
		expect( container.textContent ).toBe( 'This field is required' );
	} );

	it( 'persists missing defaults in old rows and numeric input as numbers', () => {
		const setAttributes = jest.fn();
		let changeAmount;
		function Amount() {
			const [ value, onChange ] = useFieldValue( 'amount' );
			changeAmount = onChange;
			return <span>{ value }</span>;
		}
		act( () =>
			root.render(
				<BlockProvider
					blockName="demo/defaults"
					clientId="defaults"
					attributes={ { values: { amount: '3', items: [ {} ] } } }
					defaults={ {} }
					schema={ {
						content: {
							fields: {
								amount: {
									type: 'text',
									originalType: 'number',
								},
								items: {
									type: 'repeater',
									fields: {
										title: {
											type: 'text',
											default: 'Default title',
										},
									},
								},
							},
						},
					} }
					setAttributes={ setAttributes }
				>
					<Amount />
				</BlockProvider>
			)
		);
		expect( setAttributes ).toHaveBeenLastCalledWith( {
			values: { amount: 3, items: [ { title: 'Default title' } ] },
		} );
		act( () => changeAmount( '4' ) );
		expect( setAttributes.mock.lastCall[ 0 ].values.amount ).toBe( 4 );
	} );

	it( 'gives two block instances distinct DOM ids while preserving their field keys', () => {
		const field = { type: 'text' };
		act( () =>
			root.render(
				<>
					{ [ 'first', 'second' ].map( ( clientId ) => (
						<BlockProvider
							key={ clientId }
							blockName="demo/same"
							clientId={ clientId }
							attributes={ { values: { title: 'Value' } } }
							defaults={ {} }
							schema={ { content: { fields: { title: field } } } }
							setAttributes={ jest.fn() }
						>
							<Dispatcher name="title" field={ field } />
						</BlockProvider>
					) ) }
				</>
			)
		);
		const inputs = [ ...container.querySelectorAll( 'input' ) ];
		expect( inputs.map( ( input ) => input.name ) ).toEqual( [
			'title',
			'title',
		] );
		expect( inputs[ 0 ].id ).not.toBe( '' );
		expect( inputs[ 0 ].id ).not.toBe( inputs[ 1 ].id );
	} );

	it( 'exposes native context while keeping equal context objects stable across parent updates', () => {
		let renders = 0;
		const Probe = memo( () => {
			const { context } = useBlockContext();
			renders++;
			return <span>{ context[ 'demo/theme' ] }</span>;
		} );
		const schema = { content: { fields: {} } };
		const defaults = {};
		const attributes = { values: {} };
		const child = <Probe />;
		const render = ( context ) =>
			root.render(
				<BlockProvider
					blockName="demo/context"
					clientId="context"
					attributes={ attributes }
					defaults={ defaults }
					schema={ schema }
					context={ context }
					setAttributes={ () => {} }
				>
					{ child }
				</BlockProvider>
			);
		act( () => render( { postId: 12, 'demo/theme': 'dark' } ) );
		act( () => render( { 'demo/theme': 'dark', postId: 12 } ) );
		expect( renders ).toBe( 1 );
		act( () => render( { postId: 12, 'demo/theme': 'light' } ) );
		expect( renders ).toBe( 2 );
		expect( container.textContent ).toBe( 'light' );
	} );

	it( 'preserves an explicitly null repeater instead of persisting its default', () => {
		const setAttributes = jest.fn();
		function Probe() {
			const [ value ] = useFieldValue( 'items' );
			return <span>{ JSON.stringify( value ) }</span>;
		}
		act( () =>
			root.render(
				<BlockProvider
					blockName="demo/null"
					clientId="null"
					attributes={ { values: { items: null } } }
					defaults={ { items: [] } }
					schema={ {
						content: {
							fields: {
								items: {
									type: 'repeater',
									default: [],
									fields: {},
								},
							},
						},
					} }
					setAttributes={ setAttributes }
				>
					<Probe />
				</BlockProvider>
			)
		);
		expect( container.textContent ).toBe( 'null' );
		expect( setAttributes ).not.toHaveBeenCalled();
	} );
} );
