import { baseUrl as pageBaseUrl, parseImportMap, resolveImportMap, createBlob, resolveUrl } from './common.js';
import { init, parse } from '../node_modules/es-module-lexer/dist/lexer.js';
import { WorkerShim } from './worker-shims.js';

let id = 0;
const registry = {};

// support browsers without dynamic import support (eg Firefox 6x)
let dynamicImport;
try {
  dynamicImport = (0, eval)('u=>import(u)');
}
catch (e) {
  if (typeof document !== 'undefined') {
    self.addEventListener('error', e => importShim.e = e.error);
    dynamicImport = blobUrl => {
      const topLevelBlobUrl = createBlob(
        `import*as m from'${blobUrl}';self.importShim.l=m;self.importShim.e=null`
      );
      const s = document.createElement('script');
      s.type = 'module';
      s.src = topLevelBlobUrl;
      document.head.appendChild(s);
      return new Promise((resolve, reject) => {
        s.addEventListener('load', () => {
          document.head.removeChild(s);
          importShim.e ? reject(importShim.e) : resolve(importShim.l, pageBaseUrl);
        });
      });
    };
  }
}

async function loadAll (load, loaded) {
  if (load.b || loaded[load.u])
    return;
  loaded[load.u] = true;
  await load.L;
  await Promise.all(load.d.map(dep => loadAll(dep, loaded)));
}

async function topLevelLoad (url, source) {
  await init;
  const load = getOrCreateLoad(url, source);
  await loadAll(load, {});
  resolveDeps(load, {});
  const module = await dynamicImport(load.b);
  // if the top-level load is a shell, run its update function
  if (load.s)
    (await dynamicImport(load.s)).u$_(module);
  return module;
}

async function importShim (id, parentUrl) {
  return topLevelLoad(await resolve(id, parentUrl || pageBaseUrl));
}

self.importShim = importShim;

const meta = {};
const wasmModules = {};

Object.defineProperties(importShim, {
  map: { value: {}, writable: true },
  m: { value: meta },
  w: { value: wasmModules },
  l: { value: undefined, writable: true },
  e: { value: undefined, writable: true }
});

async function resolveDeps (load, seen) {
  if (load.b)
    return;
  seen[load.u] = true;

  let source = load.S;
  let resolvedSource;

  for (const depLoad of load.d)
    if (!seen[depLoad.u])
      resolveDeps(depLoad, seen);
  if (!load.a[0].length) {
    resolvedSource = source;
  }
  else {
    // once all deps have loaded we can inline the dependency resolution blobs
    // and define this blob
    let lastIndex = 0;
    resolvedSource = '';
    let depIndex = 0;
    for (let i = 0; i < load.a[0].length; i++) {
      const { s: start, e: end, d: dynamicImportIndex } = load.a[0][i];
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
          resolvedSource += source.slice(lastIndex, start - 1) + '/*' + source.slice(start - 1, end + 1) + '*/' + source.slice(start - 1, start) + blobUrl + source[end] + `;import*as m$_${depIndex} from'${depLoad.b}';import{u$_ as u$_${depIndex}}from'${depLoad.s}';u$_${depIndex}(m$_${depIndex})`;
          lastIndex = end + 1;
          depLoad.s = undefined;
          continue;
        }
        resolvedSource += source.slice(lastIndex, start - 1) + '/*' + source.slice(start - 1, end + 1) + '*/' + source.slice(start - 1, start) + blobUrl;
        lastIndex = end;
      }
      // import.meta
      else if (dynamicImportIndex === -2) {
        meta[load.r] = { url: load.r };
        resolvedSource += source.slice(lastIndex, start) + 'importShim.m[' + JSON.stringify(load.r) + ']';
        lastIndex = end;
      }
      // dynamic import
      else {
        resolvedSource += source.slice(lastIndex, dynamicImportIndex + 6) + 'Shim(' + source.slice(start, end) + ', ' + JSON.stringify(load.r);
        lastIndex = end;
      }
    }
    resolvedSource += source.slice(lastIndex);
  }

  const lastNonEmptyLine = resolvedSource.slice(resolvedSource.trimEnd().lastIndexOf('\n') + 1);
  load.b = createBlob(resolvedSource + (lastNonEmptyLine.startsWith('//# sourceMappingURL=') ? '\n//# sourceMappingURL=' + resolveUrl(lastNonEmptyLine.slice(21), load.r) : '') + '\n//# sourceURL=' + load.r);
  load.S = undefined;
}

function getOrCreateLoad (url, source) {
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
  };

  load.f = (async () => {
    if (!source) {
      const res = await fetch(url);
      if (!res.ok)
        throw new Error(`${res.status} ${res.statusText} ${res.url}`);

      load.r = res.url;

      if (res.url.endsWith('.wasm')) {
        const module = wasmModules[url] = await (WebAssembly.compileStreaming ? WebAssembly.compileStreaming(res) : WebAssembly.compile(await res.arrayBuffer()));

        let deps = WebAssembly.Module.imports ? WebAssembly.Module.imports(module).map(impt => impt.module) : [];

        const aDeps = [];
        load.a = [aDeps, WebAssembly.Module.exports(module).map(expt => expt.name)];

        const depStrs = deps.map(dep => JSON.stringify(dep));

        let curIndex = 0;
        load.S = depStrs.map((depStr, idx) => {
            const index = idx.toString();
            const strStart = curIndex + 17 + index.length;
            const strEnd = strStart + depStr.length - 2;
            aDeps.push({
              s: strStart,
              e: strEnd,
              d: -1
            });
            curIndex += strEnd + 3;
            return `import*as m${index} from${depStr};`
          }).join('') +
          `const module=importShim.w[${JSON.stringify(url)}],exports=new WebAssembly.Instance(module,{` +
          depStrs.map((depStr, idx) => `${depStr}:m${idx},`).join('') +
          `}).exports;` +
          load.a[1].map(name => name === 'default' ? `export default exports.${name}` : `export const ${name}=exports.${name}`).join(';');

        return deps;
      }

      source = await res.text();
      if (res.url.endsWith('.json'))
        source = `export default JSON.parse(${JSON.stringify(source)})`;
      if (res.url.endsWith('.css'))
        source = `const s=new CSSStyleSheet();s.replaceSync(${JSON.stringify(source)});export default s`;
    }
    try {
      load.a = parse(source, load.u);
    }
    catch (e) {
      console.warn(e);
      console.warn(e.idx);
      load.a = [[], []];
    }
    load.S = source;
    return load.a[0].filter(d => d.d === -1).map(d => source.slice(d.s, d.e));
  })();

  load.L = load.f.then(async deps => {
    load.d = await Promise.all(deps.map(async depId => {
      const depLoad = getOrCreateLoad(await resolve(depId, load.r || load.u));
      await depLoad.f;
      return depLoad;
    }));
  });

  return load;
}

let importMapPromise;
if (typeof document !== 'undefined') {
  const scripts = document.getElementsByTagName('script');
  for (let i = 0; i < scripts.length; i++) {
    const script = scripts[i];
    if (script.type === 'importmap-shim' && !importMapPromise) {
      if (script.src) {
        importMapPromise = (async function () {
          importShim.map = parseImportMap(await (await fetch(script.src)).json(), script.src.slice(0, script.src.lastIndexOf('/') + 1));
        })();
      }
      else {
        importShim.map = parseImportMap(JSON.parse(script.innerHTML), pageBaseUrl);
      }
    }
    // this works here because there is a .then before resolve
    else if (script.type === 'module-shim') {
      if (script.src)
        topLevelLoad(script.src);
      else
        topLevelLoad(`${pageBaseUrl}?${id++}`, script.innerHTML);
    }
  }
}

async function resolve (id, parentUrl) {
  if (importMapPromise)
    return importMapPromise
    .then(function () {
      return resolveImportMap(id, parentUrl, importShim.map);
    });

  return resolveImportMap(id, parentUrl, importShim.map);
}

self.WorkerShim = WorkerShim;
