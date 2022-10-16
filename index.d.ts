interface ESMSInitOptions {
  /**
   * Enable Shim Mode
   */
  shimMode?: boolean;

  /**
   * Enable polyfill features.
   * Currently supports ['css-modules', 'json-modules']
   */
  polyfillEnable?: string[];

  /**
   * #### Enforce Integrity
   *
   * Set to *true* to enable secure mode to not support loading modules without integrity (integrity is always verified though).
   *
   */
  enforceIntegrity: boolean;

  /**
   * Nonce for CSP build
   */
  nonce?: boolean;

  /**
   * Disable retriggering of document readystate
   */
  noLoadEventRetriggers: true;

  /**
   * #### Skip Processing Stability
   *
   * > Non-spec feature
   *
   * When loading modules that you know will only use baseline modules
   * features, it is possible to set a rule to explicitly opt-out modules
   * from rewriting. This improves performance because those modules then do
   * not need to be processed or transformed at all, so that only local
   * application code is handled and not library code.
   *
   * This can be configured by setting the importShim.skip URL regular
   * expression:
   *
   * ```js
   * importShim.skip = /^https:\/\/cdn\.com/;
   * ```
   *
   * By default, this expression supports jspm.dev, dev.jspm.io and
   * cdn.pika.dev.
   */
  skip: RegExp;

  /**
   * #### Error hook
   *
   * Register a callback for any ES Module Shims module errors.
   *
   */
  onerror: (e: any) => any;

  /**
   * #### Polyfill hook
   *
   * Register a callback invoked when polyfill mode first engages.
   *
   */
  onpolyfill: () => void;

  /**
   * #### Resolve Hook
   *
   * Only supported in Shim Mode.
   *
   * Provide a custom resolver function.
   */
  resolve: (
    id: string,
    parentUrl: string,
    resolve: (id: string, parentUrl: string) => string
  ) => string | Promise<string>;

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
   */
  fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;

  /**
   * #### Revoke Blob URLs
   *
   * Set to *true* to cleanup blob URLs from memory after execution.
   * Can cost some compute time for large loads.
   *
   */
  revokeBlobURLs: boolean;

  /**
   * #### Map Overrides
   *
   * Set to *true* to permit overrides to import maps.
   *
   */
  mapOverrides: boolean;

  /**
  * #### Meta hook
  *
  * Register a callback for import.meta construction.
  *
  */
  meta: (meta: any, url: string) => void;

  /**
   * #### On import hook
   *
   * Register a callback for top-level imports.
   *
   */
  onimport: (url: string, options: any, parentUrl: string) => void;
}

interface ImportMap {
  imports: Record<string, string>;
  scopes: Record<string, Record<string, string>>;
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
}

interface Window {
  esmsInitOptions?: ESMSInitOptions;
  importShim: typeof importShim;
}
