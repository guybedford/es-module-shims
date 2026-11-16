// Wasm ESM integration compiles with the `wasm:js-string` builtins enabled and `wasm:js/string-constants` as the
// imported string constants namespace. Where the engine supports these natively they are resolved at compile time
// and shadow the import object, so the namespaces here are only reached on engines without that support. Kept as
// small as possible since this ships in the base bundle - see the reference polyfill at
// https://github.com/WebAssembly/js-string-builtins/blob/main/test/js-api/js-string/polyfill.js.
// This module is fully self-contained so that the unit test suite can import it directly from source.

export const jsStringBuiltins = 'wasm:js-string';
export const jsStringConstants = 'wasm:js/string-constants';

const hasWasm = typeof WebAssembly !== 'undefined';
const wasmModule = hasWasm && WebAssembly.Module;
const wasmCompileStreaming = hasWasm && WebAssembly.compileStreaming;
const wasmModuleImports = hasWasm && wasmModule.imports;
const wasmModuleExports = hasWasm && wasmModule.exports;

const s = Symbol();
const o = Symbol();
const brand = m => Object.defineProperty(m, s, { value: 'WebAssembly.Module' });

// Native builtins and string constants only apply to modules compiled with those compile options, so
// the options are recorded on the module at compilation to gate the polyfill at instantiation.
export const builtinOptions = opts => {
  let { builtins: b, importedStringConstants: c } = opts || {};
  if ((b = b && [...b].includes('js-string')) || c != null) return { b, c };
};
const compiled = (m, opts) => brand(opts ? Object.defineProperty(m, o, { value: opts }) : m);

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
const i16Bytes = () =>
  Uint8Array.from(
    atob(
      'AGFzbQEAAAABGARedwFgAWMAAX9gAmMAfwF/YANjAH9/AAMEAwECAwcNAwFsAAABZwABAXAAAgoeAwYAIAD7DwsJACAAIAH7DQALCwAgACABIAL7DgAL'
    ),
    c => c.charCodeAt(0)
  );
let i16Array;
const i16 = () => i16Array || (i16Array = new WebAssembly.Instance(new WebAssembly.Module(i16Bytes())).exports);

export const jsStringImports = {
  test: v => (typeof v === 'string' ? 1 : 0),
  cast: str,
  // the third parameter is an exclusive end index, not a count
  fromCharCodeArray: (array, start, end) => {
    const a = i16(),
      len = a.l(array);
    if ((end >>>= 0) > len || (start >>>= 0) > end) trap();
    let r = '';
    while (start < end) r += String.fromCharCode(a.g(array, start++));
    return r;
  },
  intoCharCodeArray: (string, array, start) => {
    const a = i16(),
      { length } = str(string);
    // bounds are checked in floating point as uint32 sums are always exactly representable
    if ((start >>>= 0) + length > a.l(array)) trap();
    for (let i = 0; i < length; i++) a.p(array, start + i, string.charCodeAt(i));
    return length;
  },
  fromCharCode: charCode => String.fromCharCode(charCode >>> 0),
  fromCodePoint: codePoint => ((codePoint >>>= 0) > 0x10ffff ? trap() : String.fromCodePoint(codePoint)),
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
const stringConstants = new Proxy({}, { get: (_, name) => name });
export const jsStringNamespaces = {
  [jsStringBuiltins]: jsStringImports,
  [jsStringConstants]: stringConstants
};

// The js-string builtins polyfill baseline is its own i16 array accessor module validating (WasmGC
// with typed function references, Chrome 119+, Firefox 120+). Detected lazily so that engines below
// the baseline simply do not install the builtin namespaces, with modules importing them failing with
// their natural missing import link errors rather than polyfill internal errors.
let jsStringSupport;
export const supportsJsStringBuiltins = () =>
  jsStringSupport === undefined ? (jsStringSupport = hasWasm && WebAssembly.validate(i16Bytes())) : jsStringSupport;

// Native engines compile-resolve the recognized builtins and string constants so that the import object is
// never consulted for them. Emulated here, for modules compiled with those options only, by lazily layering
// the builtin namespaces over an object inheriting from the user import object, leaving it untouched and
// preserving its [[Get]] semantics for all other namespaces. User-provided entries are only reachable for
// unrecognized builtin names, matching the native builtins fallback. The baseline check only runs if a
// builtin namespace is actually resolved from the import object.
export const withJsStringImports = (imports, opts) => {
  if (!opts || (imports != null && Object(imports) !== imports)) return imports;
  const layered = Object.create((imports = imports || {}));
  const layer = (name, ns) =>
    Object.defineProperty(layered, name, {
      configurable: true,
      get: () => (supportsJsStringBuiltins() ? ns(imports[name]) : imports[name])
    });
  if (opts.b) layer(jsStringBuiltins, value => ({ ...value, ...jsStringImports }));
  if (opts.c != null) layer(opts.c, () => stringConstants);
  return layered;
};

export const jsStringCompileOptions = { builtins: ['js-string'], importedStringConstants: jsStringConstants };

// Module source compilation for the module loader, used in both shim and polyfill modes independently of any
// global patching: applies the ESM integration compile options and the source phase brand, recording the
// options on the module for imports reflection and instantiation.
export const compileStreaming = source =>
  wasmCompileStreaming(source, jsStringCompileOptions).then(m => compiled(m, builtinOptions(jsStringCompileOptions)));

const builtinNs = m => m === jsStringBuiltins || m === jsStringConstants;

// Imports reflection for loader module sources with the builtin namespaces removed, matching native
// reflection where compiled-in builtins are not looked up on the instantiation imports object.
export const moduleImports = module => wasmModuleImports(module).filter(({ module: m }) => !builtinNs(m));

export const moduleExports = module => wasmModuleExports(module);

// Whether compiled builtin namespace imports remain on the module, in which case the polyfill namespaces
// must be provided to its instantiation. Never the case on engines with native builtins support, where the
// recognized imports are compile-resolved out of the reflection entirely.
export const hasBuiltinImports = module => wasmModuleImports(module).some(({ module: m }) => builtinNs(m));

// Instance registry backing WebAssembly.namespaceInstance and Wasm-to-Wasm global linking, keyed by
// both the module namespace and the module source (module sources key their instances at
// instantiation for deterministic lookup, with the namespace registered on namespace resolution).
export const wasmInstances = new WeakMap();

// WebAssembly.namespaceInstance retrieves the underlying instance for a Wasm module namespace.
// Additive-only, so it is provided in both shim and polyfill modes when not implemented natively.
export const applyNamespaceInstance = () => {
  if (!hasWasm || WebAssembly.namespaceInstance) return;
  WebAssembly.namespaceInstance = function namespaceInstance(ns) {
    const instance = ns != null && ns[Symbol.toStringTag] === 'Module' ? wasmInstances.get(ns) : undefined;
    if (!instance) throw new TypeError('Not a WebAssembly module namespace');
    return instance;
  };
};

// Global Wasm polyfills, applied in both shim and polyfill modes on engines without native source phase
// support: WebAssembly.Module is polyfilled to extend from AbstractModuleSource per the source phase
// proposal, and since source phase modules are instantiated by user code, the js-string builtins
// namespaces are provided to instantiation for engines that do not support the builtins natively.
export const applyWasmPolyfills = () => {
  if (!hasWasm) return;
  applyNamespaceInstance();
  if (Object.getPrototypeOf(wasmModule).name) return;
  class AbstractModuleSource {
    // the brand check getter returns undefined for all non module source receivers including null and
    // undefined, it does not throw
    get [Symbol.toStringTag]() {
      if (this != null) return this[s];
    }
  }
  const {
    compile: wasmCompile,
    instantiate: wasmInstantiate,
    instantiateStreaming: wasmInstantiateStreaming,
    Instance: wasmInstance
  } = WebAssembly;
  const Module = (WebAssembly.Module = Object.setPrototypeOf(
    Object.assign(function Module(...args) {
      if (!new.target) throw new TypeError(`Constructor WebAssembly.Module requires 'new'`);
      return compiled(Reflect.construct(wasmModule, args, new.target), builtinOptions(args[1]));
    }, wasmModule),
    AbstractModuleSource
  ));
  Module.prototype = Object.setPrototypeOf(wasmModule.prototype, AbstractModuleSource.prototype);
  Object.defineProperty(wasmModule.prototype, 'constructor', { value: Module });
  // modules compiled with the builtins or string constants compile options reflect without those
  // compiled-in imports, matching native reflection
  Module.imports = function imports(module, ...args) {
    const opts = module[o];
    return wasmModuleImports(module, ...args).filter(
      ({ module: m, name }) =>
        !opts || (m !== opts.c && !(opts.b && m === jsStringBuiltins && jsStringImports.hasOwnProperty(name)))
    );
  };
  WebAssembly.compile = function compile(...args) {
    return wasmCompile(...args).then(m => compiled(m, builtinOptions(args[1])));
  };
  WebAssembly.compileStreaming = function compileStreaming(...args) {
    return wasmCompileStreaming(...args).then(m => compiled(m, builtinOptions(args[1])));
  };
  const instantiated = opts => result => {
    if (result.module) compiled(result.module, opts);
    return result;
  };
  WebAssembly.instantiate = function instantiate(source, imports, ...args) {
    const opts = source instanceof wasmModule ? source[o] : builtinOptions(args[0]);
    return wasmInstantiate(source, withJsStringImports(imports, opts), ...args).then(instantiated(opts));
  };
  WebAssembly.instantiateStreaming = function instantiateStreaming(source, imports, ...args) {
    const opts = builtinOptions(args[0]);
    return wasmInstantiateStreaming(source, withJsStringImports(imports, opts), ...args).then(instantiated(opts));
  };
  const Instance = (WebAssembly.Instance = function Instance(module, imports) {
    if (!new.target) throw new TypeError(`Constructor WebAssembly.Instance requires 'new'`);
    return Reflect.construct(wasmInstance, [module, withJsStringImports(imports, module && module[o])], new.target);
  });
  Instance.prototype = wasmInstance.prototype;
  Object.defineProperty(wasmInstance.prototype, 'constructor', { value: Instance });
};
