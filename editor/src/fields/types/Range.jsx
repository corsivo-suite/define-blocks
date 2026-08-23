import { RangeControl } from '@wordpress/components';

export default function Range( { field, value, onChange, onBlur } ) {
	return (
		<RangeControl
			__next40pxDefaultSize
			__nextHasNoMarginBottom
			label={ field.label }
			help={ field.description }
			value={ value ?? field.min ?? 0 }
			onChange={ ( val ) => { onChange( val ); if ( onBlur ) { onBlur(); } } }
			min={ field.min ?? 0 }
			max={ field.max ?? 100 }
			step={ field.step ?? 1 }
		/>
	);
}
