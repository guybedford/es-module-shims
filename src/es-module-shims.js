import {
  baseUrl as pageBaseUrl,
  resolveImportMap,
  createBlob,
  resolveAndComposeImportMap,
  hasDocument,
  resolveIfNotPlainOrUrl,
  resolvedPromise,
  resolveUrl,
  dynamicImport,
  supportsDynamicImport,
  supportsImportMeta,
  supportsImportMaps,
  featureDetectionPromise,
  supportsCssAssertions,
  supportsJsonAssertions
} from './common.js';
import { init, parse } from '../node_modules/es-module-lexer/dist/lexer.js';

let id = 0;
const registry = {};
if (self.ESMS_DEBUG) {
  self._esmsr = registry;
}

async function loadAll (load, seen) {
  if (load.b || seen[load.u])
    return;
  seen[load.u] = 1;
  await load.L;
  await Promise.all(load.d.map(dep => loadAll(dep, seen)));
  if (!load.n)
    load.n = load.d.some(dep => dep.n);
}

let importMap = { imports: {}, scopes: {} };
let importMapSrcOrLazy = false;
let importMapPromise = resolvedPromise;

let waitingForImportMapsInterval;
let firstTopLevelProcess = true;
async function topLevelLoad (url, fetchOpts, source, nativelyLoaded, skipShim, lastStaticLoadPromise) {
  // no need to even fetch if we have feature support
  await featureDetectionPromise;
  if (waitingForImportMapsInterval > 0) {
    clearTimeout(waitingForImportMapsInterval);
    waitingForImportMapsInterval = 0;
  }
  if (firstTopLevelProcess) {
    firstTopLevelProcess = false;
    processScripts();
  }
  await importMapPromise;
  // early analysis opt-out
  if (nativelyLoaded && (skipShim === 'import-maps' && supportsImportMaps || supportsDynamicImport && supportsImportMeta && supportsImportMaps && supportsJsonAssertions && supportsCssAssertions && !importMapSrcOrLazy)) {
    // dont reexec inline for polyfills -> just return null (since no module id for executed inline module scripts)
    return source && nativelyLoaded ? null : dynamicImport(source ? createBlob(source) : url);
  }
  await init;
  const load = getOrCreateLoad(url, fetchOpts, source);
  const seen = {};
  await loadAll(load, seen);
  lastLoad = undefined;
  resolveDeps(load, seen);
  await lastStaticLoadPromise;
  if (source && !shimMode && !load.n) {
    if (lastStaticLoadPromise) {
      didExecForReadyPromise = true;
      if (domContentLoaded)
        didExecForDomContentLoaded = true;
    }
    const module = await dynamicImport(createBlob(source));
    if (shouldRevokeBlobURLs) revokeObjectURLs(Object.keys(seen));
    return module;
  }
  const module = await dynamicImport(load.b);
  if (lastStaticLoadPromise && (!nativelyLoaded || load.b !== load.u)) {
    didExecForReadyPromise = true;
    if (domContentLoaded)
      didExecForDomContentLoaded = true;
  }
  // if the top-level load is a shell, run its update function
  if (load.s)
    (await dynamicImport(load.s)).u$_(module);
  if (shouldRevokeBlobURLs) revokeObjectURLs(Object.keys(seen));
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
    if (batchStartIndex > keysLength) return
    for (const key of registryKeys.slice(batchStartIndex, batchStartIndex + 100)) {
      const load = registry[key];
      if (load) URL.revokeObjectURL(load.b);
    }
    batch++;
    schedule(cleanup);
  }
}

async function importShim (id, parentUrl = pageBaseUrl, _assertion) {
  await featureDetectionPromise;
  // Make sure all the "in-flight" import maps are loaded and applied.
  await importMapPromise;
  const resolved = await resolve(id, parentUrl);
  return topLevelLoad(resolved.r || throwUnresolved(id, parentUrl), { credentials: 'same-origin' });
}

self.importShim = importShim;

const meta = {};

const edge = navigator.userAgent.match(/Edge\/\d\d\.\d+$/);

async function importMetaResolve (id, parentUrl = this.url) {
  await importMapPromise;
  const resolved = await resolve(id, `${parentUrl}`);
  return resolved.r || throwUnresolved(id, parentUrl);
}

self._esmsm = meta;

const esmsInitOptions = self.esmsInitOptions || {};
delete self.esmsInitOptions;
let shimMode = typeof esmsInitOptions.shimMode === 'boolean' ? esmsInitOptions.shimMode : !!esmsInitOptions.fetch || !!document.querySelector('script[type="module-shim"],script[type="importmap-shim"]');
const fetchHook = esmsInitOptions.fetch || ((url, opts) => fetch(url, opts));
const skip = esmsInitOptions.skip || /^https?:\/\/(cdn\.skypack\.dev|jspm\.dev)\//;
const onerror = esmsInitOptions.onerror || ((e) => { throw e; });
const shouldRevokeBlobURLs = esmsInitOptions.revokeBlobURLs;
const noLoadEventRetriggers = esmsInitOptions.noLoadEventRetriggers;

function urlJsString (url) {
  return `'${url.replace(/'/g, "\\'")}'`;
}

let lastLoad;
function resolveDeps (load, seen) {
  if (load.b || !seen[load.u])
    return;
  seen[load.u] = 0;

  for (const dep of load.d)
    resolveDeps(dep, seen);

  // use direct native execution when possible
  // load.n is therefore conservative
  if (!shimMode && !load.n) {
    load.b = lastLoad = load.u;
    load.S = undefined;
    return;
  }

  const [imports] = load.a;

  // "execution"
  const source = load.S;

  // edge doesnt execute sibling in order, so we fix this up by ensuring all previous executions are explicit dependencies
  let resolvedSource = edge && lastLoad ? `import '${lastLoad}';` : '';

  if (!imports.length) {
    resolvedSource += source;
  }
  else {
    // once all deps have loaded we can inline the dependency resolution blobs
    // and define this blob
    let lastIndex = 0, depIndex = 0;
    for (const { s: start, se: end, d: dynamicImportIndex } of imports) {
      // dependency source replacements
      if (dynamicImportIndex === -1) {
        const depLoad = load.d[depIndex++];
        let blobUrl = depLoad.b;
        if (!blobUrl) {
          // circular shell creation
          if (!(blobUrl = depLoad.s)) {
            blobUrl = depLoad.s = createBlob(`export function u$_(m){${
              depLoad.a[1].map(
                name => name === 'default' ? `$_default=m.default` : `${name}=m.${name}`
              ).join(',')
            }}${
              depLoad.a[1].map(name =>
                name === 'default' ? `let $_default;export{$_default as default}` : `export let ${name}`
              ).join(';')
            }\n//# sourceURL=${depLoad.r}?cycle`);
          }
        }
        // circular shell execution
        else if (depLoad.s) {
          resolvedSource += `${source.slice(lastIndex, start - 1)}/*${source.slice(start - 1, end)}*/${urlJsString(blobUrl)};import*as m$_${depIndex} from'${depLoad.b}';import{u$_ as u$_${depIndex}}from'${depLoad.s}';u$_${depIndex}(m$_${depIndex})`;
          lastIndex = end;
          depLoad.s = undefined;
          continue;
        }
        resolvedSource += `${source.slice(lastIndex, start - 1)}/*${source.slice(start - 1, end)}*/${urlJsString(blobUrl)}`;
        lastIndex = end;
      }
      // import.meta
      else if (dynamicImportIndex === -2) {
        meta[load.r] = { url: load.r, resolve: importMetaResolve };
        resolvedSource += `${source.slice(lastIndex, start)}self._esmsm[${urlJsString(load.r)}]`;
        lastIndex = end;
      }
      // dynamic import
      else {
        resolvedSource += `${source.slice(lastIndex, dynamicImportIndex + 6)}Shim(${source.slice(start, end)}, ${load.r && urlJsString(load.r)}`;
        lastIndex = end;
      }
    }

    resolvedSource += source.slice(lastIndex);
  }

  resolvedSource = resolvedSource.replace(/\/\/# sourceMappingURL=(.*)\s*$/, (match, url) => {
    return match.replace(url, new URL(url, load.r));
  });
  let hasSourceURL = false
  resolvedSource = resolvedSource.replace(/\/\/# sourceURL=(.*)\s*$/, (match, url) => {
    hasSourceURL = true;
    return match.replace(url, new URL(url, load.r));
  });
  if (!hasSourceURL) {
    resolvedSource += '\n//# sourceURL=' + load.r;
  }

  load.b = lastLoad = createBlob(resolvedSource);
  load.S = undefined;
}

const jsContentType = /^(text|application)\/(x-)?javascript(;|$)/;
const jsonContentType = /^application\/json(;|$)/;
const cssContentType = /^text\/css(;|$)/;
const wasmContentType = /^application\/wasm(;|$)/;

const cssUrlRegEx = /url\(\s*(?:(["'])((?:\\.|[^\n\\"'])+)\1|((?:\\.|[^\s,"'()\\])+))\s*\)/g;

async function doFetch (url, fetchOpts) {
  const res = await fetchHook(url, fetchOpts);
  if (!res.ok)
    throw new Error(`${res.status} ${res.statusText} ${res.url}`);
  const contentType = res.headers.get('content-type');
  if (jsContentType.test(contentType))
    return { r: res.url, s: await res.text(), t: 'js' };
  else if (jsonContentType.test(contentType))
    return { r: res.url, s: `export default ${await res.text()}`, t: 'json' };
  else if (cssContentType.test(contentType))
    return { r: res.url, s: `var s=new CSSStyleSheet();s.replaceSync(${
      JSON.stringify((await res.text()).replace(cssUrlRegEx, (_match, quotes, relUrl1, relUrl2) => `url(${quotes}${resolveUrl(relUrl1 || relUrl2, url)}${quotes})`))
    });export default s;`, t: 'css' };
  else if (wasmContentType.test(contentType))
    throw new Error('WASM modules not yet supported');
  else
    throw new Error(`Unknown Content-Type "${contentType}"`);
}

function getOrCreateLoad (url, fetchOpts, source) {
  let load = registry[url];
  if (load)
    return load;

  load = registry[url] = {
    // url
    u: url,
    // response url
    r: undefined,
    // fetchPromise
    f: undefined,
    // source
    S: undefined,
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
    // type
    t: null
  };

  load.f = (async () => {
    if (!source) {
      // preload fetch options override fetch options (race)
      let t;
      ({ r: load.r, s: source, t } = await (fetchCache[url] || doFetch(url, fetchOpts)));
      if (t === 'css' && !supportsCssAssertions || t === 'json' && !supportsJsonAssertions)
        load.n = true;
    }
    try {
      load.a = parse(source, load.u);
    }
    catch (e) {
      console.warn(e);
      load.a = [[], []];
    }
    load.S = source;
    return load;
  })();

  load.L = load.f.then(async () => {
    let childFetchOpts = fetchOpts;
    load.d = (await Promise.all(load.a[0].map(async ({ n, d, a }) => {
      if (d >= 0 && !supportsDynamicImport ||
          d === 2 && (!supportsImportMeta || source.slice(end, end + 8) === '.resolve'))
        load.n = true;
      if (!n) return;
      const { r, m } = await resolve(n, load.r || load.u);
      if (m && (!supportsImportMaps || importMapSrcOrLazy))
        load.n = true;
      if (d !== -1) return;
      if (!r)
        throwUnresolved(n, load.r || load.u);
      if (skip.test(r)) return { b: r };
      if (childFetchOpts.integrity)
        childFetchOpts = Object.assign({}, childFetchOpts, { integrity: undefined });
      return getOrCreateLoad(r, childFetchOpts).f;
    }))).filter(l => l);
  });

  return load;
}

function processScripts () {
  if (waitingForImportMapsInterval > 0 && document.readyState !== 'loading') {
    clearTimeout(waitingForImportMapsInterval);
    waitingForImportMapsInterval = 0;
  }
  for (const link of document.querySelectorAll('link[rel="modulepreload"]'))
    processPreload(link);
  for (const script of document.querySelectorAll('script[type="module-shim"],script[type="importmap-shim"],script[type="module"],script[type="importmap"]'))
    processScript(script);
}

function getFetchOpts (script) {
  const fetchOpts = {};
  if (script.integrity)
    fetchOpts.integrity = script.integrity;
  if (script.referrerpolicy)
    fetchOpts.referrerPolicy = script.referrerpolicy;
  if (script.crossorigin === 'use-credentials')
    fetchOpts.credentials = 'include';
  else if (script.crossorigin === 'anonymous')
    fetchOpts.credentials = 'omit';
  else
    fetchOpts.credentials = 'same-origin';
  return fetchOpts;
}

let staticLoadCnt = 0;
let didExecForReadyPromise = false;
let didExecForDomContentLoaded = false;
let lastStaticLoadPromise = Promise.resolve();
let domContentLoaded = false;
document.addEventListener('DOMContentLoaded', () => domContentLoaded = true);
function staticLoadCheck () {
  staticLoadCnt--;
  if (staticLoadCnt === 0 && !noLoadEventRetriggers) {
    if (didExecForDomContentLoaded)
      document.dispatchEvent(new Event('DOMContentLoaded'));
    if (didExecForReadyPromise && document.readyState === 'complete')
      document.dispatchEvent(new Event('readystatechange'));
  }
}

function processScript (script, dynamic) {
  if (script.ep) // ep marker = script processed
    return;
  const shim = script.type.endsWith('-shim');
  if (shim) shimMode = true;
  const type = shimMode ? script.type.slice(0, -5) : script.type;
  // dont process module scripts in shim mode or noshim module scripts in polyfill mode
  if (!shim && shimMode || script.getAttribute('noshim') !== null)
    return;
  // empty inline scripts sometimes show before domready
  if (!script.src && !script.innerHTML)
    return;
  script.ep = true;
  if (type === 'module') {
    const isReadyScript = document.readyState !== 'complete';
    if (isReadyScript) staticLoadCnt++;
    const loadPromise = topLevelLoad(script.src || `${pageBaseUrl}?${id++}`, getFetchOpts(script), !script.src && script.innerHTML, !shimMode, script.getAttribute('skip-shim'), isReadyScript && lastStaticLoadPromise).then(() => {
      script.dispatchEvent(new Event('load'));
    }, e => {
      script.dispatchEvent(new Event('load'));
      onerror(e);
    });
    if (isReadyScript)
      lastStaticLoadPromise = loadPromise.then(staticLoadCheck);
  }
  else if (type === 'importmap') {
    importMapPromise = importMapPromise.then(async () => {
      if (script.src || dynamic)
        importMapSrcOrLazy = true;
      importMap = resolveAndComposeImportMap(script.src ? await (await fetchHook(script.src)).json() : JSON.parse(script.innerHTML), script.src || pageBaseUrl, importMap);
    });
  }
}

const fetchCache = {};
function processPreload (link) {
  if (link.ep) // ep marker = processed
    return;
  link.ep = true;
  if (fetchCache[link.href])
    return;
  fetchCache[link.href] = doFetch(link.href, getFetchOpts(link));
}

new MutationObserver(mutations => {
  for (const mutation of mutations) {
    if (mutation.type !== 'childList') continue;
    for (const node of mutation.addedNodes) {
      if (node.tagName === 'SCRIPT' && node.type)
        processScript(node, !firstTopLevelProcess);
      else if (node.tagName === 'LINK' && node.rel === 'modulepreload')
        processPreload(node);
      else if (node.querySelectorAll) {
        for (const script of node.querySelectorAll('script[type="module-shim"],script[type="importmap-shim"],script[type="module"],script[type="importmap"]')) {
          processScript(script, !firstTopLevelProcess);
        }
        for (const link of node.querySelectorAll('link[rel=modulepreload]')) {
          processPreload(link);
        }
      }
    }
  }
}).observe(document, { childList: true, subtree: true });

async function defaultResolve (id, parentUrl) {
  return resolveImportMap(importMap, resolveIfNotPlainOrUrl(id, parentUrl) || id, parentUrl);
}

async function resolve (id, parentUrl) {
  let urlResolved = resolveIfNotPlainOrUrl(id, parentUrl);

  let resolved;
  if (esmsInitOptions.resolve) {
    resolved = await esmsInitOptions.resolve(id, parentUrl, defaultResolve);
  }
  else {
    resolved = resolveImportMap(importMap, urlResolved || id, parentUrl);
  }

  return { r: resolved, m: urlResolved !== resolved };
}

function throwUnresolved (id, parentUrl) {
  throw Error("Unable to resolve specifier '" + id + (parentUrl ? "' from " + parentUrl : "'"));
}

if (hasDocument) {
  processScripts();
  waitingForImportMapsInterval = setInterval(processScripts, 20);
}
