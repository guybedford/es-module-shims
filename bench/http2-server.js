import { createSecureServer } from 'http2';
import { readFileSync } from 'fs';
import { lookup } from 'mime-types';
import { brotliCompressSync, constants } from 'zlib';
import { ThrottleGroup } from 'speed-limiter';

const base = new URL('../', import.meta.url);

const server = createSecureServer({
  key: readFileSync(new URL('./key.pem', import.meta.url)),
  cert: readFileSync(new URL('./cert.pem', import.meta.url))
});

server.on('error', err => console.error(err));

const staticFileCache = Object.create(null);

const cacheControl = process.env.CACHE ? 'public, max-age=3600' : 'no-cache';

const port = process.env.PORT || 8000;
const throttleGroup = process.env.BANDWIDTH ? new ThrottleGroup({ rate: Number(process.env.BANDWIDTH) * 1000 }) : null;
const latencyLimit = process.env.LATENCY && Number(process.env.LATENCY) || 0;
const brotli = Number(process.env.BROTLI) || 0;

const POOL_MAX = 16;
let streamCnt = 0;
const poolQueue = [];

function streamEnd () {
  streamCnt--;
  if (streamCnt === 0) {
    while (streamCnt < POOL_MAX && poolQueue.length) {
      const { stream, entry } = poolQueue.shift();
      stream.respond({ ':status': 200, 'content-type': entry.contentType, 'content-length': entry.length, 'cache-control': cacheControl, 'Access-Control-Allow-Origin': '*', ...brotli ?  { 'content-encoding': 'br' } : {} });
      if (throttleGroup) {
        const throttle = throttleGroup.throttle();
        throttle.pipe(stream);
        throttle.end(entry.source);
      }
      else {
        stream.end(entry.source);
      }
      streamCnt++;
    }
  }
}

server.on('stream', async (stream, headers) => {
  if (headers[':method'] !== 'GET')
    throw new Error('Expected GET');

  let path = headers[':path'].slice(1);
  const queryStringIndex = path.indexOf('?');
  if (queryStringIndex !== -1)
    path = path.slice(0, queryStringIndex);

  let entry = staticFileCache[path];
  if (!entry) {
    try {
      var source = readFileSync(new URL(path, base));
    }
    catch (e) {
      stream.respond({ ':status': 404, 'content-type': 'text/plain; charset=utf-8' });
      stream.end('Not found');
      return;
    }
    entry = {
      contentType: lookup(path),
      source: brotli ? brotliCompressSync(source, {
        [constants.BROTLI_PARAM_QUALITY]: brotli,
      }) : source,
      length: null
    };
    entry.length = entry.source.byteLength;
    if (!path.endsWith('.html'))
      staticFileCache[path] = entry;
  }

  if (latencyLimit)
    await new Promise(resolve => setTimeout(resolve, latencyLimit));

  stream.on('close', streamEnd);
  if (streamCnt !== POOL_MAX) {
    stream.respond({ ':status': 200, 'content-type': entry.contentType, 'content-length': entry.length, 'cache-control': cacheControl, 'Access-Control-Allow-Origin': '*', ...brotli ?  { 'content-encoding': 'br' } : {} });
    streamCnt++;
    if (throttleGroup) {
      const throttle = throttleGroup.throttle();
      throttle.pipe(stream);
      throttle.end(entry.source);
    }
    else {
      stream.end(entry.source);
    }
  }
  else {
    poolQueue.push({ stream, entry });
  }
});

console.log('Listening on ' + port);
server.listen(port);
