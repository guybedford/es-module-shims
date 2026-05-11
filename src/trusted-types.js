export let policy;
if (
  typeof self !== 'undefined' &&
  (typeof self.trustedTypes !== 'undefined' || typeof self.TrustedTypes !== 'undefined')
) {
  try {
    policy = (self.trustedTypes || self.TrustedTypes).createPolicy('es-module-shims', {
      createHTML: html => html,
      createScript: script => script
    });
  } catch {}
}

export function maybeTrustedInnerHTML(html) {
  return policy ? policy.createHTML(html) : html;
}

export function maybeTrustedScript(script) {
  return policy ? policy.createScript(script) : script;
}
