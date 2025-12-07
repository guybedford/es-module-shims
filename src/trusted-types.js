const policyOptions = {
    createHTML: html => html,
    createScript: script => script,
};
const { policy, policyEnabled } = createPolicy();

function createPolicy() {
    if (typeof trustedTypes !== "undefined") {
        try {
          return { policy: trustedTypes.createPolicy("esmoduleshims", policyOptions), policyEnabled: true};
        } catch {

        }
    }
  return { policy: policyOptions, policyEnabled: false };
}

export const trustedTypesPolicyEnabled = policyEnabled;

export function trustedInnerHTML(html) {
    return policy.createHTML(html);
}

export function trustedScript(script) {
    return policy.createScript(script);
}
