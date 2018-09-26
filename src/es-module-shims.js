import { resolveIfNotPlainOrUrl, baseUrl as pageBaseUrl, createPackageMap } from './common.js';
import { analyzeModuleSyntax } from './lexer.js';

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
          if (importShim.e)
            return reject(importShim.e);
          resolve(importShim.l);
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
  const load = getOrCreateLoad(url, source);
  await loadAll(load, {});
  resolveDeps(load, {});
  const module = await dynamicImport(load.b);
  // if the top-level load is a shell, run its update function
  if (load.s)
    (await dynamicImport(load.s)).u$_(module);
  return module;
}

async function importShim (id) {
  const parentUrl = arguments.length === 1 ? pageBaseUrl : (id = arguments[1], id);
  return topLevelLoad(await resolve(id, parentUrl));
}

self.importShim = importShim;

const meta = {};
const wasmModules = {};

Object.defineProperties(importShim, {
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
            let hasDefault = false;
            blobUrl = depLoad.s = createBlob(`export function u$_(m){${
                depLoad.a[1].map(
                  name => name === 'default' ? `$_default=m.default` : `${name}=m.${name}`
                ).join(',')
              }}${
                depLoad.a[1].map(name => 
                  name === 'default' ? (hasDefault = true, `let $_default;export{$_default as default}`) : `export let ${name}`
                ).join(';')
              }`);
          }
        }
        // circular shell execution
        else if (depLoad.s) {
          resolvedSource += source.slice(lastIndex, start) + blobUrl + source[end] + `;import*as m$_${depIndex} from'${depLoad.b}';import{u$_ as u$_${depIndex}}from'${depLoad.s}';u$_${depIndex}(m$_${depIndex})`;
          lastIndex = end + 1;
          depLoad.s = undefined;
          continue;
        }
        resolvedSource += source.slice(lastIndex, start) + blobUrl;
        lastIndex = end;
      }
      // import.meta
      else if (dynamicImportIndex === -2) {
        meta[load.u] = { url: load.u };
        resolvedSource += source.slice(lastIndex, start) + 'importShim.m[' + JSON.stringify(load.u) + ']';
        lastIndex = end;
      }
      // dynamic import
      else {
        resolvedSource += source.slice(lastIndex, start) + 'importShim' + source.slice(end, dynamicImportIndex) + JSON.stringify(load.u) + ', ';
        lastIndex = dynamicImportIndex;
      }
    }
    resolvedSource += source.slice(lastIndex);
  }

  load.b = createBlob(resolvedSource + '\n//# sourceURL=' + load.u);
  load.S = undefined;
}
const createBlob = source => URL.createObjectURL(new Blob([source], { type: 'application/javascript' }));

function getOrCreateLoad (url, source) {
  let load = registry[url];
  if (load)
    return load;

  load = registry[url] = {
    // url
    u: url,
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

      if (res.url.endsWith('.wasm')) {
        const module = wasmModules[url] = await WebAssembly.compileStreaming(res);
    
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
    }
    load.a = analyzeModuleSyntax(source);
    if (load.a[2])
      importShim.err = [source, load.a[2]];
    load.S = source;
    return load.a[0].filter(d => d.d === -1).map(d => source.slice(d.s, d.e));
  })();

  load.L = load.f.then(async deps => {
    load.d = await Promise.all(deps.map(async depId => {
      const load = getOrCreateLoad(await resolve(depId, url));
      await load.f;
      return load;
    }));
  });

  return load;
}

let packageMapPromise, packageMapResolve;
if (typeof document !== 'undefined') {
  const scripts = document.getElementsByTagName('script');
  for (let i = 0; i < scripts.length; i++) {
    const script = scripts[i];
    if (script.type === 'packagemap-shim' && !packageMapPromise) {
      if (script.src) {
        packageMapPromise = (async function () {
          packageMapResolve = createPackageMap(await (await fetch(script.src)).json(), script.src.slice(0, script.src.lastIndexOf('/') + 1));
          packageMapPromise = undefined;
        })();
      }
      else {
        packageMapPromise = Promise.resolve();
        packageMapResolve = createPackageMap(JSON.parse(script.innerHTML), pageBaseUrl);
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

if (!packageMapPromise)
  packageMapResolve = throwBare;

function throwBare (id, parentUrl) {
  throw new Error('Unable to resolve bare specifier "' + id + (parentUrl ? '" from ' + parentUrl : '"'));
}

async function resolve (id, parentUrl) {
  parentUrl = parentUrl || pageBaseUrl;

  const resolvedIfNotPlainOrUrl = resolveIfNotPlainOrUrl(id, parentUrl);
  if (resolvedIfNotPlainOrUrl)
    return resolvedIfNotPlainOrUrl;
  if (id.indexOf(':') !== -1)
    return id;

  // now just left with plain
  // (if not package map, packageMapResolve just throws)
  if (packageMapPromise)
    await packageMapPromise;
  
  return packageMapResolve(id, parentUrl);
}