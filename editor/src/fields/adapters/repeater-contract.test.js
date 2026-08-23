import {
	createRepeaterItem,
	duplicateRepeaterItem,
	normalizeRepeaterItems,
	repeaterFieldsNeedRootValues,
} from './repeater-contract';

describe( 'repeater adapter contracts', () => {
	it( 'preserves stable ids and replaces missing or duplicate ids', () => {
		let sequence = 0;
		const createId = () => `generated-${ ++sequence }`;
		const first = { _defb_id: 'stable', title: 'First' };
		const items = normalizeRepeaterItems( [
			first,
			{ _defb_id: 'stable', title: 'Duplicate' },
			{ title: 'Missing' },
		], createId );

		expect( items[ 0 ] ).toBe( first );
		expect( items.map( ( item ) => item._defb_id ) ).toEqual( [
			'stable',
			'generated-1',
			'generated-2',
		] );
	} );

	it( 'builds and duplicates items without losing their public fields', () => {
		const buildValue = ( field ) => field.default ?? '';
		expect( createRepeaterItem( {
			title: { default: 'Untitled' },
			description: {},
		}, () => 'new-id', buildValue ) ).toEqual( {
			_defb_id: 'new-id',
			title: 'Untitled',
			description: '',
		} );
		expect( duplicateRepeaterItem( {
			_defb_id: 'old-id',
			title: 'Original',
		}, () => 'copy-id' ) ).toEqual( {
			_defb_id: 'copy-id',
			title: 'Original',
		} );
	} );

	it( 'detects root conditions through nested groups and tabs', () => {
		expect( repeaterFieldsNeedRootValues( {
			group: {
				fields: {
					child: { condition: 'root.enabled' },
				},
			},
		} ) ).toBe( true );
		expect( repeaterFieldsNeedRootValues( {
			tabs: {
				tabs: {
					main: { fields: { child: { condition: '$index > 0' } } },
				},
			},
		} ) ).toBe( false );
	} );
} );
