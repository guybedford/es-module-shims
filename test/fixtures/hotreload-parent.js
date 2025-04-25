import { p } from './hotreload.js';

window.hotReloadParentCnt = window.hotReloadParentCnt || 0;
window.hotReloadParentCnt++;

export function getP () {
  return p;
}
