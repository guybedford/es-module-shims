import {
  baseUrl as pageBaseUrl,
  createBlob,
  resolveAndComposeImportMap,
  resolveUrl,
  edge,
  safari,
  resolveImportMap,
  resolveIfNotPlainOrUrl,
  isURL,
} from './common.js';
import {
  setShimMode,
  shimMode,
  resolveHook,
  fetchHook,
  skip,
  onerror,
  revokeBlobURLs,
  noLoadEventRetriggers,
  cssModulesEnabled,
  jsonModulesEnabled,
  onpolyfill,
  enforceIntegrity,
} from './options.js';
import { dynamicImport } from './dynamic-import-csp.js';
import {
  featureDetectionPromise,
  supportsDynamicImport,
  supportsImportMeta,
  supportsImportMaps,
  supportsCssAssertions,
  supportsJsonAssertions,
} from './features.js';
import * as lexer from '../node_modules/es-module-lexer/dist/lexer.asm.js';

async function defaultResolve (id, parentUrl) {
  return resolveImportMap(importMap, resolveIfNotPlainOrUrl(id, parentUrl) || id, parentUrl);
}

async function _resolve (id, parentUrl) {
  const urlResolved = resolveIfNotPlainOrUrl(id, parentUrl);
  return {
    r: resolveImportMap(importMap, urlResolved || id, parentUrl),
    // b = bare specifier
    b: !urlResolved && !isURL(id)
  };
}

const resolve = resolveHook ? async (id, parentUrl) => ({ r: await resolveHook(id, parentUrl, defaultResolve), b: false }) : _resolve;

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
let baselinePassthrough;

const initPromise = featureDetectionPromise.then(() => {
  // shim mode is determined on initialization, no late shim mode
  if (!shimMode) {
    if (document.querySelectorAll('script[type=module-shim],script[type=importmap-shim],link[rel=modulepreload-shim]').length) {
      setShimMode();
    }
    else {
      let seenScript = false;
      for (const script of document.querySelectorAll('script[type=module],script[type=importmap]')) {
        if (!seenScript) {
          if (script.type === 'module')
            seenScript = true;
        }
        else if (script.type === 'importmap') {
          importMapSrcOrLazy = true;
          break;
        }
      }
    }
  }
  baselinePassthrough = supportsDynamicImport && supportsImportMeta && supportsImportMaps && (!jsonModulesEnabled || supportsJsonAssertions) && (!cssModulesEnabled || supportsCssAssertions) && !importMapSrcOrLazy && !self.ESMS_DEBUG;
  if (shimMode || !baselinePassthrough) {
    new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type !== 'childList') continue;
        for (const node of mutation.addedNodes) {
          if (node.tagName === 'SCRIPT') {
            if (node.type === (shimMode ? 'module-shim' : 'module'))
              processScript(node);
            if (node.type === (shimMode ? 'importmap-shim' : 'importmap'))
              processImportMap(node);
          }
          else if (node.tagName === 'LINK' && node.rel === (shimMode ? 'modulepreload-shim' : 'modulepreload'))
            processPreload(node);
        }
      }
    }).observe(document, { childList: true, subtree: true });
    processImportMaps();
    processScriptsAndPreloads();
    return lexer.init;
  }
});
let importMapPromise = initPromise;
let firstPolyfillLoad = true;
let acceptingImportMaps = true;

async function topLevelLoad (url, fetchOpts, source, nativelyLoaded, lastStaticLoadPromise) {
  if (!shimMode)
    acceptingImportMaps = false;
  await importMapPromise;
  // early analysis opt-out - no need to even fetch if we have feature support
  if (!shimMode && baselinePassthrough) {
    // for polyfill case, only dynamic import needs a return value here, and dynamic import will never pass nativelyLoaded
    if (nativelyLoaded)
      return null;
    await lastStaticLoadPromise;
    return dynamicImport(source ? createBlob(source) : url, { errUrl: url || source });
  }
  const load = getOrCreateLoad(url, fetchOpts, source);
  const seen = {};
  await loadAll(load, seen);
  lastLoad = undefined;
  resolveDeps(load, seen);
  await lastStaticLoadPromise;
  if (source && !shimMode && !load.n && !self.ESMS_DEBUG) {
    const module = await dynamicImport(createBlob(source), { errUrl: source });
    if (revokeBlobURLs) revokeObjectURLs(Object.keys(seen));
    return module;
  }
  if (firstPolyfillLoad && !shimMode && load.n && nativelyLoaded) {
    onpolyfill();
    firstPolyfillLoad = false;
  }
  const module = await dynamicImport(!shimMode && !load.n && nativelyLoaded ? load.u : load.b, { errUrl: load.u });
  // if the top-level load is a shell, run its update function
  if (load.s)
    (await dynamicImport(load.s)).u$_(module);
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
  // needed for shim check
  await initPromise;
  if (acceptingImportMaps || shimMode || !baselinePassthrough) {
    processImportMaps();
    if (!shimMode)
      acceptingImportMaps = false;
  }
  await importMapPromise;
  return topLevelLoad((await resolve(id, parentUrl)).r || throwUnresolved(id, parentUrl), { credentials: 'same-origin' });
}

self.importShim = importShim;

if (shimMode) {
  importShim.getImportMap = () => JSON.parse(JSON.stringify(importMap));
}

const meta = {};

async function importMetaResolve (id, parentUrl = this.url) {
  return (await resolve(id, `${parentUrl}`)).r || throwUnresolved(id, parentUrl);
}

self._esmsm = meta;

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

  // ; and // trailer support added for Ruby 7 source maps compatibility
  let hasSourceURL = false;
  resolvedSource = resolvedSource.replace(sourceMapURLRegEx, (match, isMapping, url) => (hasSourceURL = !isMapping, match.replace(url, () => new URL(url, load.r))));
  if (!hasSourceURL)
    resolvedSource += '\n//# sourceURL=' + load.r;

  load.b = lastLoad = createBlob(resolvedSource);
  load.S = undefined;
}

const sourceMapURLRegEx = /\n\/\/# source(Mapping)?URL=([^\n]+)\s*((;|\/\/[^#][^\n]*)\s*)*$/;

const jsContentType = /^(text|application)\/(x-)?javascript(;|$)/;
const jsonContentType = /^(text|application)\/json(;|$)/;
const cssContentType = /^(text|application)\/css(;|$)/;

const cssUrlRegEx = /url\(\s*(?:(["'])((?:\\.|[^\n\\"'])+)\1|((?:\\.|[^\s,"'()\\])+))\s*\)/g;

// restrict in-flight fetches to a pool of 100
let p = [];
let c = 0;
function pushFetchPool () {
  if (++c > 100)
    return new Promise(r => p.push(r));
}
function popFetchPool () {
  c--;
  if (p.length)
    p.shift()();
}

async function doFetch (url, fetchOpts) {
  if (enforceIntegrity && !fetchOpts.integrity)
    throw Error(`No integrity for ${url}`);
  const poolQueue = pushFetchPool();
  if (poolQueue) await poolQueue;
  try {
    var res = await fetchHook(url, fetchOpts);
  }
  finally {
    popFetchPool();
  }
  if (!res.ok)
    throw Error(`${res.status} ${res.statusText} ${res.url}`);
  const contentType = res.headers.get('content-type');
  if (jsContentType.test(contentType))
    return { r: res.url, s: await res.text(), t: 'js' };
  else if (jsonContentType.test(contentType))
    return { r: res.url, s: `export default ${await res.text()}`, t: 'json' };
  else if (cssContentType.test(contentType))
    return { r: res.url, s: `var s=new CSSStyleSheet();s.replaceSync(${
      JSON.stringify((await res.text()).replace(cssUrlRegEx, (_match, quotes, relUrl1, relUrl2) => `url(${quotes}${resolveUrl(relUrl1 || relUrl2, url)}${quotes})`))
    });export default s;`, t: 'css' };
  else
    throw Error(`Unsupported Content-Type "${contentType}"`);
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
      if (t && !shimMode) {
        if (t === 'css' && !cssModulesEnabled || t === 'json' && !jsonModulesEnabled)
          throw Error(`${t}-modules require <script type="esms-options">{ "polyfillEnable": ["${t}-modules"] }<${''}/script>`);
        if (t === 'css' && !supportsCssAssertions || t === 'json' && !supportsJsonAssertions)
          load.n = true;
      }
    }
    try {
      load.a = lexer.parse(source, load.u);
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
    load.d = (await Promise.all(load.a[0].map(async ({ n, d }) => {
      if (d >= 0 && !supportsDynamicImport || d === 2 && !supportsImportMeta)
        load.n = true;
      if (!n) return;
      const { r, b } = await resolve(n, load.r || load.u);
      if (b && (!supportsImportMaps || importMapSrcOrLazy))
        load.n = true;
      if (d !== -1) return;
      if (!r)
        throwUnresolved(n, load.r || load.u);
      if (skip && skip.test(r)) return { b: r };
      if (childFetchOpts.integrity)
        childFetchOpts = Object.assign({}, childFetchOpts, { integrity: undefined });
      return getOrCreateLoad(r, childFetchOpts).f;
    }))).filter(l => l);
  });

  return load;
}

function processScriptsAndPreloads () {
  for (const script of document.querySelectorAll(shimMode ? 'script[type=module-shim]' : 'script[type=module]'))
    processScript(script);
  for (const link of document.querySelectorAll(shimMode ? 'link[rel=modulepreload-shim]' : 'link[rel=modulepreload]'))
    processPreload(link);
}

function processImportMaps () {
  for (const script of document.querySelectorAll(shimMode ? 'script[type="importmap-shim"]' : 'script[type="importmap"]'))
    processImportMap(script);
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

let lastStaticLoadPromise = Promise.resolve();

let domContentLoadedCnt = 1;
function domContentLoadedCheck () {
  if (--domContentLoadedCnt === 0 && !noLoadEventRetriggers)
    document.dispatchEvent(new Event('DOMContentLoaded'));
}
// this should always trigger because we assume es-module-shims is itself a domcontentloaded requirement
document.addEventListener('DOMContentLoaded', async () => {
  await initPromise;
  domContentLoadedCheck();
  if (shimMode || !baselinePassthrough) {
    processImportMaps();
    processScriptsAndPreloads();
  }
});

let readyStateCompleteCnt = 1;
if (document.readyState === 'complete') {
  readyStateCompleteCheck();
}
else {
  document.addEventListener('readystatechange', async () => {
    processImportMaps();
    await initPromise;
    readyStateCompleteCheck();
  });
}
function readyStateCompleteCheck () {
  if (--readyStateCompleteCnt === 0 && !noLoadEventRetriggers)
    document.dispatchEvent(new Event('readystatechange'));
}

function processImportMap (script) {
  if (script.ep) // ep marker = script processed
    return;
  // empty inline scripts sometimes show before domready
  if (!script.src && !script.innerHTML)
    return;
  script.ep = true;
  // we dont currently support multiple, external or dynamic imports maps in polyfill mode to match native
  if (script.src) {
    if (!shimMode)
      return;
    importMapSrcOrLazy = true;
  }
  if (acceptingImportMaps) {
    importMapPromise = importMapPromise
      .then(async () => {
        importMap = resolveAndComposeImportMap(script.src ? await (await fetchHook(script.src)).json() : JSON.parse(script.innerHTML), script.src || pageBaseUrl, importMap);
      })
      .catch(error => setTimeout(() => { throw error }));
    if (!shimMode)
      acceptingImportMaps = false;
  }
}

function processScript (script) {
  if (script.ep) // ep marker = script processed
    return;
  if (script.getAttribute('noshim') !== null)
    return;
  // empty inline scripts sometimes show before domready
  if (!script.src && !script.innerHTML)
    return;
  script.ep = true;
  // does this load block readystate complete
  const isReadyScript = readyStateCompleteCnt > 0;
  // does this load block DOMContentLoaded
  const isDomContentLoadedScript = domContentLoadedCnt > 0;
  if (isReadyScript) readyStateCompleteCnt++;
  if (isDomContentLoadedScript) domContentLoadedCnt++;
  const blocks = script.getAttribute('async') === null && isReadyScript;
  const loadPromise = topLevelLoad(script.src || `${pageBaseUrl}?${id++}`, getFetchOpts(script), !script.src && script.innerHTML, !shimMode, blocks && lastStaticLoadPromise).catch(e => {
    // Safari only gives error via console.error
    if (safari)
      console.error(e);
    // Firefox only gives error stack via setTimeout
    else
      setTimeout(() => { throw e});
    onerror(e);
  });
  if (blocks)
    lastStaticLoadPromise = loadPromise.then(readyStateCompleteCheck);
  if (isDomContentLoadedScript)
    loadPromise.then(domContentLoadedCheck);
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

function throwUnresolved (id, parentUrl) {
  throw Error("Unable to resolve specifier '" + id + (parentUrl ? "' from " + parentUrl : "'"));
}
