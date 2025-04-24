import { hotReloadInterval, importHook, resolveHook, metaHook, baseUrl } from './env.js';

export const initHotReload = () => {
  let _importHook = importHook,
    _resolveHook = resolveHook,
    _metaHook = metaHook;

  let defaultResolve;
  let hotResolveHook = (id, parent, _defaultResolve) => {
    if (!defaultResolve) defaultResolve = _defaultResolve;
    const originalParent = stripVersion(parent);
    const url = stripVersion(defaultResolve(id, originalParent));
    const parents = getHotData(url).p;
    if (!parents.includes(originalParent)) parents.push(originalParent);
    return toVersioned(url);
  };
  const hotImportHook = url => {
    getHotData(url).e = true;
  };
  const hotMetaHook = (metaObj, url) => {
    metaObj.hot = new Hot(url);
  };

  const Hot = class Hot {
    constructor(url) {
      this.data = getHotData((this.url = stripVersion(url))).d;
    }
    accept(deps, cb) {
      if (typeof deps === 'function') {
        cb = deps;
        deps = null;
      }
      const hotData = getHotData(this.url);
      (hotData.a = hotData.a || []).push([
        typeof deps === 'string' ? defaultResolve(deps, this.url)
        : deps ? deps.map(d => defaultResolve(d, this.url))
        : null,
        cb
      ]);
    }
    dispose(cb) {
      getHotData(this.url).u = cb;
    }
    decline() {
      getHotData(this.url).r = true;
    }
    invalidate() {
      invalidate(this.url);
      queueInvalidationInterval();
    }
  };

  const versionedRegEx = /\?v=\d+$/;
  const stripVersion = url => {
    const versionMatch = url.match(versionedRegEx);
    if (!versionMatch) return url;
    return url.slice(0, -versionMatch[0].length);
  };

  const toVersioned = url => {
    const { v } = getHotData(url);
    return url + (v ? '?v=' + v : '');
  };

  let hotRegistry = {};
  let curInvalidationRoots = new Set();
  let curInvalidationInterval;

  const getHotData = url =>
    hotRegistry[url] ||
    (hotRegistry[url] = {
      // version
      v: 0,
      // refresh (decline)
      r: false,
      // accept list ([deps, cb] pairs)
      a: null,
      // unload callback
      u: null,
      // entry point
      e: false,
      // hot data
      d: {},
      // parents
      p: []
    });

  const invalidate = (url, fromUrl, seen = []) => {
    if (!seen.includes(url)) {
      seen.push(url);
      const hotData = hotRegistry[url];
      if (hotData) {
        if (hotData.r) {
          location.href = location.href;
        } else {
          if (
            hotData.a &&
            hotData.a.some(([d]) => d && (typeof d === 'string' ? d === fromUrl : d.includes(fromUrl)))
          ) {
            curInvalidationRoots.add(fromUrl);
          } else {
            if (hotData.u) hotData.u(hotData.d);
            if (hotData.e || hotData.a) curInvalidationRoots.add(url);
            hotData.v++;
            if (!hotData.a) {
              for (const parent of hotData.p) invalidate(parent, url, seen);
            }
          }
        }
      }
    }
  };

  const queueInvalidationInterval = () => {
    curInvalidationInterval = setTimeout(() => {
      const earlyRoots = new Set();
      for (const root of curInvalidationRoots) {
        const promise = importShim(toVersioned(root));
        const { a, p } = hotRegistry[root];
        promise.then(m => {
          if (a) a.every(([d, c]) => d === null && !earlyRoots.has(c) && c(m));
          for (const parent of p) {
            const hotData = hotRegistry[parent];
            if (hotData && hotData.a)
              hotData.a.every(
                async ([d, c]) =>
                  d &&
                  !earlyRoots.has(c) &&
                  (typeof d === 'string' ?
                    d === root && c(m)
                  : c(await Promise.all(d.map(d => (earlyRoots.push(c), importShim(toVersioned(d)))))))
              );
          }
        });
      }
      curInvalidationRoots = new Set();
    }, hotReloadInterval);
  };

  importShim.hotReload = (url) => {
    invalidate(new URL(url, baseUrl).href);
    queueInvalidationInterval();
  };

  return [
    _importHook ?
      (url, opts, parentUrl) => {
        _importHook(url, opts, parentUrl);
        hotImportHook(url);
      }
    : hotImportHook,
    _resolveHook ?
      (id, parent, defaultResolve) =>
        hotResolveHook(id, parent, (id, parent) => _resolveHook(id, parent, defaultResolve))
    : hotResolveHook,
    _metaHook ?
      (metaObj, url) => {
        _metaHook(metaObj, url);
        hotMetaHook(metaObj, url);
      }
    : hotMetaHook
  ];
};
