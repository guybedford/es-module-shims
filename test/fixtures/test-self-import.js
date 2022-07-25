export const b = 5;

const c = 6;
export { c as d };

import { b as bb, d as dd } from './test-self-import.js';

export default [bb, dd];
