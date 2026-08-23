import { resolveFieldComponent } from './registry-resolver';

describe( 'field component registry', () => {
	it( 'keeps built-ins authoritative and resolves external extensions', () => {
		const builtIn = () => null;
		const extension = () => null;
		const fallback = () => null;
		const components = { text: builtIn };
		const extensions = { text: extension, custom: extension };

		expect( resolveFieldComponent( 'text', components, extensions, fallback ) ).toBe( builtIn );
		expect( resolveFieldComponent( 'custom', components, extensions, fallback ) ).toBe( extension );
		expect( resolveFieldComponent( 'missing', components, extensions, fallback ) ).toBe( fallback );
	} );
} );
