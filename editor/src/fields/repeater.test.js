import { partitionRepeaterFields } from './repeater';

describe( 'partitionRepeaterFields', () => {
	it( 'moves only direct fields explicitly marked inline into the header', () => {
		const fields = {
			color: { type: 'color', inline: true },
			title: { type: 'text', inline: true },
			description: { type: 'textarea' },
			group: {
				type: 'group',
				fields: {
					nested: { type: 'text', inline: true },
				},
			},
		};

		const { inlineFields, bodyFields } = partitionRepeaterFields( fields );

		expect( Object.keys( inlineFields ) ).toEqual( [ 'color', 'title' ] );
		expect( Object.keys( bodyFields ) ).toEqual( [ 'description', 'group' ] );
		expect( bodyFields.group.fields.nested.inline ).toBe( true );
	} );

	it( 'keeps truthy non-boolean values in the repeater body', () => {
		const fields = {
			booleanFlag: { type: 'text', inline: true },
			stringFlag: { type: 'text', inline: 'true' },
		};

		const { inlineFields, bodyFields } = partitionRepeaterFields( fields );

		expect( Object.keys( inlineFields ) ).toEqual( [ 'booleanFlag' ] );
		expect( Object.keys( bodyFields ) ).toEqual( [ 'stringFlag' ] );
	} );
} );
