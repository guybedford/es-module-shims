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
  cssModulesEnabled,
  jsonModulesEnabled,
  wasmModulesEnabled,
  sourcePhaseEnabled,
  onpolyfill,
  enforceIntegrity,
  fromParent,
  esmsInitOptions,
  hasDocument,
  typescriptEnabled
} from './env.js';
import {
  supportsImportMaps,
  supportsCssType,
  supportsJsonType,
  supportsWasmModules,
  supportsSourcePhase,
  supportsMultipleImportMaps,
  featureDetectionPromise
} from './features.js';
import * as lexer from '../node_modules/es-module-lexer/dist/lexer.asm.js';

function _resolve(id, parentUrl = pageBaseUrl) {
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
}

const resolve =
  resolveHook ?
    (id, parentUrl = pageBaseUrl) => {
      const result = resolveHook(id, parentUrl, defaultResolve);
      return result ? { r: result, n: true, N: true } : _resolve(id, parentUrl);
    }
  : _resolve;

async function importHandler(id, opts, parentUrl = pageBaseUrl, sourcePhase) {
  await initPromise; // needed for shim check
  if (self.ESMS_DEBUG)
    console.info(
      `es-module-shims: importShim${sourcePhase ? '.source' : ''}("${id}"${opts ? ', ' + JSON.stringify(opts) : ''})`
    );
  if (importHook) await importHook(id, opts, parentUrl);
  if (shimMode || !baselinePassthrough) {
    if (hasDocument) processScriptsAndPreloads();
    legacyAcceptingImportMaps = false;
  }
  await importMapPromise;
  return resolve(id, parentUrl).r;
}

// import()
async function importShim(id, opts, parentUrl) {
  if (typeof opts === 'string') {
    parentUrl = opts;
    opts = undefined;
  }
  // we mock import('./x.css', { with: { type: 'css' }}) support via an inline static reexport
  // because we can't syntactically pass through to dynamic import with a second argument in this libarary
  let url = await importHandler(id, opts, parentUrl, false);
  let source = null;
  if (typeof opts === 'object' && typeof opts.with === 'object' && typeof opts.with.type === 'string') {
    source = `export{default}from'${url}'with{type:"${opts.with.type}"}`;
    url += '?entry';
  }
  return topLevelLoad(url, { credentials: 'same-origin' }, source, undefined, undefined);
}

// import.source()
// (opts not currently supported as no use cases yet)
if (shimMode || sourcePhaseEnabled)
  importShim.source = async function importShimSource(specifier, opts, parentUrl) {
    if (typeof opts === 'string') {
      parentUrl = opts;
      opts = undefined;
    }
    const url = await importHandler(specifier, opts, parentUrl, true);
    const load = getOrCreateLoad(url, { credentials: 'same-origin' }, null, null);
    if (firstPolyfillLoad && !shimMode && load.n && nativelyLoaded) {
      onpolyfill();
      firstPolyfillLoad = false;
    }
    await load.f;
    return importShim._s[load.r];
  };

self.importShim = importShim;

function defaultResolve(id, parentUrl) {
  return (
    resolveImportMap(composedImportMap, resolveIfNotPlainOrUrl(id, parentUrl) || id, parentUrl) ||
    throwUnresolved(id, parentUrl)
  );
}

function throwUnresolved(id, parentUrl) {
  throw Error(`Unable to resolve specifier '${id}'${fromParent(parentUrl)}`);
}

function metaResolve(id, parentUrl = this.url) {
  return resolve(id, `${parentUrl}`).r;
}

importShim.resolve = (id, parentUrl) => resolve(id, parentUrl).r;
importShim.getImportMap = () => JSON.parse(JSON.stringify(composedImportMap));
importShim.addImportMap = importMapIn => {
  if (!shimMode) throw new Error('Unsupported in polyfill mode.');
  composedImportMap = resolveAndComposeImportMap(importMapIn, pageBaseUrl, composedImportMap);
};

const registry = (importShim._r = {});
const sourceCache = (importShim._s = {});

async function loadAll(load, seen) {
  seen[load.u] = 1;
  await load.L;
  await Promise.all(
    load.d.map(({ l: dep, s: sourcePhase }) => {
      if (dep.b || seen[dep.u]) return;
      if (sourcePhase) return dep.f;
      return loadAll(dep, seen);
    })
  );
}

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
    (!jsonModulesEnabled || supportsJsonType) &&
    (!cssModulesEnabled || supportsCssType) &&
    (!wasmModulesEnabled || supportsWasmModules) &&
    (!sourcePhaseEnabled || supportsSourcePhase) &&
    (!multipleImportMaps || supportsMultipleImportMaps) &&
    !importMapSrc &&
    !typescriptEnabled;
  if (
    !shimMode &&
    sourcePhaseEnabled &&
    typeof WebAssembly !== 'undefined' &&
    !Object.getPrototypeOf(WebAssembly.Module).name
  ) {
    const s = Symbol();
    const brand = m =>
      Object.defineProperty(m, s, { writable: false, configurable: false, value: 'WebAssembly.Module' });
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
        async function readyListener() {
          await initPromise;
          processScriptsAndPreloads();
          if (document.readyState === 'complete') {
            readyStateCompleteCheck();
            document.removeEventListener('readystatechange', readyListener);
          }
        }
        document.addEventListener('readystatechange', readyListener);
      }
    }
    processScriptsAndPreloads();
  }
  return lexer.init;
});

function attachMutationObserver() {
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
}

let importMapPromise = initPromise;
let firstPolyfillLoad = true;
let legacyAcceptingImportMaps = true;

async function topLevelLoad(url, fetchOpts, source, nativelyLoaded, lastStaticLoadPromise) {
  legacyAcceptingImportMaps = false;
  await initPromise;
  await importMapPromise;
  if (importHook) await importHook(url, typeof fetchOpts !== 'string' ? fetchOpts : {}, '');
  // early analysis opt-out - no need to even fetch if we have feature support
  if (!shimMode && baselinePassthrough) {
    if (self.ESMS_DEBUG) console.info(`es-module-shims: early exit for ${url} due to baseline modules support`);
    // for polyfill case, only dynamic import needs a return value here, and dynamic import will never pass nativelyLoaded
    if (nativelyLoaded) return null;
    await lastStaticLoadPromise;
    return dynamicImport(source ? createBlob(source) : url, url || source);
  }
  const load = getOrCreateLoad(url, fetchOpts, null, source);
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
  const module = await (!shimMode && !load.n && !load.N ? import(load.u) : dynamicImport(load.b, load.u));
  // if the top-level load is a shell, run its update function
  if (load.s) (await dynamicImport(load.s, load.u)).u$_(module);
  if (revokeBlobURLs) revokeObjectURLs(Object.keys(seen));
  // when tla is supported, this should return the tla promise as an actual handle
  // so readystate can still correspond to the sync subgraph exec completions
  return module;
}

function revokeObjectURLs(registryKeys) {
  let batch = 0;
  const keysLength = registryKeys.length;
  const schedule = self.requestIdleCallback ? self.requestIdleCallback : self.requestAnimationFrame;
  schedule(cleanup);
  function cleanup() {
    const batchStartIndex = batch * 100;
    if (batchStartIndex > keysLength) return;
    for (const key of registryKeys.slice(batchStartIndex, batchStartIndex + 100)) {
      const load = registry[key];
      if (load && load.b) URL.revokeObjectURL(load.b);
    }
    batch++;
    schedule(cleanup);
  }
}

function urlJsString(url) {
  return `'${url.replace(/'/g, "\\'")}'`;
}

function resolveDeps(load, seen) {
  if (load.b || !seen[load.u]) return;
  seen[load.u] = 0;

  for (const { l: dep, s: sourcePhase } of load.d) {
    if (!sourcePhase) resolveDeps(dep, seen);
  }

  if (!load.n) load.n = load.d.some(dep => dep.l.n);
  if (!load.N) load.N = load.d.some(dep => dep.l.N);

  // use native loader whenever possible (n = needs shim) via executable subgraph passthrough
  // so long as the module doesn't use dynamic import or unsupported URL mappings (N = should shim)
  if (!shimMode && !load.n && !load.N) {
    load.b = load.u;
    load.S = undefined;
    return;
  }

  if (self.ESMS_DEBUG) console.info(`es-module-shims: polyfilling ${load.u}`);

  const [imports, exports] = load.a;

  // "execution"
  const source = load.S;

  let resolvedSource = '';

  // once all deps have loaded we can inline the dependency resolution blobs
  // and define this blob
  let lastIndex = 0,
    depIndex = 0,
    dynamicImportEndStack = [];
  function pushStringTo(originalIndex) {
    while (dynamicImportEndStack[dynamicImportEndStack.length - 1] < originalIndex) {
      const dynamicImportEnd = dynamicImportEndStack.pop();
      resolvedSource += `${source.slice(lastIndex, dynamicImportEnd)}, ${urlJsString(load.r)}`;
      lastIndex = dynamicImportEnd;
    }
    resolvedSource += source.slice(lastIndex, originalIndex);
    lastIndex = originalIndex;
  }

  for (const { s: start, e: end, ss: statementStart, se: statementEnd, d: dynamicImportIndex, t, a } of imports) {
    // source phase
    if (t === 4) {
      let { l: depLoad } = load.d[depIndex++];
      pushStringTo(statementStart);
      resolvedSource += 'import ';
      lastIndex = statementStart + 14;
      pushStringTo(start - 1);
      resolvedSource += `/*${source.slice(start - 1, end + 1)}*/'${createBlob(`export default importShim._s[${urlJsString(depLoad.r)}]`)}'`;
      lastIndex = end + 1;
    }
    // dependency source replacements
    else if (dynamicImportIndex === -1) {
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

      // strip import assertions unless we support them
      const stripAssertion = (!supportsCssType && !supportsJsonType) || !(a > 0);

      pushStringTo(start - 1);
      resolvedSource += `/*${source.slice(start - 1, end + 1)}*/'${blobUrl}'`;

      // circular shell execution
      if (!cycleShell && depLoad.s) {
        resolvedSource += `;import*as m$_${depIndex} from'${depLoad.b}';import{u$_ as u$_${depIndex}}from'${depLoad.s}';u$_${depIndex}(m$_${depIndex})`;
        depLoad.s = undefined;
      }
      lastIndex = stripAssertion ? statementEnd : end + 1;
    }
    // import.meta
    else if (dynamicImportIndex === -2) {
      load.m = { url: load.r, resolve: metaResolve };
      metaHook(load.m, load.u);
      pushStringTo(start);
      resolvedSource += `importShim._r[${urlJsString(load.u)}].m`;
      lastIndex = statementEnd;
    }
    // dynamic import
    else {
      pushStringTo(statementStart + 6);
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

  function pushSourceURL(commentPrefix, commentStart) {
    const urlStart = commentStart + commentPrefix.length;
    const commentEnd = source.indexOf('\n', urlStart);
    const urlEnd = commentEnd !== -1 ? commentEnd : source.length;
    let sourceUrl = source.slice(urlStart, urlEnd);
    try {
      sourceUrl = new URL(sourceUrl, load.r).href;
    } catch {}
    pushStringTo(urlStart);
    resolvedSource += sourceUrl;
    lastIndex = urlEnd;
  }

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
    pushSourceURL(sourceURLCommentPrefix, sourceURLCommentStart);
  }
  // sourceMappingURL
  if (sourceMapURLCommentStart !== -1) {
    pushSourceURL(sourceMapURLCommentPrefix, sourceMapURLCommentStart);
    // sourceURL last
    if (sourceURLCommentStart !== -1 && sourceURLCommentStart > sourceMapURLCommentStart)
      pushSourceURL(sourceURLCommentPrefix, sourceURLCommentStart);
  }

  pushStringTo(source.length);

  if (sourceURLCommentStart === -1) resolvedSource += sourceURLCommentPrefix + load.r;

  load.b = createBlob(resolvedSource);
  load.S = undefined;
}

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
function pushFetchPool() {
  if (++c > 100) return new Promise(r => p.push(r));
}
function popFetchPool() {
  c--;
  if (p.length) p.shift()();
}

async function doFetch(url, fetchOpts, parent) {
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
}

let esmsTsTransform;
async function initTs() {
  const m = await import(tsTransform);
  if (!esmsTsTransform) esmsTsTransform = m.transform;
}

async function fetchModule(url, fetchOpts, parent) {
  const mapIntegrity = composedImportMap.integrity[url];
  const res = await doFetch(
    url,
    mapIntegrity && !fetchOpts.integrity ? Object.assign({}, fetchOpts, { integrity: mapIntegrity }) : fetchOpts,
    parent
  );
  const r = res.url;
  const contentType = res.headers.get('content-type');
  if (jsContentType.test(contentType)) return { r, s: await res.text(), t: 'js' };
  else if (wasmContentType.test(contentType)) {
    const module = await (sourceCache[r] || (sourceCache[r] = WebAssembly.compileStreaming(res)));
    sourceCache[r] = module;
    let s = '',
      i = 0,
      importObj = '';
    for (const impt of WebAssembly.Module.imports(module)) {
      const specifier = urlJsString(impt.module);
      s += `import * as impt${i} from ${specifier};\n`;
      importObj += `${specifier}:impt${i++},`;
    }
    i = 0;
    s += `const instance = await WebAssembly.instantiate(importShim._s[${urlJsString(r)}], {${importObj}});\n`;
    for (const expt of WebAssembly.Module.exports(module)) {
      s += `export const ${expt.name} = instance.exports['${expt.name}'];\n`;
    }
    return { r, s, t: 'wasm' };
  } else if (jsonContentType.test(contentType)) return { r, s: `export default ${await res.text()}`, t: 'json' };
  else if (cssContentType.test(contentType)) {
    return {
      r,
      s: `var s=new CSSStyleSheet();s.replaceSync(${JSON.stringify(
        (await res.text()).replace(
          cssUrlRegEx,
          (_match, quotes = '', relUrl1, relUrl2) => `url(${quotes}${resolveUrl(relUrl1 || relUrl2, url)}${quotes})`
        )
      )});export default s;`,
      t: 'css'
    };
  } else if (
    (shimMode || typescriptEnabled) &&
    (tsContentType.test(contentType) || url.endsWith('.ts') || url.endsWith('.mts'))
  ) {
    const source = await res.text();
    if (!esmsTsTransform) await initTs();
    const transformed = esmsTsTransform(source, url);
    return { r, s: transformed === undefined ? source : transformed, t: transformed !== undefined ? 'ts' : 'js' };
  } else
    throw Error(
      `Unsupported Content-Type "${contentType}" loading ${url}${fromParent(parent)}. Modules must be served with a valid MIME type like application/javascript.`
    );
}

function isUnsupportedType(type) {
  if (
    (type === 'css' && !cssModulesEnabled) ||
    (type === 'json' && !jsonModulesEnabled) ||
    (type === 'wasm' && !wasmModulesEnabled) ||
    (type === 'ts' && !typescriptEnabled)
  )
    throw featErr(`${type}-modules`);
  return (
    (type === 'css' && !supportsCssType) ||
    (type === 'json' && !supportsJsonType) ||
    (type === 'wasm' && !supportsWasmModules) ||
    type === 'ts'
  );
}

function getOrCreateLoad(url, fetchOpts, parent, source) {
  if (source && registry[url]) {
    let i = 0;
    while (registry[url + ++i]);
    url += i;
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
    // needsShim
    n: false,
    // shouldShim
    N: false,
    // type
    t: null,
    // meta
    m: null
  };
  load.f = (async () => {
    if (!load.S) {
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
}

const featErr = feat =>
  Error(
    `${feat} feature must be enabled via <script type="esms-options">{ "polyfillEnable": ["${feat}"] }<${''}/script>`
  );

function linkLoad(load, fetchOpts) {
  if (load.L) return;
  load.L = load.f.then(async () => {
    let childFetchOpts = fetchOpts;
    load.d = load.a[0]
      .map(({ n, d, t, a }) => {
        const sourcePhase = t >= 4;
        if (sourcePhase) {
          if (!shimMode && !sourcePhaseEnabled) throw featErr('source-phase');
          if (!supportsSourcePhase) load.n = true;
        }
        if (a > 0) {
          if (!shimMode && !cssModulesEnabled && !jsonModulesEnabled) throw featErr('css-modules / json-modules');
          if (!supportsCssType && !supportsJsonType) load.n = true;
        }
        if (d !== -1 || !n) return;
        const resolved = resolve(n, load.r || load.u);
        if (resolved.n) load.n = true;
        if (d >= 0 || resolved.N) load.N = true;
        if (d !== -1) return;
        if (skip && skip(resolved.r) && !sourcePhase) return { l: { b: resolved.r }, s: false };
        if (childFetchOpts.integrity) childFetchOpts = Object.assign({}, childFetchOpts, { integrity: undefined });
        const child = { l: getOrCreateLoad(resolved.r, childFetchOpts, load.r, null), s: sourcePhase };
        if (!child.s) linkLoad(child.l, fetchOpts);
        // load, sourcePhase
        return child;
      })
      .filter(l => l);
  });
}

function processScriptsAndPreloads() {
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
}

function getFetchOpts(script) {
  const fetchOpts = {};
  if (script.integrity) fetchOpts.integrity = script.integrity;
  if (script.referrerPolicy) fetchOpts.referrerPolicy = script.referrerPolicy;
  if (script.fetchPriority) fetchOpts.priority = script.fetchPriority;
  if (script.crossOrigin === 'use-credentials') fetchOpts.credentials = 'include';
  else if (script.crossOrigin === 'anonymous') fetchOpts.credentials = 'omit';
  else fetchOpts.credentials = 'same-origin';
  return fetchOpts;
}

let lastStaticLoadPromise = Promise.resolve();

let domContentLoadedCnt = 1;
function domContentLoadedCheck() {
  if (--domContentLoadedCnt === 0 && !noLoadEventRetriggers && (shimMode || !baselinePassthrough)) {
    if (self.ESMS_DEBUG) console.info(`es-module-shims: DOMContentLoaded refire`);
    document.dispatchEvent(new Event('DOMContentLoaded'));
  }
}
let loadCnt = 1;
function loadCheck() {
  if (--loadCnt === 0 && !noLoadEventRetriggers && (shimMode || !baselinePassthrough)) {
    if (self.ESMS_DEBUG) console.info(`es-module-shims: load refire`);
    window.dispatchEvent(new Event('load'));
  }
}
// this should always trigger because we assume es-module-shims is itself a domcontentloaded requirement
if (hasDocument) {
  document.addEventListener('DOMContentLoaded', async () => {
    await initPromise;
    domContentLoadedCheck();
  });
  window.addEventListener('load', async () => {
    await initPromise;
    loadCheck();
  });
}

let readyStateCompleteCnt = 1;
function readyStateCompleteCheck() {
  if (--readyStateCompleteCnt === 0 && !noLoadEventRetriggers && (shimMode || !baselinePassthrough)) {
    if (self.ESMS_DEBUG) console.info(`es-module-shims: readystatechange complete refire`);
    document.dispatchEvent(new Event('readystatechange'));
  }
}

const hasNext = script => script.nextSibling || (script.parentNode && hasNext(script.parentNode));
const epCheck = (script, ready) =>
  script.ep ||
  (!ready && ((!script.src && !script.innerHTML) || !hasNext(script))) ||
  script.getAttribute('noshim') !== null ||
  !(script.ep = true);

function processImportMap(script, ready = readyStateCompleteCnt > 0) {
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
}

function processScript(script, ready = readyStateCompleteCnt > 0) {
  if (epCheck(script, ready)) return;
  if (script.lang === 'ts' && !script.src) {
    const source = script.innerHTML;
    return initTs()
      .then(() => {
        const transformed = esmsTsTransform(source, pageBaseUrl);
        if (transformed !== undefined) {
          onpolyfill();
          firstPolyfillLoad = false;
        }
        return topLevelLoad(
          pageBaseUrl,
          getFetchOpts(script),
          transformed === undefined ? source : transformed,
          transformed === undefined,
          undefined
        );
      })
      .catch(throwError);
  }
  if (self.ESMS_DEBUG) console.info(`es-module-shims: checking script ${script.src || '<inline>'}`);
  // does this load block readystate complete
  const isBlockingReadyScript = script.getAttribute('async') === null && readyStateCompleteCnt > 0;
  // does this load block DOMContentLoaded
  const isDomContentLoadedScript = domContentLoadedCnt > 0;
  const isLoadScript = loadCnt > 0;
  if (isLoadScript) loadCnt++;
  if (isBlockingReadyScript) readyStateCompleteCnt++;
  if (isDomContentLoadedScript) domContentLoadedCnt++;
  const loadPromise = topLevelLoad(
    script.src || pageBaseUrl,
    getFetchOpts(script),
    !script.src && script.innerHTML,
    !shimMode,
    isBlockingReadyScript && lastStaticLoadPromise
  ).catch(throwError);
  if (!noLoadEventRetriggers) loadPromise.then(() => script.dispatchEvent(new Event('load')));
  if (isBlockingReadyScript) lastStaticLoadPromise = loadPromise.then(readyStateCompleteCheck);
  if (isDomContentLoadedScript) loadPromise.then(domContentLoadedCheck);
  if (isLoadScript) loadPromise.then(loadCheck);
}

const fetchCache = {};
function processPreload(link) {
  link.ep = true;
  if (fetchCache[link.href]) return;
  fetchCache[link.href] = fetchModule(link.href, getFetchOpts(link));
}
