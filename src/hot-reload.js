class Hot {
  constructor (url) {
    this.data = getHotData(this.url = stripVersion(url)).d;
  }
  accept (deps, cb) {
    if (typeof deps === 'function') {
      cb = deps;
      deps = null;
    }
    const hotData = getHotData(this.url);
    (hotData.a = hotData.a || []).push([typeof deps === 'string' ? defaultResolve(deps, this.url) : deps ? deps.map(d => defaultResolve(d, this.url)) : null, cb]);
  }
  dispose (cb) {
    getHotData(this.url).u = cb;
  }
  decline () {
    getHotData(this.url).r = true;
  }
  invalidate () {
    invalidate(this.url);
    queueInvalidationInterval();
  }
}

const versionedRegEx = /\?v=\d+$/;
function stripVersion (url) {
  const versionMatch = url.match(versionedRegEx);
  if (!versionMatch) return url;
  return url.slice(0, -versionMatch[0].length);
}

const toVersioned = url => {
  const { v } = getHotData(url);
  return url + (v ? '?v=' + v : '');
}

let defaultResolve;

if (self.importShim)
  throw new Error('Hot reloading extension must be loaded before es-module-shims.js.');

const esmsInitOptions = self.esmsInitOptions = self.esmsInitOptions || {};
esmsInitOptions.hot = esmsInitOptions.hot || {};
Object.assign(esmsInitOptions, {
  polyfillEnable: true,
  resolve (id, parent, _defaultResolve) {
    if (!defaultResolve)
      defaultResolve = _defaultResolve;
    const originalParent = stripVersion(parent);
    const url = stripVersion(defaultResolve(id, originalParent));
    const parents = getHotData(url).p;
    if (!parents.includes(originalParent))
      parents.push(originalParent);
    return toVersioned(url);
  },
  onimport (url) {
    getHotData(url).e = true;
  },
  meta (metaObj, url) {
    metaObj.hot = new Hot(url);
  }
});

let hotRegistry = {};
let curInvalidationRoots = new Set();
let curInvalidationInterval;

const getHotData = url => hotRegistry[url] || (hotRegistry[url] = {
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

function invalidate (url, fromUrl, seen = []) {
  if (!seen.includes(url)) {
    seen.push(url);
    const hotData = hotRegistry[url];
    if (hotData) {
      if (hotData.r) {
        location.href = location.href;
      } else {
        if (hotData.a && hotData.a.some(([d]) => d && (typeof d === 'string' ? d === fromUrl : d.includes(fromUrl)))) {
          curInvalidationRoots.add(fromUrl);
        }
        else {
          if (hotData.u)
            hotData.u(hotData.d);
          if (hotData.e || hotData.a)
            curInvalidationRoots.add(url);
          hotData.v++;
          if (!hotData.a) {
            for (const parent of hotData.p)
              invalidate(parent, url, seen);
          }
        }
      }
    }
  }
}

function queueInvalidationInterval () {
  curInvalidationInterval = setTimeout(() => {
    const earlyRoots = new Set();
    for (const root of curInvalidationRoots) {
      const promise = importShim(toVersioned(root));
      const { a, p } = hotRegistry[root];
      promise.then(m => {
        if (a) a.every(([d, c]) => d === null && !earlyRoots.has(c) && c(m));
        for (const parent of p) {
          const hotData = hotRegistry[parent];
          if (hotData && hotData.a) hotData.a.every(async ([d, c]) => d && !earlyRoots.has(c) && (typeof d === 'string' ? d === root && c(m) : c(await Promise.all(d.map(d => (earlyRoots.push(c), importShim(toVersioned(d))))))));
        }
      });
    }
    curInvalidationRoots = new Set();
  }, 100);
}

const baseURI = document.baseURI;
const websocket = new WebSocket(`ws://${esmsInitOptions.hotHost || new URL(baseURI).host}/watch`);
websocket.onmessage = evt => {
  const { data } = evt;
  if (data === 'Connected') {
    console.info('Hot Reload ' + data);
  } else {
    invalidate(new URL(data, baseURI).href);
    queueInvalidationInterval();
  }
};
