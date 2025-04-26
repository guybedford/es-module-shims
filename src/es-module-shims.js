import { resolveAndComposeImportMap, resolveUrl, resolveImportMap, resolveIfNotPlainOrUrl, asURL } from './resolve.js';
import {
  baseUrl as pageBaseUrl,
  dynamicImport,
  createBlob,
  throwError,
  shimMode,
  resolveHook,
  fetchHook,
  importHook,
  metaHook,
  tsTransform,
  skip,
  revokeBlobURLs,
  noLoadEventRetriggers,
  wasmInstancePhaseEnabled,
  wasmSourcePhaseEnabled,
  deferPhaseEnabled,
  onpolyfill,
  enforceIntegrity,
  fromParent,
  esmsInitOptions,
  nativePassthrough,
  hasDocument,
  hotReload as hotReloadEnabled,
  defaultFetchOpts,
  defineValue,
  optionsScript
} from './env.js';
import {
  supportsImportMaps,
  supportsCssType,
  supportsJsonType,
  supportsWasmInstancePhase,
  supportsWasmSourcePhase,
  supportsMultipleImportMaps,
  featureDetectionPromise
} from './features.js';
import * as lexer from '../node_modules/es-module-lexer/dist/lexer.asm.js';
import { hotReload } from './hot-reload.js';

const _resolve = (id, parentUrl = pageBaseUrl) => {
  const urlResolved = resolveIfNotPlainOrUrl(id, parentUrl) || asURL(id);
  let composedFallback = false;
  const firstResolved = firstImportMap && resolveImportMap(firstImportMap, urlResolved || id, parentUrl);
  const composedResolved =
    composedImportMap === firstImportMap ? firstResolved : (
      resolveImportMap(composedImportMap, urlResolved || id, parentUrl)
    );
  const resolved = composedResolved || firstResolved || throwUnresolved(id, parentUrl);
  // needsShim, shouldShim per load record to set on parent
  let n = false,
    N = false;
  if (!supportsImportMaps) {
    // bare specifier -> needs shim
    if (!urlResolved) n = true;
    // url mapping -> should shim
    else if (urlResolved !== resolved) N = true;
  } else if (!supportsMultipleImportMaps) {
    // bare specifier and not resolved by first import map -> needs shim
    if (!urlResolved && !firstResolved) n = true;
    // resolution doesn't match first import map -> should shim
    if (firstResolved && resolved !== firstResolved) N = true;
  }
  return { r: resolved, n, N };
};

const resolve = (id, parentUrl) => {
  if (!resolveHook) return _resolve(id, parentUrl);
  const result = resolveHook(id, parentUrl, defaultResolve);

  return result ? { r: result, n: true, N: true } : _resolve(id, parentUrl);
};

// import()
async function importShim(id, opts, parentUrl) {
  if (typeof opts === 'string') {
    parentUrl = opts;
    opts = undefined;
  }
  await initPromise; // needed for shim check
  if (self.ESMS_DEBUG) console.info(`es-module-shims: importShim("${id}"${opts ? ', ' + JSON.stringify(opts) : ''})`);
  if (shimMode || !baselinePassthrough) {
    if (hasDocument) processScriptsAndPreloads();
    legacyAcceptingImportMaps = false;
  }
  let sourceType = undefined;
  if (typeof opts === 'object') {
    if (opts.lang === 'ts') sourceType = 'ts';
    if (typeof opts.with === 'object' && typeof opts.with.type === 'string') {
      sourceType = opts.with.type;
    }
  }
  return topLevelLoad(id, parentUrl || pageBaseUrl, defaultFetchOpts, undefined, undefined, undefined, sourceType);
}

// import.source()
// (opts not currently supported as no use cases yet)
if (shimMode || wasmSourcePhaseEnabled)
  importShim.source = async (id, opts, parentUrl) => {
    if (typeof opts === 'string') {
      parentUrl = opts;
      opts = undefined;
    }
    await initPromise; // needed for shim check
    if (self.ESMS_DEBUG)
      console.info(`es-module-shims: importShim.source("${id}"${opts ? ', ' + JSON.stringify(opts) : ''})`);
    if (shimMode || !baselinePassthrough) {
      if (hasDocument) processScriptsAndPreloads();
      legacyAcceptingImportMaps = false;
    }
    await importMapPromise;
    const url = resolve(id, parentUrl || pageBaseUrl).r;
    const load = getOrCreateLoad(url, defaultFetchOpts, undefined, undefined);
    if (firstPolyfillLoad && !shimMode && load.n && nativelyLoaded) {
      onpolyfill();
      firstPolyfillLoad = false;
    }
    await load.f;
    return importShim._s[load.r];
  };

// import.defer() is just a proxy for import(), since we can't actually defer
if (shimMode || deferPhaseEnabled) importShim.defer = importShim;

if (hotReloadEnabled) importShim.hotReload = hotReload;

const defaultResolve = (id, parentUrl) => {
  return (
    resolveImportMap(composedImportMap, resolveIfNotPlainOrUrl(id, parentUrl) || id, parentUrl) ||
    throwUnresolved(id, parentUrl)
  );
};

const throwUnresolved = (id, parentUrl) => {
  throw Error(`Unable to resolve specifier '${id}'${fromParent(parentUrl)}`);
};

const metaResolve = function (id, parentUrl = this.url) {
  return resolve(id, `${parentUrl}`).r;
};

importShim.resolve = (id, parentUrl) => resolve(id, parentUrl).r;
importShim.getImportMap = () => JSON.parse(JSON.stringify(composedImportMap));
importShim.addImportMap = importMapIn => {
  if (!shimMode) throw new Error('Unsupported in polyfill mode.');
  composedImportMap = resolveAndComposeImportMap(importMapIn, pageBaseUrl, composedImportMap);
};

const registry = (importShim._r = {});
// Wasm caches
const sourceCache = (importShim._s = {});
const instanceCache = (importShim._i = new WeakMap());

// Ensure this version is the only version
defineValue(self, 'importShim', Object.freeze(importShim));
const shimModeOptions = { ...esmsInitOptions, shimMode: true };
if (optionsScript) optionsScript.innerHTML = JSON.stringify(shimModeOptions);
self.esmsInitOptions = shimModeOptions;

const loadAll = async (load, seen) => {
  seen[load.u] = 1;
  await load.L;
  await Promise.all(
    load.d.map(({ l: dep, s: sourcePhase }) => {
      if (dep.b || seen[dep.u]) return;
      if (sourcePhase) return dep.f;
      return loadAll(dep, seen);
    })
  );
};

let importMapSrc = false;
let multipleImportMaps = false;
let firstImportMap = null;
// To support polyfilling multiple import maps, we separately track the composed import map from the first import map
let composedImportMap = { imports: {}, scopes: {}, integrity: {} };
let baselinePassthrough;

const initPromise = featureDetectionPromise.then(() => {
  baselinePassthrough =
    esmsInitOptions.polyfillEnable !== true &&
    supportsImportMaps &&
    supportsJsonType &&
    supportsCssType &&
    (!wasmInstancePhaseEnabled || supportsWasmInstancePhase) &&
    (!wasmSourcePhaseEnabled || supportsWasmSourcePhase) &&
    !deferPhaseEnabled &&
    (!multipleImportMaps || supportsMultipleImportMaps) &&
    !importMapSrc;
  if (!shimMode && typeof WebAssembly !== 'undefined') {
    if (wasmSourcePhaseEnabled && !Object.getPrototypeOf(WebAssembly.Module).name) {
      const s = Symbol();
      const brand = m => defineValue(m, s, 'WebAssembly.Module');
      class AbstractModuleSource {
        get [Symbol.toStringTag]() {
          if (this[s]) return this[s];
          throw new TypeError('Not an AbstractModuleSource');
        }
      }
      const { Module: wasmModule, compile: wasmCompile, compileStreaming: wasmCompileStreaming } = WebAssembly;
      WebAssembly.Module = Object.setPrototypeOf(
        Object.assign(function Module(...args) {
          return brand(new wasmModule(...args));
        }, wasmModule),
        AbstractModuleSource
      );
      WebAssembly.Module.prototype = Object.setPrototypeOf(wasmModule.prototype, AbstractModuleSource.prototype);
      WebAssembly.compile = function compile(...args) {
        return wasmCompile(...args).then(brand);
      };
      WebAssembly.compileStreaming = function compileStreaming(...args) {
        return wasmCompileStreaming(...args).then(brand);
      };
    }
  }
  if (hasDocument) {
    if (!supportsImportMaps) {
      const supports = HTMLScriptElement.supports || (type => type === 'classic' || type === 'module');
      HTMLScriptElement.supports = type => type === 'importmap' || supports(type);
    }
    if (shimMode || !baselinePassthrough) {
      attachMutationObserver();
      if (document.readyState === 'complete') {
        readyStateCompleteCheck();
      } else {
        document.addEventListener('readystatechange', readyListener);
      }
    }
    processScriptsAndPreloads();
  }
  return lexer.init;
});

const attachMutationObserver = () => {
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type !== 'childList') continue;
      for (const node of mutation.addedNodes) {
        if (node.tagName === 'SCRIPT') {
          if (node.type === (shimMode ? 'module-shim' : 'module') && !node.ep) processScript(node, true);
          if (node.type === (shimMode ? 'importmap-shim' : 'importmap') && !node.ep) processImportMap(node, true);
        } else if (
          node.tagName === 'LINK' &&
          node.rel === (shimMode ? 'modulepreload-shim' : 'modulepreload') &&
          !node.ep
        ) {
          processPreload(node);
        }
      }
    }
  });
  observer.observe(document, { childList: true });
  observer.observe(document.head, { childList: true });
  processScriptsAndPreloads();
};

let importMapPromise = initPromise;
let firstPolyfillLoad = true;
let legacyAcceptingImportMaps = true;

export const topLevelLoad = async (
  url,
  parentUrl,
  fetchOpts,
  source,
  nativelyLoaded,
  lastStaticLoadPromise,
  sourceType
) => {
  await initPromise;
  await importMapPromise;
  url = (await resolve(url, parentUrl)).r;

  // we mock import('./x.css', { with: { type: 'css' }}) support via an inline static reexport
  // because we can't syntactically pass through to dynamic import with a second argument
  if (sourceType === 'css' || sourceType === 'json') {
    source = `export{default}from'${url}'with{type:"${sourceType}"}`;
    url += '?entry';
  }

  if (importHook) await importHook(url, typeof fetchOpts !== 'string' ? fetchOpts : {}, parentUrl, source, sourceType);
  // early analysis opt-out - no need to even fetch if we have feature support
  if (!shimMode && baselinePassthrough && nativePassthrough && sourceType !== 'ts') {
    if (self.ESMS_DEBUG) console.info(`es-module-shims: early exit for ${url} due to baseline modules support`);
    // for polyfill case, only dynamic import needs a return value here, and dynamic import will never pass nativelyLoaded
    if (nativelyLoaded) return null;
    await lastStaticLoadPromise;
    return dynamicImport(source ? createBlob(source) : url, url || source);
  }
  const load = getOrCreateLoad(url, fetchOpts, undefined, source);
  linkLoad(load, fetchOpts);
  const seen = {};
  await loadAll(load, seen);
  resolveDeps(load, seen);
  await lastStaticLoadPromise;
  if (!shimMode && !load.n) {
    if (nativelyLoaded) {
      if (self.ESMS_DEBUG)
        console.info(
          `es-module-shims: early exit after graph analysis of ${url} - graph ran natively without needing polyfill`
        );
      return;
    }
    if (source) {
      return await dynamicImport(createBlob(source), source);
    }
  }
  if (firstPolyfillLoad && !shimMode && load.n && nativelyLoaded) {
    onpolyfill();
    firstPolyfillLoad = false;
  }
  const module = await (shimMode || load.n || load.N || !nativePassthrough || (!nativelyLoaded && source) ?
    dynamicImport(load.b, load.u)
  : import(load.u));
  // if the top-level load is a shell, run its update function
  if (load.s) (await dynamicImport(load.s, load.u)).u$_(module);
  if (revokeBlobURLs) revokeObjectURLs(Object.keys(seen));
  return module;
};

const revokeObjectURLs = registryKeys => {
  let curIdx = 0;
  const handler = self.requestIdleCallback || self.requestAnimationFrame;
  handler(cleanup);
  function cleanup() {
    for (const key of registryKeys.slice(curIdx, (curIdx += 100))) {
      const load = registry[key];
      if (load && load.b && load.b !== load.u) URL.revokeObjectURL(load.b);
    }
    if (curIdx < registryKeys.length) handler(cleanup);
  }
};

const urlJsString = url => `'${url.replace(/'/g, "\\'")}'`;

let resolvedSource, lastIndex;
const pushStringTo = (load, originalIndex, dynamicImportEndStack) => {
  while (dynamicImportEndStack[dynamicImportEndStack.length - 1] < originalIndex) {
    const dynamicImportEnd = dynamicImportEndStack.pop();
    resolvedSource += `${load.S.slice(lastIndex, dynamicImportEnd)}, ${urlJsString(load.r)}`;
    lastIndex = dynamicImportEnd;
  }
  resolvedSource += load.S.slice(lastIndex, originalIndex);
  lastIndex = originalIndex;
};

const pushSourceURL = (load, commentPrefix, commentStart, dynamicImportEndStack) => {
  const urlStart = commentStart + commentPrefix.length;
  const commentEnd = load.S.indexOf('\n', urlStart);
  const urlEnd = commentEnd !== -1 ? commentEnd : load.S.length;
  let sourceUrl = load.S.slice(urlStart, urlEnd);
  try {
    sourceUrl = new URL(sourceUrl, load.r).href;
  } catch {}
  pushStringTo(load, urlStart, dynamicImportEndStack);
  resolvedSource += sourceUrl;
  lastIndex = urlEnd;
};

const resolveDeps = (load, seen) => {
  if (load.b || !seen[load.u]) return;
  seen[load.u] = 0;

  for (const { l: dep, s: sourcePhase } of load.d) {
    if (!sourcePhase) resolveDeps(dep, seen);
  }

  if (!load.n) load.n = load.d.some(dep => dep.l.n);
  if (!load.N) load.N = load.d.some(dep => dep.l.N);

  // use native loader whenever possible (n = needs shim) via executable subgraph passthrough
  // so long as the module doesn't use dynamic import or unsupported URL mappings (N = should shim)
  if (nativePassthrough && !shimMode && !load.n && !load.N) {
    load.b = load.u;
    load.S = undefined;
    return;
  }

  if (self.ESMS_DEBUG) console.info(`es-module-shims: polyfilling ${load.u}`);

  const [imports, exports] = load.a;

  // "execution"
  let source = load.S,
    depIndex = 0,
    dynamicImportEndStack = [];

  // once all deps have loaded we can inline the dependency resolution blobs
  // and define this blob
  (resolvedSource = ''), (lastIndex = 0);

  for (const { s: start, e: end, ss: statementStart, se: statementEnd, d: dynamicImportIndex, t, a } of imports) {
    // source phase
    if (t === 4) {
      let { l: depLoad } = load.d[depIndex++];
      pushStringTo(load, statementStart, dynamicImportEndStack);
      resolvedSource += `${source.slice(statementStart, start - 1).replace('source', '')}/*${source.slice(start - 1, end + 1)}*/'${createBlob(`export default importShim._s[${urlJsString(depLoad.r)}]`)}'`;
      lastIndex = end + 1;
    }
    // dependency source replacements
    else if (dynamicImportIndex === -1) {
      let keepAssertion = false;
      if (a > 0 && !shimMode) {
        const assertion = source.slice(a, statementEnd - 1);
        // strip assertions only when unsupported in polyfill mode
        keepAssertion =
          nativePassthrough &&
          ((supportsJsonType && assertion.includes('json')) || (supportsCssType && assertion.includes('css')));
      }

      // defer phase stripping
      if (t === 6) {
        pushStringTo(load, statementStart, dynamicImportEndStack);
        resolvedSource += source.slice(statementStart, start - 1).replace('defer', '');
        lastIndex = start;
      }
      let { l: depLoad } = load.d[depIndex++],
        blobUrl = depLoad.b,
        cycleShell = !blobUrl;
      if (cycleShell) {
        // circular shell creation
        if (!(blobUrl = depLoad.s)) {
          blobUrl = depLoad.s = createBlob(
            `export function u$_(m){${depLoad.a[1]
              .map(({ s, e }, i) => {
                const q = depLoad.S[s] === '"' || depLoad.S[s] === "'";
                return `e$_${i}=m${q ? `[` : '.'}${depLoad.S.slice(s, e)}${q ? `]` : ''}`;
              })
              .join(',')}}${
              depLoad.a[1].length ? `let ${depLoad.a[1].map((_, i) => `e$_${i}`).join(',')};` : ''
            }export {${depLoad.a[1]
              .map(({ s, e }, i) => `e$_${i} as ${depLoad.S.slice(s, e)}`)
              .join(',')}}\n//# sourceURL=${depLoad.r}?cycle`
          );
        }
      }

      pushStringTo(load, start - 1, dynamicImportEndStack);
      resolvedSource += `/*${source.slice(start - 1, end + 1)}*/'${blobUrl}'`;

      // circular shell execution
      if (!cycleShell && depLoad.s) {
        resolvedSource += `;import*as m$_${depIndex} from'${depLoad.b}';import{u$_ as u$_${depIndex}}from'${depLoad.s}';u$_${depIndex}(m$_${depIndex})`;
        depLoad.s = undefined;
      }
      lastIndex = keepAssertion ? end + 1 : statementEnd;
    }
    // import.meta
    else if (dynamicImportIndex === -2) {
      load.m = { url: load.r, resolve: metaResolve };
      if (metaHook) metaHook(load.m, load.u);
      pushStringTo(load, start, dynamicImportEndStack);
      resolvedSource += `importShim._r[${urlJsString(load.u)}].m`;
      lastIndex = statementEnd;
    }
    // dynamic import
    else {
      pushStringTo(load, statementStart + 6, dynamicImportEndStack);
      resolvedSource += `Shim${t === 5 ? '.source' : ''}(`;
      dynamicImportEndStack.push(statementEnd - 1);
      lastIndex = start;
    }
  }

  // support progressive cycle binding updates (try statement avoids tdz errors)
  if (load.s && (imports.length === 0 || imports[imports.length - 1].d === -1))
    resolvedSource += `\n;import{u$_}from'${load.s}';try{u$_({${exports
      .filter(e => e.ln)
      .map(({ s, e, ln }) => `${source.slice(s, e)}:${ln}`)
      .join(',')}})}catch(_){};\n`;

  let sourceURLCommentStart = source.lastIndexOf(sourceURLCommentPrefix);
  let sourceMapURLCommentStart = source.lastIndexOf(sourceMapURLCommentPrefix);

  // ignore sourceMap comments before already spliced code
  if (sourceURLCommentStart < lastIndex) sourceURLCommentStart = -1;
  if (sourceMapURLCommentStart < lastIndex) sourceMapURLCommentStart = -1;

  // sourceURL first / only
  if (
    sourceURLCommentStart !== -1 &&
    (sourceMapURLCommentStart === -1 || sourceMapURLCommentStart > sourceURLCommentStart)
  ) {
    pushSourceURL(load, sourceURLCommentPrefix, sourceURLCommentStart, dynamicImportEndStack);
  }
  // sourceMappingURL
  if (sourceMapURLCommentStart !== -1) {
    pushSourceURL(load, sourceMapURLCommentPrefix, sourceMapURLCommentStart, dynamicImportEndStack);
    // sourceURL last
    if (sourceURLCommentStart !== -1 && sourceURLCommentStart > sourceMapURLCommentStart)
      pushSourceURL(load, sourceURLCommentPrefix, sourceURLCommentStart, dynamicImportEndStack);
  }

  pushStringTo(load, source.length, dynamicImportEndStack);

  if (sourceURLCommentStart === -1) resolvedSource += sourceURLCommentPrefix + load.r;

  load.b = createBlob(resolvedSource);
  load.S = resolvedSource = undefined;
};

const sourceURLCommentPrefix = '\n//# sourceURL=';
const sourceMapURLCommentPrefix = '\n//# sourceMappingURL=';

const jsContentType = /^(text|application)\/(x-)?javascript(;|$)/;
const wasmContentType = /^application\/wasm(;|$)/;
const jsonContentType = /^(text|application)\/json(;|$)/;
const cssContentType = /^(text|application)\/css(;|$)/;
const tsContentType = /^application\/typescript(;|$)|/;

const cssUrlRegEx = /url\(\s*(?:(["'])((?:\\.|[^\n\\"'])+)\1|((?:\\.|[^\s,"'()\\])+))\s*\)/g;

// restrict in-flight fetches to a pool of 100
let p = [];
let c = 0;
const pushFetchPool = () => {
  if (++c > 100) return new Promise(r => p.push(r));
};
const popFetchPool = () => {
  c--;
  if (p.length) p.shift()();
};

const doFetch = async (url, fetchOpts, parent) => {
  if (enforceIntegrity && !fetchOpts.integrity) throw Error(`No integrity for ${url}${fromParent(parent)}.`);
  const poolQueue = pushFetchPool();
  if (poolQueue) await poolQueue;
  try {
    var res = await fetchHook(url, fetchOpts);
  } catch (e) {
    e.message = `Unable to fetch ${url}${fromParent(parent)} - see network log for details.\n` + e.message;
    throw e;
  } finally {
    popFetchPool();
  }

  if (!res.ok) {
    const error = new TypeError(`${res.status} ${res.statusText} ${res.url}${fromParent(parent)}`);
    error.response = res;
    throw error;
  }
  return res;
};

let esmsTsTransform;
const initTs = async () => {
  const m = await import(tsTransform);
  if (!esmsTsTransform) esmsTsTransform = m.transform;
};

const hotPrefix = 'var h=import.meta.hot,';
const fetchModule = async (url, fetchOpts, parent) => {
  const mapIntegrity = composedImportMap.integrity[url];
  const res = await doFetch(
    url,
    mapIntegrity && !fetchOpts.integrity ? { ...fetchOpts, integrity: mapIntegrity } : fetchOpts,
    parent
  );
  const r = res.url;
  const contentType = res.headers.get('content-type');
  if (jsContentType.test(contentType)) return { r, s: await res.text(), t: 'js' };
  else if (wasmContentType.test(contentType)) {
    const wasmModule = await (sourceCache[r] || (sourceCache[r] = WebAssembly.compileStreaming(res)));
    const exports = WebAssembly.Module.exports(wasmModule);
    sourceCache[r] = wasmModule;
    const rStr = urlJsString(r);
    let s = `import*as $_ns from${rStr};`,
      i = 0,
      obj = '';
    for (const { module, kind } of WebAssembly.Module.imports(wasmModule)) {
      const specifier = urlJsString(module);
      s += `import*as impt${i} from${specifier};\n`;
      obj += `${specifier}:${kind === 'global' ? `importShim._i.get(impt${i})||impt${i++}` : `impt${i++}`},`;
    }
    s += `${hotPrefix}i=await WebAssembly.instantiate(importShim._s[${rStr}],{${obj}});importShim._i.set($_ns,i);`;
    obj = '';
    for (const { name, kind } of exports) {
      s += `export let ${name}=i.exports['${name}'];`;
      if (kind === 'global') s += `try{${name}=${name}.value}catch{${name}=undefined}`;
      obj += `${name},`;
    }
    s += `if(h)h.accept(m=>({${obj}}=m))`;
    return { r, s, t: 'wasm' };
  } else if (jsonContentType.test(contentType))
    return { r, s: `${hotPrefix}j=${await res.text()};export{j as default};if(h)h.accept(m=>j=m.default)`, t: 'json' };
  else if (cssContentType.test(contentType)) {
    return {
      r,
      s: `${hotPrefix}s=h&&h.data.s||new CSSStyleSheet();s.replaceSync(${JSON.stringify(
        (await res.text()).replace(
          cssUrlRegEx,
          (_match, quotes = '', relUrl1, relUrl2) => `url(${quotes}${resolveUrl(relUrl1 || relUrl2, url)}${quotes})`
        )
      )});if(h){h.data.s=s;h.accept(()=>{})}export default s`,
      t: 'css'
    };
  } else if (tsContentType.test(contentType) || url.endsWith('.ts') || url.endsWith('.mts')) {
    const source = await res.text();
    if (!esmsTsTransform) await initTs();
    const transformed = esmsTsTransform(source, url);
    // even if the TypeScript is valid JavaScript, unless it was a top-level inline source, it wasn't served with
    // a valid JS MIME here, so we must still polyfill it
    return { r, s: transformed === undefined ? source : transformed, t: 'ts' };
  } else
    throw Error(
      `Unsupported Content-Type "${contentType}" loading ${url}${fromParent(parent)}. Modules must be served with a valid MIME type like application/javascript.`
    );
};

const isUnsupportedType = type => {
  if (type === 'wasm' && !wasmInstancePhaseEnabled && !wasmSourcePhaseEnabled) throw featErr(`wasm-modules`);
  return (
    (type === 'css' && !supportsCssType) ||
    (type === 'json' && !supportsJsonType) ||
    (type === 'wasm' && !supportsWasmInstancePhase && !supportsWasmSourcePhase) ||
    type === 'ts'
  );
};

const getOrCreateLoad = (url, fetchOpts, parent, source) => {
  if (source && registry[url]) {
    let i = 0;
    while (registry[url + '#' + ++i]);
    url += '#' + i;
  }
  let load = registry[url];
  if (load) return load;
  registry[url] = load = {
    // url
    u: url,
    // response url
    r: source ? url : undefined,
    // fetchPromise
    f: undefined,
    // source
    S: source,
    // linkPromise
    L: undefined,
    // analysis
    a: undefined,
    // deps
    d: undefined,
    // blobUrl
    b: undefined,
    // shellUrl
    s: undefined,
    // needsShim: does it fail execution in the current native loader?
    n: false,
    // shouldShim: does it need to be loaded by the polyfill loader?
    N: false,
    // type
    t: null,
    // meta
    m: null
  };
  load.f = (async () => {
    if (load.S === undefined) {
      // preload fetch options override fetch options (race)
      ({ r: load.r, s: load.S, t: load.t } = await (fetchCache[url] || fetchModule(url, fetchOpts, parent)));
      if (!load.n && load.t !== 'js' && !shimMode && isUnsupportedType(load.t)) {
        load.n = true;
      }
    }
    try {
      load.a = lexer.parse(load.S, load.u);
    } catch (e) {
      throwError(e);
      load.a = [[], [], false];
    }
    return load;
  })();
  return load;
};

const featErr = feat =>
  Error(
    `${feat} feature must be enabled via <script type="esms-options">{ "polyfillEnable": ["${feat}"] }<${''}/script>`
  );

const linkLoad = (load, fetchOpts) => {
  if (load.L) return;
  load.L = load.f.then(async () => {
    let childFetchOpts = fetchOpts;
    load.d = load.a[0]
      .map(({ n, d, t, a, se }) => {
        const phaseImport = t >= 4;
        const sourcePhase = phaseImport && t < 6;
        if (phaseImport) {
          if (!shimMode && (sourcePhase ? !wasmSourcePhaseEnabled : !deferPhaseEnabled))
            throw featErr(sourcePhase ? 'wasm-module-sources' : 'import-defer');
          if (!sourcePhase || !supportsWasmSourcePhase) load.n = true;
        }
        let source = undefined;
        if (a > 0 && !shimMode && nativePassthrough) {
          const assertion = load.S.slice(a, se - 1);
          // no need to fetch JSON/CSS if supported, since it's a leaf node, we'll just strip the assertion syntax
          if (assertion.includes('json')) {
            if (supportsJsonType) source = '';
            else load.n = true;
          } else if (assertion.includes('css')) {
            if (supportsCssType) source = '';
            else load.n = true;
          }
        }
        if (d !== -1 || !n) return;
        const resolved = resolve(n, load.r || load.u);
        if (resolved.n) load.n = true;
        if (d >= 0 || resolved.N) load.N = true;
        if (d !== -1) return;
        if (skip && skip(resolved.r) && !sourcePhase) return { l: { b: resolved.r }, s: false };
        if (childFetchOpts.integrity) childFetchOpts = { ...childFetchOpts, integrity: undefined };
        const child = { l: getOrCreateLoad(resolved.r, childFetchOpts, load.r, source), s: sourcePhase };
        // assertion case -> inline the CSS / JSON URL directly
        if (source === '') child.l.b = child.l.u;
        if (!child.s) linkLoad(child.l, fetchOpts);
        // load, sourcePhase
        return child;
      })
      .filter(l => l);
  });
};

const processScriptsAndPreloads = () => {
  for (const link of document.querySelectorAll(shimMode ? 'link[rel=modulepreload-shim]' : 'link[rel=modulepreload]')) {
    if (!link.ep) processPreload(link);
  }
  for (const script of document.querySelectorAll('script[type]')) {
    if (script.type === 'importmap' + (shimMode ? '-shim' : '')) {
      if (!script.ep) processImportMap(script);
    } else if (script.type === 'module' + (shimMode ? '-shim' : '')) {
      legacyAcceptingImportMaps = false;
      if (!script.ep) processScript(script);
    }
  }
};

const getFetchOpts = script => {
  const fetchOpts = {};
  if (script.integrity) fetchOpts.integrity = script.integrity;
  if (script.referrerPolicy) fetchOpts.referrerPolicy = script.referrerPolicy;
  if (script.fetchPriority) fetchOpts.priority = script.fetchPriority;
  if (script.crossOrigin === 'use-credentials') fetchOpts.credentials = 'include';
  else if (script.crossOrigin === 'anonymous') fetchOpts.credentials = 'omit';
  else fetchOpts.credentials = 'same-origin';
  return fetchOpts;
};

let lastStaticLoadPromise = Promise.resolve();

let domContentLoaded = false;
let domContentLoadedCnt = 1;
const domContentLoadedCheck = m => {
  if (m === undefined) {
    if (domContentLoaded) return;
    domContentLoaded = true;
    domContentLoadedCnt--;
  }
  if (--domContentLoadedCnt === 0 && !noLoadEventRetriggers && (shimMode || !baselinePassthrough)) {
    if (self.ESMS_DEBUG) console.info(`es-module-shims: DOMContentLoaded refire`);
    document.removeEventListener('DOMContentLoaded', domContentLoadedEvent);
    document.dispatchEvent(new Event('DOMContentLoaded'));
  }
};
let loadCnt = 1;
const loadCheck = () => {
  if (--loadCnt === 0 && !noLoadEventRetriggers && (shimMode || !baselinePassthrough)) {
    if (self.ESMS_DEBUG) console.info(`es-module-shims: load refire`);
    window.removeEventListener('load', loadEvent);
    window.dispatchEvent(new Event('load'));
  }
};

const domContentLoadedEvent = async () => {
  await initPromise;
  domContentLoadedCheck();
};
const loadEvent = async () => {
  await initPromise;
  domContentLoadedCheck();
  loadCheck();
};

// this should always trigger because we assume es-module-shims is itself a domcontentloaded requirement
if (hasDocument) {
  document.addEventListener('DOMContentLoaded', domContentLoadedEvent);
  window.addEventListener('load', loadEvent);
}

const readyListener = async () => {
  await initPromise;
  processScriptsAndPreloads();
  if (document.readyState === 'complete') {
    readyStateCompleteCheck();
  }
};

let readyStateCompleteCnt = 1;
const readyStateCompleteCheck = () => {
  if (--readyStateCompleteCnt === 0) {
    domContentLoadedCheck();
    if (!noLoadEventRetriggers && (shimMode || !baselinePassthrough)) {
      if (self.ESMS_DEBUG) console.info(`es-module-shims: readystatechange complete refire`);
      document.removeEventListener('readystatechange', readyListener);
      document.dispatchEvent(new Event('readystatechange'));
    }
  }
};

const hasNext = script => script.nextSibling || (script.parentNode && hasNext(script.parentNode));
const epCheck = (script, ready) =>
  script.ep ||
  (!ready && ((!script.src && !script.innerHTML) || !hasNext(script))) ||
  script.getAttribute('noshim') !== null ||
  !(script.ep = true);

const processImportMap = (script, ready = readyStateCompleteCnt > 0) => {
  if (epCheck(script, ready)) return;
  if (self.ESMS_DEBUG) console.info(`es-module-shims: reading import map`);
  // we dont currently support external import maps in polyfill mode to match native
  if (script.src) {
    if (!shimMode) return;
    importMapSrc = true;
  }
  importMapPromise = importMapPromise
    .then(async () => {
      composedImportMap = resolveAndComposeImportMap(
        script.src ? await (await doFetch(script.src, getFetchOpts(script))).json() : JSON.parse(script.innerHTML),
        script.src || pageBaseUrl,
        composedImportMap
      );
    })
    .catch(e => {
      if (e instanceof SyntaxError)
        e = new Error(`Unable to parse import map ${e.message} in: ${script.src || script.innerHTML}`);
      throwError(e);
    });
  if (!firstImportMap && legacyAcceptingImportMaps) importMapPromise.then(() => (firstImportMap = composedImportMap));
  if (!legacyAcceptingImportMaps && !multipleImportMaps) {
    multipleImportMaps = true;
    if (!shimMode && baselinePassthrough && !supportsMultipleImportMaps) {
      if (self.ESMS_DEBUG) console.info(`es-module-shims: disabling baseline passthrough due to multiple import maps`);
      baselinePassthrough = false;
      if (hasDocument) attachMutationObserver();
    }
  }
  legacyAcceptingImportMaps = false;
};

const processScript = (script, ready = readyStateCompleteCnt > 0) => {
  if (epCheck(script, ready)) return;
  if (self.ESMS_DEBUG) console.info(`es-module-shims: checking script ${script.src || '<inline>'}`);
  // does this load block readystate complete
  const isBlockingReadyScript = script.getAttribute('async') === null && readyStateCompleteCnt > 0;
  // does this load block DOMContentLoaded
  const isDomContentLoadedScript = domContentLoadedCnt > 0;
  const isLoadScript = loadCnt > 0;
  if (isLoadScript) loadCnt++;
  if (isBlockingReadyScript) readyStateCompleteCnt++;
  if (isDomContentLoadedScript) domContentLoadedCnt++;
  let loadPromise;
  const ts = script.lang === 'ts';
  if (ts && !script.src) {
    loadPromise = Promise.resolve(esmsTsTransform || initTs())
      .then(() => {
        const transformed = esmsTsTransform(script.innerHTML, pageBaseUrl);
        if (transformed !== undefined) {
          onpolyfill();
          firstPolyfillLoad = false;
        }
        return topLevelLoad(
          script.src || pageBaseUrl,
          pageBaseUrl,
          getFetchOpts(script),
          transformed === undefined ? script.innerHTML : transformed,
          !shimMode && transformed === undefined,
          isBlockingReadyScript && lastStaticLoadPromise,
          'ts'
        );
      })
      .catch(throwError);
  } else {
    loadPromise = topLevelLoad(
      script.src || pageBaseUrl,
      pageBaseUrl,
      getFetchOpts(script),
      !script.src ? script.innerHTML : undefined,
      !shimMode,
      isBlockingReadyScript && lastStaticLoadPromise,
      ts ? 'ts' : undefined
    ).catch(throwError);
  }
  if (!noLoadEventRetriggers) loadPromise.then(() => script.dispatchEvent(new Event('load')));
  if (isBlockingReadyScript && !ts) {
    lastStaticLoadPromise = loadPromise.then(readyStateCompleteCheck);
  }
  if (isDomContentLoadedScript) loadPromise.then(domContentLoadedCheck);
  if (isLoadScript) loadPromise.then(loadCheck);
};

const fetchCache = {};
const processPreload = link => {
  link.ep = true;
  if (fetchCache[link.href]) return;
  fetchCache[link.href] = fetchModule(link.href, getFetchOpts(link));
};
