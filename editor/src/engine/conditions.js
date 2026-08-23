import { isEmptyValue } from './values.js';

function resolveValue( values, path ) {
	const parts = path.split( '.' );
	let current = values;
	for ( const part of parts ) {
		if (
			current === null ||
			current === undefined ||
			typeof current !== 'object'
		) {
			return undefined;
		}
		current = current[ part ];
	}
	return current;
}

const fnCache = new Map();

function tokenize( src ) {
	const out = [];
	let i = 0;
	const len = src.length;

	while ( i < len ) {
		const ch = src[ i ];

		if ( /\s/.test( ch ) ) {
			i++;
			continue;
		}

		if ( ch === '"' || ch === "'" ) {
			let s = '';
			const q = ch;
			i++;
			while ( i < len && src[ i ] !== q ) {
				s += src[ i ] === '\\' ? src[ ++i ] || '' : src[ i ];
				i++;
			}
			i++;
			out.push( { t: 'str', v: s } );
			continue;
		}

		if ( /\d/.test( ch ) ) {
			let n = '';
			while ( i < len && /[\d.]/.test( src[ i ] ) ) {
				n += src[ i++ ];
			}
			const num = Number( n );
			if ( ! Number.isFinite( num ) ) {
				throw new Error( 'parse' );
			}
			out.push( { t: 'num', v: num } );
			continue;
		}

		const tri = src.slice( i, i + 3 );
		const duo = src.slice( i, i + 2 );

		if ( tri === '===' || tri === '!==' ) {
			out.push( { t: 'op', v: tri } );
			i += 3;
			continue;
		}
		if ( [ '==', '!=', '>=', '<=', '&&', '||', '!!' ].includes( duo ) ) {
			out.push( { t: 'op', v: duo } );
			i += 2;
			continue;
		}
		if ( '><-!'.includes( ch ) ) {
			out.push( { t: 'op', v: ch } );
			i++;
			continue;
		}

		if ( '()[],.'.includes( ch ) ) {
			out.push( { t: ch } );
			i++;
			continue;
		}

		if ( /[a-zA-Z_$]/.test( ch ) ) {
			let w = '';
			while (
				i < len &&
				( /[\w$]/.test( src[ i ] ) ||
					( src[ i ] === '-' && /[\w$]/.test( src[ i + 1 ] || '' ) ) )
			) {
				w += src[ i++ ];
			}
			if ( w === 'true' || w === 'false' ) {
				out.push( { t: 'bool', v: w === 'true' } );
			} else if ( w === 'null' || w === 'undefined' ) {
				out.push( { t: 'nil' } );
			} else if ( w === 'empty' || w === 'in' || w === 'contains' ) {
				out.push( { t: 'op', v: w } );
			} else {
				out.push( { t: 'id', v: w } );
			}
			continue;
		}

		i++;
	}

	return out;
}

function parseAST( tokens ) {
	let pos = 0;
	const peek = () => tokens[ pos ] || null;
	const next = () => tokens[ pos++ ];
	const expect = ( t ) => {
		const tk = next();
		if ( ! tk || tk.t !== t ) {
			throw new Error( 'parse' );
		}
		return tk;
	};

	function expr() {
		return logOr();
	}

	function logOr() {
		let n = logAnd();
		while ( peek()?.t === 'op' && peek().v === '||' ) {
			next();
			n = { t: 'log', op: '||', l: n, r: logAnd() };
		}
		return n;
	}

	function logAnd() {
		let n = comparison();
		while ( peek()?.t === 'op' && peek().v === '&&' ) {
			next();
			n = { t: 'log', op: '&&', l: n, r: comparison() };
		}
		return n;
	}

	function comparison() {
		const n = postfix();
		const p = peek();

		if ( p?.t === 'op' && [ '===', '!==', '==', '!=', '>', '<', '>=', '<=' ].includes( p.v ) ) {
			const op = next().v;
			return { t: 'cmp', op, l: n, r: postfix() };
		}
		if ( p?.t === 'op' && p.v === 'empty' ) {
			next();
			return { t: 'empty', neg: false, arg: n };
		}
		if ( p?.t === 'op' && p.v === '!' && tokens[ pos + 1 ]?.t === 'op' && tokens[ pos + 1 ].v === 'empty' ) {
			next();
			next();
			return { t: 'empty', neg: true, arg: n };
		}
		if ( p?.t === 'op' && p.v === 'in' ) {
			next();
			return { t: 'in', l: n, r: postfix() };
		}
		if ( p?.t === 'op' && p.v === 'contains' ) {
			next();
			return { t: 'contains', l: n, r: postfix() };
		}
		return n;
	}

	function postfix() {
		let n = unary();
		while ( peek()?.t === '.' ) {
			next();
			const method = next();
			if ( ! method || method.t !== 'id' || method.v !== 'includes' ) {
				throw new Error( 'parse' );
			}
			expect( '(' );
			const arg = expr();
			expect( ')' );
			n = { t: 'call', obj: n, arg };
		}
		return n;
	}

	function unary() {
		const p = peek();
		if ( p?.t === 'op' && p.v === '!!' ) {
			next();
			return { t: 'un', op: '!!', arg: primary() };
		}
		if ( p?.t === 'op' && p.v === '!' ) {
			next();
			return { t: 'un', op: '!', arg: unary() };
		}
		if ( p?.t === 'op' && p.v === '-' ) {
			next();
			return { t: 'un', op: '-', arg: primary() };
		}
		return primary();
	}

	function primary() {
		const p = peek();
		if ( ! p ) {
			throw new Error( 'parse' );
		}

		if ( p.t === '(' ) {
			next();
			const n = expr();
			expect( ')' );
			return n;
		}

		if ( p.t === '[' ) {
			next();
			const items = [];
			while ( peek() && peek().t !== ']' ) {
				items.push( expr() );
				if ( peek()?.t === ',' ) {
					next();
				}
			}
			expect( ']' );
			return { t: 'arr', items };
		}

		if ( p.t === 'str' || p.t === 'num' || p.t === 'bool' ) {
			next();
			return { t: 'lit', v: p.v };
		}

		if ( p.t === 'nil' ) {
			next();
			return { t: 'lit', v: null };
		}

		if ( p.t === 'id' ) {
			next();
			let path = p.v;
			while (
				peek()?.t === '.' &&
				tokens[ pos + 1 ]?.t === 'id' &&
				tokens[ pos + 1 ].v !== 'includes'
			) {
				next();
				path += '.' + next().v;
			}
			return { t: 'ref', v: path };
		}

		throw new Error( 'parse' );
	}

	const ast = expr();
	if ( pos < tokens.length ) {
		throw new Error( 'parse' );
	}
	return ast;
}

function evaluateNode( node, values ) {
	switch ( node.t ) {
		case 'lit':
			return node.v;

		case 'ref':
			return resolveValue( values, node.v );

		case 'arr':
			return node.items.map( ( n ) => evaluateNode( n, values ) );

		case 'un':
			if ( node.op === '!!' ) {
				return !! evaluateNode( node.arg, values );
			}
			if ( node.op === '-' ) {
				return -evaluateNode( node.arg, values );
			}
			return ! evaluateNode( node.arg, values );

		case 'cmp': {
			const l = evaluateNode( node.l, values );
			const r = evaluateNode( node.r, values );
			switch ( node.op ) {
				case '===':
				case '==':
					return l === r;
				case '!==':
				case '!=':
					return l !== r;
				case '>':
					return l > r;
				case '<':
					return l < r;
				case '>=':
					return l >= r;
				case '<=':
					return l <= r;
			}
			return false;
		}

		case 'log':
			if ( node.op === '||' ) {
				return evaluateNode( node.l, values ) || evaluateNode( node.r, values );
			}
			return evaluateNode( node.l, values ) && evaluateNode( node.r, values );

		case 'empty': {
			const v = evaluateNode( node.arg, values );
			return node.neg ? ! isEmptyValue( v ) : isEmptyValue( v );
		}

		case 'in': {
			const list = evaluateNode( node.r, values );
			const item = evaluateNode( node.l, values );
			return Array.isArray( list ) && list.includes( item );
		}

		case 'contains': {
			const haystack = evaluateNode( node.l, values );
			const needle = evaluateNode( node.r, values );
			if ( Array.isArray( haystack ) ) {
				return haystack.includes( needle );
			}
			return typeof haystack === 'string' && haystack.includes( needle );
		}

		case 'call': {
			const obj = evaluateNode( node.obj, values );
			const arg = evaluateNode( node.arg, values );
			if ( Array.isArray( obj ) ) {
				return obj.includes( arg );
			}
			if ( typeof obj === 'string' ) {
				return obj.includes( arg );
			}
			return false;
		}

		default:
			return undefined;
	}
}

function compileShowExpression( source ) {
	const tokens = tokenize( source );
	const ast = parseAST( tokens );
	return ( values ) => evaluateNode( ast, values );
}

function compileFunction( source ) {
	if ( fnCache.has( source ) ) {
		return fnCache.get( source );
	}

	let fn = null;

	try {
		fn = compileShowExpression( source );
	} catch ( e ) {
		if ( process.env.NODE_ENV !== 'production' ) {
			// eslint-disable-next-line no-console
			console.warn( '[define-blocks] invalid field condition:', source, e );
		}
	}

	fnCache.set( source, fn );
	return fn;
}

export function evaluateCondition( condition, values ) {
	if ( ! condition ) {
		return true;
	}

	if ( typeof condition === 'string' ) {
		const fn = compileFunction( condition );
		if ( ! fn ) {
			return true;
		}
		try {
			return !! fn( values );
		} catch {
			return true;
		}
	}

	if ( typeof condition !== 'object' ) {
		return true;
	}

	const entries = Object.entries( condition ).filter( ( [ k ] ) => k !== 'relation' );

	if ( ! entries.length ) {
		return true;
	}

	const relation = ( condition.relation || 'AND' ).toUpperCase();

	const results = entries.map( ( [ field, expected ] ) => {
		const actual = resolveValue( values, field );

		if ( typeof expected === 'object' && expected !== null && ! Array.isArray( expected ) ) {
			return evaluateComparison( actual, expected );
		}

		if ( Array.isArray( expected ) ) {
			return expected.includes( actual );
		}

		return actual === expected;
	} );

	switch ( relation ) {
		case 'OR':
			return results.some( Boolean );
		case 'XOR':
			return results.filter( Boolean ).length === 1;
		case 'NAND':
			return ! results.every( Boolean );
		case 'NOR':
			return ! results.some( Boolean );
		default:
			return results.every( Boolean );
	}
}

function evaluateComparison( actual, rule ) {
	const { value, operator = '===' } = rule;

	switch ( operator ) {
		case '===':
		case '==':
			return actual === value;
		case '!==':
		case '!=':
			return actual !== value;
		case '>':
			return actual > value;
		case '<':
			return actual < value;
		case '>=':
			return actual >= value;
		case '<=':
			return actual <= value;
		case 'in':
			return Array.isArray( value ) && value.includes( actual );
		case 'contains':
			return typeof actual === 'string' && actual.includes( value );
		case 'empty':
			return isEmptyValue( actual );
		case '!empty':
			return ! isEmptyValue( actual );
		default:
			return actual === value;
	}
}
