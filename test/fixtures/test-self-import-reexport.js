export const b = 5;
export { f } from './test-circular1.js';

import { b as bb } from './test-self-import-reexport.js';

export default bb;
