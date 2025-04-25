import * as d from './hotreload.js';

window.depUpdated = false;
window.hotReloadAcceptDepCnt = window.hotReloadAcceptDepCnt || 0;
window.hotReloadAcceptDepCnt++;

if (import.meta.hot) {
  import.meta.hot.accept('./hotreload.js', () => {
    console.log("ACCEPT DEP");
    window.depUpdated = true;
  });
}
