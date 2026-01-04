export let policy;
if (typeof window.trustedTypes !== 'undefined' || typeof window.TrustedTypes !== 'undefined') {
  try {
    policy = (window.trustedTypes || window.TrustedTypes).createPolicy('es-module-shims', {
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
