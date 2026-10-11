import { Component } from '@wordpress/element';
import { doAction } from '@wordpress/hooks';
import { __ } from '@wordpress/i18n';

export default class FieldErrorBoundary extends Component {
	constructor( props ) {
		super( props );
		this.state = { failed: false };
	}

	static getDerivedStateFromError() {
		return { failed: true };
	}

	componentDidCatch( error, errorInfo ) {
		const details = {
			fieldName: this.props.fieldName,
			fieldType: this.props.fieldType,
			componentStack: errorInfo.componentStack,
		};

		doAction( 'defb.fieldRenderError', error, details );
		if ( window.defineBlocks?.debug ) {
			window.console.error( '[Define Blocks] Field render failed.', error, details );
		}
	}

	render() {
		if ( this.state.failed ) {
			return (
			<div className="defb-field__render-error" role="alert">
				{ __( 'This field could not be loaded.', 'define-blocks' ) }
			</div>
			);
		}

		return this.props.children;
	}
}
