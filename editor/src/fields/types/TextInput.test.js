import TextInput from './TextInput';
import { evaluateCondition } from '../../engine/conditions';

jest.mock( '@wordpress/components', () => ( { TextControl: () => null } ) );
jest.mock(
	'@wordpress/hooks',
	() => ( { applyFilters: ( name, value ) => value } ),
	{ virtual: true }
);

describe( 'numeric text inputs', () => {
	it( 'keeps a numeric condition true after re-entering the same number', () => {
		const values = { columns: 3 };
		const control = TextInput( {
			name: 'columns',
			type: 'text',
			field: { type: 'text', originalType: 'number' },
			value: 3,
			onChange: ( value ) => {
				values.columns = value;
			},
		} );
		expect( evaluateCondition( 'columns == 3', values ) ).toBe( true );
		control.props.onChange( '3' );
		expect( values.columns ).toBe( 3 );
		expect( evaluateCondition( 'columns == 3', values ) ).toBe( true );
		control.props.onChange( '' );
		expect( values.columns ).toBe( '' );
	} );
} );
