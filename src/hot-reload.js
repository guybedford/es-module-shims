import { self } from './self.js';
import {
  baseUrl,
  defaultFetchOpts,
  hotReloadInterval,
  importHook,
  metaHook,
  chain,
  resolveHook,
  throwError,
  setHooks
} from './env.js';

let invalidate;
export const hotReload = url => invalidate(new URL(url, baseUrl).href);
export const initHotReload = (topLevelLoad, importShim) => {
  let _importHook = importHook,
    _resolveHook = resolveHook,
    _metaHook = metaHook;

  let defaultResolve;
  let hotResolveHook = (id, parent, _defaultResolve) => {
    if (!defaultResolve) defaultResolve = _defaultResolve;
    const originalParent = stripVersion(parent);
    const url = stripVersion(defaultResolve(id, originalParent));
    const hotState = getHotState(url);
    const parents = hotState.p;
    if (!parents.includes(originalParent)) parents.push(originalParent);
    return toVersioned(url, hotState);
  };
  const hotImportHook = (url, _, __, source, sourceType) => {
    const hotState = getHotState(url);
    hotState.e = typeof source === 'string' ? source : true;
    hotState.t = sourceType;
  };
  const hotMetaHook = (metaObj, url) => (metaObj.hot = new Hot(url));

  const Hot = class Hot {
    constructor(url) {
      this.data = getHotState((this.url = stripVersion(url))).d;
    }
    accept(deps, cb) {
      if (typeof deps === 'function') {
        cb = deps;
        deps = null;
      }
      const hotState = getHotState(this.url);
      if (!hotState.A) return;
      (hotState.a = hotState.a || []).push([
        typeof deps === 'string' ? defaultResolve(deps, this.url)
        : deps ? deps.map(d => defaultResolve(d, this.url))
        : null,
        cb
      ]);
    }
    dispose(cb) {
      getHotState(this.url).u = cb;
    }
    invalidate() {
      const hotState = getHotState(this.url);
      hotState.a = hotState.A = null;
      const seen = [this.url];
      hotState.p.forEach(p => invalidate(p, this.url, seen));
    }
  };

  const versionedRegEx = /\?v=\d+$/;
  const stripVersion = url => {
    const versionMatch = url.match(versionedRegEx);
    return versionMatch ? url.slice(0, -versionMatch[0].length) : url;
  };

  const toVersioned = (url, hotState) => {
    const { v } = hotState;
    return url + (v ? '?v=' + v : '');
  };

  let hotRegistry = {},
    curInvalidationRoots = new Set(),
    curInvalidationInterval;
  const getHotState = url =>
    hotRegistry[url] ||
    (hotRegistry[url] = {
      // version
      v: 0,
      // accept list ([deps, cb] pairs)
      a: null,
      // accepting acceptors
      A: true,
      // unload callback
      u: null,
      // entry point or inline script source
      e: false,
      // hot data
      d: {},
      // parents
      p: [],
      // source type
      t: undefined
    });

  invalidate = (url, fromUrl, seen = []) => {
    const hotState = hotRegistry[url];
    if (!hotState || seen.includes(url)) return false;
    seen.push(url);
    if (self.ESMS_DEBUG) console.info(`es-module-shims: hot reload ${url}`);
    hotState.A = false;
    if (
      fromUrl &&
      hotState.a &&
      hotState.a.some(([d]) => d && (typeof d === 'string' ? d === fromUrl : d.includes(fromUrl)))
    ) {
      curInvalidationRoots.add(fromUrl);
    } else {
      if (hotState.e || hotState.a) curInvalidationRoots.add(url);
      hotState.v++;
      if (!hotState.a) hotState.p.forEach(p => invalidate(p, url, seen));
    }
    if (!curInvalidationInterval) curInvalidationInterval = setTimeout(handleInvalidations, hotReloadInterval);
    return true;
  };

  const handleInvalidations = () => {
    curInvalidationInterval = null;
    const earlyRoots = new Set();
    for (const root of curInvalidationRoots) {
      const hotState = hotRegistry[root];
      topLevelLoad(
        toVersioned(root, hotState),
        baseUrl,
        defaultFetchOpts,
        typeof hotState.e === 'string' ? hotState.e : undefined,
        false,
        undefined,
        hotState.t
      ).then(m => {
        if (hotState.a) {
          hotState.a.forEach(([d, c]) => d === null && !earlyRoots.has(c) && c(m));
          // unload should be the latest unload handler from the just loaded module
          if (hotState.u) {
            hotState.u(hotState.d);
            hotState.u = null;
          }
        }
        hotState.p.forEach(p => {
          const hotState = hotRegistry[p];
          if (hotState && hotState.a)
            hotState.a.forEach(
              async ([d, c]) =>
                d &&
                !earlyRoots.has(c) &&
                (typeof d === 'string' ?
                  d === root && c(m)
                : c(await Promise.all(d.map(d => (earlyRoots.push(c), importShim(toVersioned(d, getHotState(d))))))))
            );
        });
      }, throwError);
    }
    curInvalidationRoots = new Set();
  };

  setHooks(
    _importHook ? chain(_importHook, hotImportHook) : hotImportHook,
    _resolveHook ?
      (id, parent, defaultResolve) =>
        hotResolveHook(id, parent, (id, parent) => _resolveHook(id, parent, defaultResolve))
    : hotResolveHook,
    _metaHook ? chain(_metaHook, hotMetaHook) : hotMetaHook
  );
};
