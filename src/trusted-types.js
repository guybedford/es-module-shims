export let policy;
if (typeof trustedTypes !== 'undefined') {
  try {
    policy = trustedTypes.createPolicy('es-module-shims', {
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
