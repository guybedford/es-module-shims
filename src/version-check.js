import { esmsInitOptions, version } from './env.js';

const r = esmsInitOptions.version;
if (self.importShim || (r && r !== version)) {
  if (self.ESMS_DEBUG)
    console.info(
      `es-module-shims: skipping initialization as ${r ? `configured for ${r}` : 'another instance has already registered'}`
    );
  $ret();
}
