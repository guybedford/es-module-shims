export const b = {
  m: () => 5
};

import { b as c } from './test-self-import.js';

const m = c.m;

export default function a() {
  return m();
}
