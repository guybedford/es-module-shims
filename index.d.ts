interface ESMSInitOptions {
  /**
   * Enable Shim Mode, where only
   *   <script type="module-shim"></script>
   * and
   *   <script type="importmap-shim"></script>
   * are supported and the native loader is not used directly (no {@link nativePassthrough}).
   */
  shimMode?: boolean;

  /**
   * Enable hot reloading
   */
  hotReload?: boolean;

  /**
   * Set the hot reload refresh interval in ms
   */
  hotReloadInterval?: number;

  /**
   * Enable polyfill features.
   *
   * Currently supports:
   * - 'wasm-modules': Both 'wasm-module-sources' and 'wasm-module-instances'
   * - 'wasm-module-sources': Support for Wasm source phase imports (import source mod from './mod.wasm')
   * - 'wasm-module-instances': Support for Wasm instance phase imports (import * as mod from './mod.wasm')
   * - 'import-defer': Support for import defer syntax (import defer * as ns from './foo.js')
   */
  polyfillEnable?: Array<'wasm-modules' | 'wasm-module-instances' | 'wasm-module-sources' | 'import-defer' | 'all'>;

  /**
   * Disable polyfill features:
   * - 'css-modules': CSS Module imports of the form `import styles from './source.css' with { type: 'css' }`
   * - 'json-modules': JSON Module imports of the form `import styles from './source.css' with { type: 'css' }`
   *
   * These features are enabled by default but only supported in Chrome 123+, so that disabling these features
   * allows ES Module Shims to avoid unnecessary feature detections and module analysis,
   * so this will ensure {@link nativePassthrough} for Chrome 89+, Firefox 108+, Safari 16.4+
   */
  polyfillDisable?: Array<'css-modules' | 'json-modules'>;

  /**
   * @default true
   *
   * By default, native passthrough is enabled so that modules will be entirely loaded through the native loader
   * when it is known to be safe to do so. This happens when:
   *
   * 1. Polyfill mode is enabled (which is by default, unless shim mode is explicitly enabled)
   * 2. No hot reloading or hooks options are in use
   * 3. Then either of:
   *   a) The browser supports the minimum baseline features expected by ES Module Shims
   *      (either by default, or as customized via polyfillEnable / polyfillDisable)
   *   b) Or if the browser does not support the minimum baseline features, ES Module Shims
   *      will analyze the entire subgraph of modules and still use passthrough after that analysis
   *      if every module down the graph is known to be natively supported without causing a static error on load.
   *
   * Setting this option to false can avoid some potential double fetching on the polyfill path when modules are
   * analyzed for support, since the native loader cache is not always shared with the fetch cache in some browser.
   *
   * In addition dynamic import() not being polyfilled can also be worked around by using this option since it will
   * replace all dynamic import() expressions with an importShim() expression by using the polyfill loader instead
   * of the native loader.
   *
   * This option is therefore serving two purposes - firstly to easily disable internally in the case of hot reloading
   * and hooks, and secondly to allow this kind customization in the case of dynamic import or performance cases.
   */
  nativePassthrough?: boolean;

  /**
   * #### Version
   *
   * Useful when there are multiple instances of ES Module Shims for whatever reason
   * interacting in an application.
   *
   * When set, ES Module Shims will early exit if its own version is not the expected version.
   * Note that this feature is only supported from version 2.4.0 upwards.
   */
  version?: string;

  /**
   * #### Enforce Integrity
   *
   * Set to *true* to enable secure mode to not support loading modules without integrity (integrity is always verified though).
   *
   */
  enforceIntegrity?: boolean;

  /**
   * Nonce for CSP compatibility
   * 
   * When set, feature detection scripts that run in a separate feature detection
   * iframe will use this nonce to ensure CSP compatibility.
   */
  nonce?: boolean;

  /**
   * Disable retriggering of document readystate, DOMContentLoaded and the window load event.
   * 
   * ES Module Shims will re-trigger these events because normally <script type="module"></script>
   * runs under static defer semantics and results in delaying these events until it completes.
   * 
   * When modules are polyfilled, the top-level load will first complete and the events will trigger
   * before the modules have run, which may result in missing attachments.
   * 
   * By retriggering these events we ensure later attachment.
   * 
   * The consequence of this approach is that it does assume that attachments are idempotent, and in
   * where that is not the case this can result in duplicate DOM injections or attachments.
   * 
   * This option can therefore be used to disable this feature when those problems arise.
   */
  noLoadEventRetriggers?: boolean;

  /**
   *
   * When loading modules that you know will only use baseline modules
   * features, it is possible to set a rule to explicitly opt-out modules
   * from any analysis and rewriting, effectively forcing {@link nativePassthrough}
   * only for these modules and their dependencies. This improves performance because
   * those modules then do not need to be processed or transformed at all, so that
   * e.g. only local application code is handled and not library code.
   *
   * This can be configured by setting the importShim.skip URL regular
   * expression:
   *
   * ```js
   * importShim.skip = /^https:\/\/cdn\.com/;
   * ```
   *
   */
  skip?: RegExp | string[] | string;

  /**
   * #### Error hook
   *
   * Register a callback for any ES Module Shims module errors.
   *
   */
  onerror?: (e: any) => any;

  /**
   * #### Polyfill hook
   *
   * Register a callback invoked when polyfill mode first engages.
   *
   */
  onpolyfill?: () => void;

  /**
   * #### Resolve Hook
   *
   * Only supported in Shim Mode.
   *
   * Provide a custom resolver function.
   */
  resolve?: (id: string, parentUrl: string, parentResolve: (id: string, parentUrl: string) => string) => string;

  /**
   * #### Fetch Hook
   *
   * Only supported in Shim Mode.
   *
   * > Stability: Non-spec feature
   *
   * This is provided as a convenience feature since the pipeline handles
   * the same data URL rewriting and circular handling of the module graph
   * that applies when trying to implement any module transform system.
   *
   * The ES Module Shims fetch hook can be used to implement transform
   * plugins.
   *
   * For example:
   *
   * ```js
   * importShim.fetch = async function (url) {
   *   const response = await fetch(url);
   *   if (response.url.endsWith('.ts')) {
   *     const source = await response.body();
   *     const transformed = tsCompile(source);
   *     return new Response(new Blob([transformed], { type: 'application/javascript' }));
   *   }
   *   return response;
   * };
   * ```
   *
   * Because the dependency analysis applies by ES Module Shims takes care
   * of ensuring all dependencies run through the same fetch hook, the above
   * is all that is needed to implement custom plugins.
   *
   * Streaming support is also provided, for example here is a hook with
   * streaming support for JSON:
   *
   * ```js
   * importShim.fetch = async function (url) {
   *   const response = await fetch(url);
   *   if (!response.ok)
   *     throw new Error(`${response.status} ${response.statusText} ${response.url}`);
   *   const contentType = response.headers.get('content-type');
   *   if (!/^application\/json($|;)/.test(contentType))
   *     return response;
   *   const reader = response.body.getReader();
   *   return new Response(new ReadableStream({
   *     async start (controller) {
   *       let done, value;
   *       controller.enqueue(new Uint8Array([...'export default '].map(c => c.charCodeAt(0))));
   *       while (({ done, value } = await reader.read()) && !done) {
   *         controller.enqueue(value);
   *       }
   *       controller.close();
   *     }
   *   }), {
   *     status: 200,
   *     headers: {
   *       "Content-Type": "application/javascript"
   *     }
   *   });
   * }
   * ```
   *
   * @deprecated use the {@link source} hook instead.
   */
  fetch?: (input: RequestInfo, init?: RequestInit) => Promise<Response>;

  /**
   * #### Source Hook
   *
   * Source hook used to obtain the module source for a given URL.
   * Can be used to implement virtual modules.
   *
   * Note that only valid fetch scheme URLs are supported - http(s): / data: / blob: / file:
   *
   * https: or file: is therefore recommended for virtual module paths.
   *
   * @example
   * ```
   * <script>
   * const virtualFs = {
   *   'index.js': `import './src/dep.js';`,
   *   'src/dep.js': 'console.log("virtual source execution!")'
   * };
   * esmsInitOptions = {
   *   source (url, fetchOpts, parent, defaultSourceHook) {
   *     // Only virtualize sources under the URL file:///virtual-pkg/ (i.e. via
   *     // `import('file:///virtual-pkg/index.js)`.
   *     if (!url.startsWith('file:///virtual-pkg/')) return defaultSourceHook(url, fetchOpts, parent);
   *
   *     // Strip the query string prefix for hot reloading workflow support
   *     const versionQueryParam = url.match(/\?v=\d+$/);
   *     if (versionQueryParam) url = url.slice(0, -versionQueryParam[0].length);
   *
   *     // Lookup the virtual source from the virtual filesystem and return if found
   *     const virtualSource = virtualFs[url.slice('file:///virtual-pkg/'.length)];
   *     if (!virtualSource) throw new Error(`Virtual module ${url} not found, imported from ${parent}`);
   *     return {
   *       type: 'js',
   *       source: virtualSource
   *     };
   *   }
   * };
   * </script>
   * ```
   *
   * For support in hot reloading workflows, note that the ?v={Number} version query
   * string suffix will be passed so needs to be checked and removed if applicable.
   *
   * For JS, CSS, JSON and TypeScript, it provides the source text string.
   * For WebAssembly, it provides the compiled WebAssembly.Module record.
   *
   * The default implementation uses globalThis.fetch to obtain the response and then
   * the 'content-type' MIME type header to infer the module type, per HTML semantics.
   *
   * URL may be returned differently from the request URL because responseURL
   * is allowed to be distinct from requestURL in the module system even thoough
   * requestURL is used as the registry key only.
   *
   * @param url The URL of the module source being requested
   * @param fetchOpts Any custom fetch options (including integrity)
   * @param parent The parent importer URL for debug messages
   * @param defaultSourceHook The default source hook, to be used as the fallback
   */
  source?: (
    url: string,
    fetchOpts: RequestInit,
    parent: string,
    defaultSourceHook: (
      url,
      fetchOptions,
      parent
    ) => Promise<{
      url: string;
      type: 'js' | 'wasm' | 'css' | 'json' | 'ts';
      source: string | WebAssembly.Module;
    }>
  ) => Promise<{
    url?: string | undefined;
    type: 'js' | 'wasm' | 'css' | 'json' | 'ts';
    source: string | WebAssembly.Module;
  }>;

  /**
   * #### Revoke Blob URLs
   *
   * Set to *true* to cleanup blob URLs from memory after execution.
   * Can cost some compute time for large loads.
   *
   * @deprecated this option is now on by default and will be removed in a future version.
   */
  revokeBlobURLs?: boolean;

  /**
   * #### Map Overrides
   *
   * Set to *true* to permit overrides to import maps.
   *
   */
  mapOverrides?: boolean;

  /**
   * #### Meta hook
   *
   * Register a callback for import.meta construction.
   *
   * @param meta The import.meta object to mutate
   * @param url The URL of the module
   */
  meta?: (meta: any, url: string) => void;

  /**
   * #### On import hook
   *
   * Register a callback for top-level imports.
   *
   * @param url The top-level module being imported
   * @param fetchOptions the {@link RequestInit} fetch options to used, to also be used for dependencies as well
   */
  onimport?: (url: string, fetchOptions: RequestInit, parentUrl: string) => void;
}

interface ImportMap {
  imports: Record<string, string>;
  scopes: Record<string, Record<string, string>>;
  integrity: Record<string, string>;
}

/**
 * Dynamic import(...) within any modules loaded will be rewritten as
 * importShim(...) automatically providing full support for all es-module-shims
 * features through dynamic import.
 *
 * To load code dynamically (say from the browser console), importShim can be
 * called similarly:
 *
 * ```js
 * importShim('/path/to/module.js').then(x => console.log(x));
 * ```
 */
declare function importShim<Default, Exports extends object>(
  specifier: string,
  parentUrl?: string
): Promise<{ default: Default } & Exports>;

declare namespace importShim {
  const resolve: (id: string, parentURL?: string) => string;
  const addImportMap: (importMap: Partial<ImportMap>) => void;
  const getImportMap: () => ImportMap;
  const hotReload: ((url: string) => boolean) | undefined;
  const version: string;
}

interface Window {
  esmsInitOptions?: ESMSInitOptions;
  importShim: typeof importShim;
}
