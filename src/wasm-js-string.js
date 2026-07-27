// Wasm ESM integration compiles with the `wasm:js-string` builtins enabled and `wasm:js/string-constants` as the
// imported string constants namespace. Where the engine supports these natively they are resolved at compile time
// and shadow the import object, so the namespaces here are only reached on engines without that support. Kept as
// small as possible since this ships in the base bundle - see the reference polyfill at
// https://github.com/WebAssembly/js-string-builtins/blob/main/test/js-api/js-string/polyfill.js.

export const jsStringBuiltins = 'wasm:js-string';
export const jsStringConstants = 'wasm:js/string-constants';

const trap = () => {
  throw new WebAssembly.RuntimeError();
};

const str = v => {
  if (typeof v !== 'string') trap();
  return v;
};

// (array (mut i16)) accessors can only be implemented in Wasm itself, so are lazily compiled on first use:
//   (type $a (array (mut i16)))
//   (func (export "l") (param (ref null $a)) (result i32) local.get 0 array.len)
//   (func (export "g") (param (ref null $a) i32) (result i32) local.get 0 local.get 1 array.get_u $a)
//   (func (export "p") (param (ref null $a) i32 i32) local.get 0 local.get 1 local.get 2 array.set $a)
let i16Array;
const i16 = () =>
  i16Array ||
  (i16Array = new WebAssembly.Instance(
    new WebAssembly.Module(
      Uint8Array.from(
        atob(
          'AGFzbQEAAAABGARedwFgAWMAAX9gAmMAfwF/YANjAH9/AAMEAwECAwcNAwFsAAABZwABAXAAAgoeAwYAIAD7DwsJACAAIAH7DQALCwAgACABIAL7DgAL'
        ),
        c => c.charCodeAt(0)
      )
    )
  ).exports);

// Bounds are checked in floating point as uint32 sums are always exactly representable.
const bounds = (start, count, len) => {
  if (start + count > len) trap();
};

export const jsStringImports = {
  test: v => (typeof v === 'string' ? 1 : 0),
  cast: str,
  fromCharCodeArray: (array, start, count) => {
    const a = i16();
    bounds((start >>>= 0), (count >>>= 0), a.l(array));
    let s = '';
    while (count--) s += String.fromCharCode(a.g(array, start++));
    return s;
  },
  intoCharCodeArray: (string, array, start) => {
    const a = i16(),
      { length } = str(string);
    bounds((start >>>= 0), length, a.l(array));
    for (let i = 0; i < length; i++) a.p(array, start + i, string.charCodeAt(i));
    return length;
  },
  fromCharCode: charCode => String.fromCharCode(charCode >>> 0),
  fromCodePoint: codePoint => String.fromCodePoint(codePoint >>> 0),
  charCodeAt: (string, i) => ((i >>>= 0) < str(string).length ? string.charCodeAt(i) : trap()),
  codePointAt: (string, i) => ((i >>>= 0) < str(string).length ? string.codePointAt(i) : trap()),
  length: string => str(string).length,
  concat: (a, b) => str(a) + str(b),
  // String.prototype.substring() clamps out of range indices, so only the reversed range needs handling
  substring: (string, start, end) => {
    str(string);
    return (end >>>= 0) < (start >>>= 0) ? '' : string.substring(start, end);
  },
  equals: (a, b) => {
    if (a !== null) str(a);
    if (b !== null) str(b);
    return a === b ? 1 : 0;
  },
  compare: (a, b) =>
    str(a) < str(b) ? -1
    : a === b ? 0
    : 1
};

// Every imported string constant evaluates to its own import name, so the namespace is unbounded and can
// only be provided as a proxy.
export const jsStringNamespaces = {
  [jsStringBuiltins]: jsStringImports,
  [jsStringConstants]: new Proxy({}, { get: (_, name) => name })
};

// The builtin namespaces are merged under any user-provided imports so that unknown `wasm:js-string` names
// still resolve against the import object, matching the native builtins fallback.
export const withJsStringImports = imports => ({
  ...jsStringNamespaces,
  ...imports,
  [jsStringBuiltins]: { ...jsStringImports, ...(imports && imports[jsStringBuiltins]) }
});

export const jsStringCompileOptions = { builtins: ['js-string'], importedStringConstants: jsStringConstants };
