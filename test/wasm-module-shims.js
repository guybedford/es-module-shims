import {
  jsStringBuiltins,
  jsStringConstants,
  jsStringImports,
  jsStringNamespaces,
  jsStringCompileOptions,
  withJsStringImports,
  compileStreaming,
  moduleImports,
  moduleExports,
  hasBuiltinImports,
  supportsJsStringBuiltins,
  applyWasmPolyfills,
  applyNamespaceInstance,
  wasmInstances
} from '../src/wasm-module-shims.js';
import * as shimsNs from '../src/wasm-module-shims.js';

// Minimal Wasm assembler for the inline fixture modules
const enc = new TextEncoder();
const string = s => [s.length, ...enc.encode(s)];
const section = (id, entries) => {
  const body = [entries.length, ...entries.flat()];
  return [id, body.length, ...body];
};
const func = body => [body.length + 1, 0x00, ...body];
const wasmModule = (...sections) => new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, ...sections.flat()]);

// (module
//   (type $a (array (mut i16)))
//   (func (export "n") (param i32) (result (ref null $a)) local.get 0 array.new_default $a)
//   (func (export "l") (param (ref null $a)) (result i32) local.get 0 array.len)
//   (func (export "g") (param (ref null $a) i32) (result i32) local.get 0 local.get 1 array.get_u $a)
//   (func (export "p") (param (ref null $a) i32 i32) local.get 0 local.get 1 local.get 2 array.set $a))
const i16HelperBytes = wasmModule(
  section(1, [
    [0x5e, 0x77, 0x01],
    [0x60, 0x01, 0x7f, 0x01, 0x63, 0x00],
    [0x60, 0x01, 0x63, 0x00, 0x01, 0x7f],
    [0x60, 0x02, 0x63, 0x00, 0x7f, 0x01, 0x7f],
    [0x60, 0x03, 0x63, 0x00, 0x7f, 0x7f, 0x00]
  ]),
  section(3, [[0x01], [0x02], [0x03], [0x04]]),
  section(7, [
    [...string('n'), 0x00, 0x00],
    [...string('l'), 0x00, 0x01],
    [...string('g'), 0x00, 0x02],
    [...string('p'), 0x00, 0x03]
  ]),
  section(10, [
    func([0x20, 0x00, 0xfb, 0x07, 0x00, 0x0b]),
    func([0x20, 0x00, 0xfb, 0x0f, 0x0b]),
    func([0x20, 0x00, 0x20, 0x01, 0xfb, 0x0d, 0x00, 0x0b]),
    func([0x20, 0x00, 0x20, 0x01, 0x20, 0x02, 0xfb, 0x0e, 0x00, 0x0b])
  ])
);

// (module (import ns name (global (ref extern))) (export "constant" (global 0)))
const constantModuleBytes = (ns, name) =>
  wasmModule(
    section(2, [[...string(ns), ...string(name), 0x03, 0x64, 0x6f, 0x00]]),
    section(7, [[...string('constant'), 0x03, 0x00]])
  );

const emptyModuleBytes = wasmModule();

const wasmResponse = bytes => new Response(bytes, { headers: { 'content-type': 'application/wasm' } });

// Feature detections against the native (pre-polyfill) globals
const supportsGC = WebAssembly.validate(i16HelperBytes);
const nativeSourcePhase = !!Object.getPrototypeOf(WebAssembly.Module).name;
let supportsStringConstants = false;
try {
  supportsStringConstants =
    WebAssembly.Module.imports(new WebAssembly.Module(constantModuleBytes('m', 'x'), { importedStringConstants: 'm' }))
      .length === 0;
} catch (e) {}

const nativeNamespaceInstance = !!WebAssembly.namespaceInstance;
// old engines ignore new.target in native constructors, in which case the polyfilled constructors
// pass it through to the same effect and subclassing is not supported either way
const nativeSubclassing = (() => {
  function T() {}
  return Reflect.construct(WebAssembly.Module, [emptyModuleBytes], T) instanceof T;
})();

if (!nativeSourcePhase) applyWasmPolyfills();
applyNamespaceInstance();

const assertTrap = fn => {
  try {
    fn();
  } catch (e) {
    if (e instanceof WebAssembly.RuntimeError) return;
    throw new Error(`Expected a WebAssembly.RuntimeError trap, got ${e}`);
  }
  throw new Error('Expected a WebAssembly.RuntimeError trap');
};

const assertThrows = (Err, fn) => {
  try {
    fn();
  } catch (e) {
    if (e instanceof Err) return;
    throw new Error(`Expected a ${Err.name}, got ${e}`);
  }
  throw new Error(`Expected a ${Err.name}`);
};

let i16Exports;
const i16 = () => i16Exports || (i16Exports = new WebAssembly.Instance(new WebAssembly.Module(i16HelperBytes)).exports);
const charArray = str => {
  const { n, p } = i16();
  const arr = n(str.length);
  for (let i = 0; i < str.length; i++) p(arr, i, str.charCodeAt(i));
  return arr;
};

suite('js-string builtins', () => {
  test('test and cast', () => {
    assert.equal(jsStringImports.test('a'), 1);
    assert.equal(jsStringImports.test(5), 0);
    assert.equal(jsStringImports.test(null), 0);
    assert.equal(jsStringImports.cast('a'), 'a');
    assertTrap(() => jsStringImports.cast(5));
    assertTrap(() => jsStringImports.cast(null));
  });

  test('fromCharCode and fromCodePoint', () => {
    assert.equal(jsStringImports.fromCharCode(65), 'A');
    assert.equal(jsStringImports.fromCharCode(0x10041), 'A');
    assert.equal(jsStringImports.fromCodePoint(65), 'A');
    assert.equal(jsStringImports.fromCodePoint(0x10ffff), String.fromCodePoint(0x10ffff));
    // out of range code points must present as a trap, not a RangeError
    assertTrap(() => jsStringImports.fromCodePoint(0x110000));
    assertTrap(() => jsStringImports.fromCodePoint(-1));
  });

  test('charCodeAt and codePointAt bounds', () => {
    assert.equal(jsStringImports.charCodeAt('AB', 1), 66);
    assertTrap(() => jsStringImports.charCodeAt('AB', 2));
    assertTrap(() => jsStringImports.charCodeAt(null, 0));
    assert.equal(jsStringImports.codePointAt('\u{1F600}', 0), 0x1f600);
    assertTrap(() => jsStringImports.codePointAt('A', 1));
  });

  test('length, concat, substring, equals, compare', () => {
    assert.equal(jsStringImports.length('abc'), 3);
    assertTrap(() => jsStringImports.length(null));
    assert.equal(jsStringImports.concat('a', 'b'), 'ab');
    assertTrap(() => jsStringImports.concat('a', null));
    assert.equal(jsStringImports.substring('abcdef', 1, 3), 'bc');
    assert.equal(jsStringImports.substring('abcdef', 3, 1), '');
    assert.equal(jsStringImports.substring('abcdef', 4, 100), 'ef');
    assert.equal(jsStringImports.equals(null, null), 1);
    assert.equal(jsStringImports.equals('a', null), 0);
    assert.equal(jsStringImports.equals('a', 'a'), 1);
    assertTrap(() => jsStringImports.equals('a', 5));
    assert.equal(jsStringImports.compare('a', 'b'), -1);
    assert.equal(jsStringImports.compare('b', 'a'), 1);
    assert.equal(jsStringImports.compare('a', 'a'), 0);
    assertTrap(() => jsStringImports.compare('a', null));
  });

  if (supportsGC) {
    test('fromCharCodeArray takes an exclusive end index', () => {
      const arr = charArray('ABCDEFGHIJ');
      assert.equal(jsStringImports.fromCharCodeArray(arr, 0, 10), 'ABCDEFGHIJ');
      assert.equal(jsStringImports.fromCharCodeArray(arr, 2, 5), 'CDE');
      assert.equal(jsStringImports.fromCharCodeArray(arr, 5, 5), '');
    });

    test('fromCharCodeArray traps on invalid ranges', () => {
      const arr = charArray('ABCDE');
      assertTrap(() => jsStringImports.fromCharCodeArray(arr, 3, 2));
      assertTrap(() => jsStringImports.fromCharCodeArray(arr, 0, 6));
      assertTrap(() => jsStringImports.fromCharCodeArray(arr, 6, 6));
      assertTrap(() => jsStringImports.fromCharCodeArray(null, 0, 0));
    });

    test('intoCharCodeArray writes at the offset and bounds checks', () => {
      const arr = charArray('.....');
      assert.equal(jsStringImports.intoCharCodeArray('AB', arr, 2), 2);
      assert.equal(jsStringImports.fromCharCodeArray(arr, 0, 5), '..AB.');
      assertTrap(() => jsStringImports.intoCharCodeArray('ABCD', arr, 2));
      assertTrap(() => jsStringImports.intoCharCodeArray('AB', null, 0));
      assertTrap(() => jsStringImports.intoCharCodeArray(null, arr, 0));
    });
  }
});

suite('withJsStringImports', () => {
  // below the typed function references baseline the builtin namespaces are not installed at all,
  // and user imports pass through untouched
  const builtinsSupported = supportsJsStringBuiltins();

  test('provides the builtin namespaces when no imports are given', () => {
    const imports = withJsStringImports(undefined);
    if (!builtinsSupported) {
      assert.equal(imports[jsStringBuiltins], undefined);
      assert.equal(imports[jsStringConstants], undefined);
      return;
    }
    assert.equal(imports[jsStringBuiltins].concat, jsStringImports.concat);
    assert.equal(imports[jsStringConstants].anything, 'anything');
  });

  test('builtin implementations take precedence over user entries for recognized names', () => {
    const custom = () => 'x';
    const ns = withJsStringImports({ [jsStringBuiltins]: { concat: custom, newbuiltin: custom } })[jsStringBuiltins];
    assert.equal(ns.concat, builtinsSupported ? jsStringImports.concat : custom);
    assert.equal(ns.newbuiltin, custom);
  });

  test('string constants always resolve to their import name', () => {
    const imports = withJsStringImports({ [jsStringConstants]: { hello: 'other' } });
    assert.equal(imports[jsStringConstants].hello, builtinsSupported ? 'hello' : 'other');
  });

  test('preserves lazy [[Get]] semantics for other namespaces', () => {
    let reads = 0;
    const env = { mem: 1 };
    const imports = withJsStringImports({
      get env() {
        reads++;
        return env;
      }
    });
    assert.equal(reads, 0);
    assert.equal(imports.env, env);
    assert.equal(reads, 1);
  });

  test('resolves prototype-inherited namespaces', () => {
    const env = {};
    const imports = withJsStringImports(Object.create({ env }));
    assert.equal(imports.env, env);
  });
});

suite('module source loading', () => {
  test('compile options', () => {
    assert.equal(jsStringCompileOptions.importedStringConstants, jsStringConstants);
    assert.equal(jsStringCompileOptions.builtins[0], 'js-string');
  });

  test('string constants resolve to their import names', async () => {
    if (!supportsGC) return;
    const mod = await compileStreaming(wasmResponse(constantModuleBytes(jsStringConstants, 'Hello World')));
    assert.equal(moduleImports(mod).length, 0);
    const instance = await WebAssembly.instantiate(mod, jsStringNamespaces);
    assert.equal(instance.exports.constant.value, 'Hello World');
  });

  test('hasBuiltinImports reflects retained builtin namespace imports', async () => {
    const bytes = new Uint8Array(await (await fetch('./resources/js-string-module.wasm')).arrayBuffer());
    if (!WebAssembly.validate(bytes)) return;
    // compiled without the compile options, the builtin imports are always retained
    assert.equal(hasBuiltinImports(new WebAssembly.Module(bytes)), true);
    assert.equal(hasBuiltinImports(new WebAssembly.Module(emptyModuleBytes)), false);
  });

  test('supportsJsStringBuiltins matches typed function references support', () => {
    assert.equal(
      supportsJsStringBuiltins(),
      WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 7, 1, 96, 1, 111, 1, 100, 111]))
    );
  });

  test('module sources reflect without their compiled-in builtin imports', async () => {
    const bytes = new Uint8Array(await (await fetch('./resources/js-string-module.wasm')).arrayBuffer());
    if (!WebAssembly.validate(bytes)) return;
    const mod = await compileStreaming(wasmResponse(bytes));
    const imports = WebAssembly.Module.imports(mod);
    assert.ok(imports.some(({ module, name }) => module === jsStringBuiltins && name === 'newbuiltin'));
    assert.ok(!imports.some(({ module, name }) => module === jsStringBuiltins && name !== 'newbuiltin'));
  });

  test('moduleImports filters the builtin namespaces, moduleExports reflects exports', async () => {
    const bytes = new Uint8Array(await (await fetch('./resources/js-string-module.wasm')).arrayBuffer());
    if (!WebAssembly.validate(bytes)) return;
    const mod = await compileStreaming(wasmResponse(bytes));
    for (const { module } of moduleImports(mod)) {
      assert.ok(module !== jsStringBuiltins && module !== jsStringConstants);
    }
    const exportNames = moduleExports(mod).map(({ name }) => name);
    assert.ok(exportNames.includes('useBuiltins'));
    assert.ok(exportNames.includes('concatStrings'));
  });
});

suite('source phase globals', () => {
  const getTag = () =>
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(WebAssembly.Module).prototype, Symbol.toStringTag).get;

  test('AbstractModuleSource intrinsic', () => {
    const AbstractModuleSource = Object.getPrototypeOf(WebAssembly.Module);
    assert.equal(AbstractModuleSource.name, 'AbstractModuleSource');
    assert.equal(Object.getPrototypeOf(WebAssembly.Module.prototype), AbstractModuleSource.prototype);
  });

  test('brand check getter returns undefined for all non module source receivers', () => {
    const tag = getTag();
    assert.equal(tag.call(new WebAssembly.Module(emptyModuleBytes)), 'WebAssembly.Module');
    assert.equal(tag.call({}), undefined);
    assert.equal(tag.call(null), undefined);
    assert.equal(tag.call(undefined), undefined);
    assert.equal(tag.call(42), undefined);
  });

  test('Module and Instance require new', () => {
    assertThrows(TypeError, () => WebAssembly.Module(emptyModuleBytes));
    assertThrows(TypeError, () => WebAssembly.Instance(new WebAssembly.Module(emptyModuleBytes)));
  });

  test('Module and Instance support subclassing', () => {
    if (!nativeSubclassing) return;
    class MyModule extends WebAssembly.Module {}
    const mod = new MyModule(emptyModuleBytes);
    assert.ok(mod instanceof MyModule);
    assert.equal(getTag().call(mod), 'WebAssembly.Module');
    class MyInstance extends WebAssembly.Instance {}
    assert.ok(new MyInstance(mod) instanceof MyInstance);
  });

  test('constructor identity', () => {
    const mod = new WebAssembly.Module(emptyModuleBytes);
    assert.equal(mod.constructor, WebAssembly.Module);
    assert.equal(new WebAssembly.Instance(mod).constructor, WebAssembly.Instance);
  });

  test('compile and compileStreaming brand module sources', async () => {
    const tag = getTag();
    assert.equal(tag.call(await WebAssembly.compile(emptyModuleBytes)), 'WebAssembly.Module');
    assert.equal(tag.call(await WebAssembly.compileStreaming(wasmResponse(emptyModuleBytes))), 'WebAssembly.Module');
  });

  test('buffer form instantiate brands the module', async () => {
    const tag = getTag();
    const { module, instance } = await WebAssembly.instantiate(emptyModuleBytes);
    assert.equal(tag.call(module), 'WebAssembly.Module');
    assert.ok(instance instanceof WebAssembly.Instance);
  });

  test('instantiate and instantiateStreaming forward compile options', async () => {
    if (!supportsStringConstants) return;
    const tag = getTag();
    const opts = { importedStringConstants: 'myns' };
    const { module, instance } = await WebAssembly.instantiate(constantModuleBytes('myns', 'hi!'), undefined, opts);
    assert.equal(instance.exports.constant.value, 'hi!');
    assert.equal(tag.call(module), 'WebAssembly.Module');
    const streamed = await WebAssembly.instantiateStreaming(wasmResponse(constantModuleBytes('myns', 'hi!')), undefined, opts);
    assert.equal(streamed.instance.exports.constant.value, 'hi!');
    assert.equal(tag.call(streamed.module), 'WebAssembly.Module');
  });

  test('non-object import objects are rejected', async () => {
    const mod = new WebAssembly.Module(emptyModuleBytes);
    try {
      await WebAssembly.instantiate(mod, 42);
    } catch (e) {
      assert.ok(e instanceof TypeError);
      return;
    }
    fail('Expected a TypeError');
  });

  test('namespaceInstance throws TypeError for non wasm namespaces', () => {
    assertThrows(TypeError, () => WebAssembly.namespaceInstance({}));
    assertThrows(TypeError, () => WebAssembly.namespaceInstance(null));
    assertThrows(TypeError, () => WebAssembly.namespaceInstance(undefined));
    assertThrows(TypeError, () => WebAssembly.namespaceInstance(42));
    assertThrows(TypeError, () => WebAssembly.namespaceInstance('ns'));
    assertThrows(TypeError, () => WebAssembly.namespaceInstance([]));
  });

  if (!nativeNamespaceInstance) {
    test('namespaceInstance returns registered instances', () => {
      assertThrows(TypeError, () => WebAssembly.namespaceInstance(shimsNs));
      const instance = { exports: {} };
      wasmInstances.set(shimsNs, instance);
      assert.equal(WebAssembly.namespaceInstance(shimsNs), instance);
    });
  }

  if (!nativeSourcePhase) {
    test('instantiation of source phase modules links the js-string builtins', async () => {
      const bytes = new Uint8Array(await (await fetch('./resources/js-string-module.wasm')).arrayBuffer());
      if (!WebAssembly.validate(bytes)) return;
      const newbuiltin = str => (typeof str === 'string' ? (str.match(/[A-Z]/g) || []).length : 0);
      const imports = { [jsStringBuiltins]: { newbuiltin } };
      const { instance } = await WebAssembly.instantiate(bytes, imports);
      assert.equal(instance.exports.useBuiltins('hello'), 5);
      assert.equal(instance.exports.concatStrings('a', 'b'), 'ab');
      assert.equal(instance.exports.useNewBuiltin('Hello World'), 2);
      const viaInstance = new WebAssembly.Instance(new WebAssembly.Module(bytes), imports);
      assert.equal(viaInstance.exports.concatStrings('a', 'b'), 'ab');
    });
  }
});
