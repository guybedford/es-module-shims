import type { P } from './test.ts';
import { p } from 'dep';

export function fn (): P {
  return p;
};
