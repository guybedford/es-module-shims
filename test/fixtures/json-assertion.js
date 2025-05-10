import json from './json.json' with { type: 'json' };

// Firefox crash avoidance :(
let foo = json;

export { foo as m }
