import { createRoot } from '@wordpress/element';
import RepeaterField from './RepeaterField';

const { act } = jest.requireActual( 'react' );
const mockRootValues = {};
const mockErrors = {};
const mockRepeater = jest.fn();
const mockField = jest.fn( ( { id, name, value } ) => (
	<input id={ id } name={ name } value={ value } readOnly />
) );

jest.mock( '@corsivo-suite/wp-admin-ui/repeater', () => ( {
	Repeater: ( props ) => {
		mockRepeater( props );
		const { items, renderItem } = props;
		return (
		<div>
			{ items.map( ( item, index ) => (
				<div key={ item._defb_id }>
					{ renderItem( { item, index, onChange: () => {} } ) }
				</div>
			) ) }
		</div>
		);
	},
} ) );
jest.mock( '../../store/hooks', () => ( {
	useBlockContext: () => ( {
		getData: () => mockRootValues,
		subscribeAny: () => () => {},
		validateFields: () => {},
	} ),
	useFieldErrors: () => mockErrors,
} ) );
jest.mock( '../registry', () => {
	const Field = ( props ) => mockField( props );
	return { getFieldComponent: () => Field };
} );

describe( 'repeater field identity', () => {
	beforeEach( () => {
		mockField.mockClear();
		mockRepeater.mockClear();
	} );

	it( 'renders an explicit null as empty without rewriting it or malformed content', () => {
		window.IS_REACT_ACT_ENVIRONMENT = true;
		const container = document.createElement( 'div' );
		const root = createRoot( container );
		const onChange = jest.fn();
		const field = { type: 'repeater', fields: {} };
		act( () =>
			root.render(
				<RepeaterField
					name="items"
					field={ field }
					value={ null }
					onChange={ onChange }
				/>
			)
		);
		expect( container.innerHTML ).toBe( '<div></div>' );
		act( () =>
			root.render(
				<RepeaterField
					name="items"
					field={ field }
					value={ [ 'invalid row' ] }
					onChange={ onChange }
				/>
			)
		);
		expect( container.innerHTML ).toBe( '' );
		expect( onChange ).not.toHaveBeenCalled();
		act( () => root.unmount() );
	} );

	it( 'keeps each input DOM id attached to its row when order changes', () => {
		window.IS_REACT_ACT_ENVIRONMENT = true;
		const container = document.createElement( 'div' );
		const root = createRoot( container );
		const field = { type: 'repeater', fields: { title: { type: 'text' } } };
		const first = { _defb_id: 'first', title: 'First' };
		const second = { _defb_id: 'second', title: 'Second' };
		const onChange = jest.fn();
		const render = ( value ) =>
			root.render(
				<RepeaterField
					id="block-items"
					name="items"
					field={ field }
					value={ value }
					onChange={ onChange }
				/>
			);
		act( () => render( [ first, second ] ) );
		const before = [ ...container.querySelectorAll( 'input' ) ].map(
			( input ) => input.id
		);
		act( () => render( [ second, first ] ) );
		const inputs = [ ...container.querySelectorAll( 'input' ) ];
		expect( inputs.map( ( input ) => input.id ) ).toEqual( [
			before[ 1 ],
			before[ 0 ],
		] );
		expect( inputs.map( ( input ) => input.name ) ).toEqual( [
			'items.0.title',
			'items.1.title',
		] );
		expect( onChange ).not.toHaveBeenCalled();
		act( () => root.unmount() );
	} );

	it( 'applies pending field changes to the current row after other edits and reordering', () => {
		window.IS_REACT_ACT_ENVIRONMENT = true;
		const root = createRoot( document.createElement( 'div' ) );
		const field = { type: 'repeater', fields: { title: { type: 'text' }, location: { type: 'text' } } };
		const first = { _defb_id: 'first', title: 'First', location: 'Initial' };
		const second = { _defb_id: 'second', title: 'Second', location: 'Other' };
		const originalOnChange = jest.fn();
		const currentOnChange = jest.fn();
		const render = ( value, onChange ) => root.render(
			<RepeaterField name="items" field={ field } value={ value } onChange={ onChange } />
		);
		act( () => render( [ first, second ], originalOnChange ) );
		const pendingChange = mockField.mock.calls.find( ( [ props ] ) => props.name === 'items.0.location' )[ 0 ].onChange;
		act( () => render( [ { ...second, title: 'Changed second' }, { ...first, title: 'Changed first' } ], currentOnChange ) );
		act( () => pendingChange( 'Resolved address' ) );
		expect( currentOnChange ).toHaveBeenLastCalledWith( [
			{ ...second, title: 'Changed second' },
			{ ...first, title: 'Changed first', location: 'Resolved address' },
		] );
		expect( originalOnChange ).not.toHaveBeenCalled();
		act( () => root.unmount() );
	} );

	it( 'merges consecutive field edits before a render and ignores pending changes to removed rows', () => {
		window.IS_REACT_ACT_ENVIRONMENT = true;
		const root = createRoot( document.createElement( 'div' ) );
		const item = { _defb_id: 'first', title: 'First', location: 'Initial' };
		const field = { type: 'repeater', fields: { title: { type: 'text' }, location: { type: 'text' } } };
		const onChange = jest.fn();
		act( () => root.render( <RepeaterField name="items" field={ field } value={ [ item ] } onChange={ onChange } /> ) );
		const titleChange = mockField.mock.calls.find( ( [ props ] ) => props.name === 'items.0.title' )[ 0 ].onChange;
		const pendingChange = mockField.mock.calls.find( ( [ props ] ) => props.name === 'items.0.location' )[ 0 ].onChange;
		act( () => {
			titleChange( 'Changed' );
			pendingChange( 'Resolved' );
		} );
		expect( onChange ).toHaveBeenLastCalledWith( [ { ...item, title: 'Changed', location: 'Resolved' } ] );
		onChange.mockClear();
		act( () => {
			mockRepeater.mock.lastCall[ 0 ].onChange( [] );
			pendingChange( 'Outdated' );
		} );
		expect( onChange ).toHaveBeenCalledTimes( 1 );
		expect( onChange ).toHaveBeenLastCalledWith( [] );
		act( () => root.unmount() );
	} );
} );
