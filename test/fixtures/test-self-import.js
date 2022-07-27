export const b = 5;

const c = 6;
export { c as d };

const e = 7;
export { e as 'e f' };

import {
  b as bb,
  d as dd,
  'e f' as ef,
} from './test-self-import.js';

export default [bb, dd, ef];
