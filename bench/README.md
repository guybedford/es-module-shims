# Benchmark Summary

This benchmark suite provides comprehensive performance comparisons of ES Module Shims versus native modules across browsers.

### Summary

* [ES Module Shims Chrome Passthrough](#chrome-passthrough-performance) results in ~5ms extra initialization time over native for ES Module Shims fetching, execution and initialization, and on a slow connection the additional non-blocking bandwidth cost of its 10.5KB download as expected.
* [ES Module Shims Polyfilling](#native-v-polyfill-performance) is on average 1.4x - 1.5x slower than native module loading, and up to 1.8x slower on slow networks (most likely due to the browser preloader), both for cached and uncached loads, and this result scales linearly.
* [Very large import maps](#large-import-maps-performance) (100s of entries) cost only a few extra milliseconds upfront for the additional loading cost.

## Benchmark

### Test Case

The test being benchmarked is **loading and executing** n versions of Preact plus a hello world component, where each n corresponds to a unique instance of Preact. This way real work is being benchmarked and not just some hypothetical n module load test but actual non-trivial execution is also associated with each module load to more closely resemble a real world scenario.

The base test varies these loads from 10 to 100 modules (separate Preact + hello world component for each n being rendered). n=10 corrsponds to 100KB of code being loaded and executed (10 unique instances of the 10KB Preact with the small component being rendered), and n=100 corresponds to 1MB of 100 module component / Preact pairs loading and executing in parallel. In addition a 1000 module load case (10MB) is also included for stress testing.

Each test includes the full network cost of loading the initial HTML by wrapping the top-level runner to call the network server for the actual test start. This way all benchmarks include the full cost of loading and initializing ES module shims itself.

### Variations

Tests are run via [Tachometer](https://github.com/Polymer/tachometer) which then starts benchmarking and loads an IFrame to a custom HTTP/2 server. This ensures full end-to-end performance is benchmarked.

Network variations include:

* Fastest: Fully cold loads, running at maximum throughput over the Node.js HTTP/2 server.
* Throttled: 750Kb/s / 25ms latency throttling with Brotli enabled, handled by the Node.js HTTP/2 server.

Browser tests done on a modern Windows machine with versions:

* Chrome: 100.0.4896.60
* Firefox: 98.0.2

## Results

* [Chrome Passthrough Performance](#chrome-passthrough-performance)
* [Native v Polyfill Performance](#native-v-polyfill-performance)
* [Large Import Maps Performance](#large-import-maps-performance)

### Chrome Passthrough Performance

When running in latest Chromium browser (~70% of users), ES Module Shims fully delegates to the native loader, and users will get native-level performance.

These benchmarks verify this by comparing page loads with and without ES Module Shims, where the benchmark includes the time it takes to load ES Module Shims, run the feature detections, then have `importShim()` delegate to the native loader.

#### Chrome Fastest

| n                                          | Chrome Import Maps (ms)                    | Chrome Import Maps ES Module Shims (ms)    | Difference (ms, x)                         |
|--------------------------------------------|--------------------------------------------|--------------------------------------------|--------------------------------------------|
| 10 _(100 KB)_                              | 53 _(50 - 55)_                             | 63 _(61 - 65)_                             | 10 _(1.19x)_                               |
| 20 _(200 KB)_                              | 73 _(70 - 75)_                             | 83 _(81 - 86)_                             | 10 _(1.14x)_                               |
| 30 _(300 KB)_                              | 93 _(90 - 95)_                             | 103 _(101 - 106)_                          | 10 _(1.11x)_                               |
| 40 _(400 KB)_                              | 114 _(112 - 117)_                          | 124 _(122 - 134)_                          | 10 _(1.09x)_                               |
| 50 _(500 KB)_                              | 134 _(132 - 137)_                          | 144 _(143 - 147)_                          | 10 _(1.07x)_                               |
| 60 _(600 KB)_                              | 155 _(153 - 160)_                          | 165 _(163 - 168)_                          | 9 _(1.06x)_                                |
| 70 _(700 KB)_                              | 176 _(174 - 178)_                          | 185 _(182 - 187)_                          | 9 _(1.05x)_                                |
| 80 _(800 KB)_                              | 196 _(193 - 201)_                          | 206 _(204 - 210)_                          | 10 _(1.05x)_                               |
| 90 _(900 KB)_                              | 217 _(214 - 228)_                          | 226 _(223 - 229)_                          | 9 _(1.04x)_                                |
| 100 _(1000 KB)_                            | 237 _(233 - 240)_                          | 246 _(243 - 250)_                          | 9 _(1.04x)_                                |

#### Throttled

| n                                          | Chrome Throttled Import Maps (ms)          | Chrome Throttled Import Maps ES Module Shims (ms) | Difference (ms, x)                         |
|--------------------------------------------|--------------------------------------------|---------------------------------------------------|--------------------------------------------|
| 10 _(100 KB)_                              | 143 _(141 - 146)_                          | 200 _(197 - 206)_                                 | 57 _(1.4x)_                                |
| 20 _(200 KB)_                              | 151 _(144 - 154)_                          | 208 _(204 - 213)_                                 | 58 _(1.38x)_                               |
| 30 _(300 KB)_                              | 162 _(157 - 167)_                          | 216 _(203 - 224)_                                 | 55 _(1.34x)_                               |
| 40 _(400 KB)_                              | 169 _(163 - 175)_                          | 226 _(220 - 232)_                                 | 58 _(1.34x)_                               |
| 50 _(500 KB)_                              | 162 _(159 - 167)_                          | 231 _(227 - 241)_                                 | 69 _(1.42x)_                               |
| 60 _(600 KB)_                              | 180 _(173 - 186)_                          | 249 _(245 - 260)_                                 | 69 _(1.38x)_                               |
| 70 _(700 KB)_                              | 194 _(189 - 201)_                          | 267 _(260 - 274)_                                 | 73 _(1.38x)_                               |
| 80 _(800 KB)_                              | 219 _(208 - 232)_                          | 281 _(274 - 293)_                                 | 61 _(1.28x)_                               |
| 90 _(900 KB)_                              | 230 _(222 - 246)_                          | 299 _(295 - 310)_                                 | 69 _(1.3x)_                                |
| 100 _(1000 KB)_                            | 255 _(251 - 263)_                          | 320 _(310 - 324)_                                 | 65 _(1.25x)_                               |

### Native v Polyfill Performance

To compare native v polyfill performance we compare execution without import maps to execution with import maps and ES Module Shims in Firefox and Safari (which don't support import maps).

#### Firefox Fastest

| n                                          | Firefox (ms)                               | Firefox Import Maps ES Module Shims (ms)   | Difference (ms, x)                         |
|--------------------------------------------|--------------------------------------------|--------------------------------------------|--------------------------------------------|
| 10 _(100 KB)_                              | 86 _(83 - 93)_                             | 131 _(119 - 144)_                          | 45 _(1.52x)_                               |
| 20 _(200 KB)_                              | 100 _(97 - 105)_                           | 187 _(140 - 217)_                          | 87 _(1.87x)_                               |
| 30 _(300 KB)_                              | 116 _(71 - 138)_                           | 202 _(160 - 217)_                          | 86 _(1.74x)_                               |
| 40 _(400 KB)_                              | 137 _(129 - 163)_                          | 210 _(177 - 245)_                          | 74 _(1.54x)_                               |
| 50 _(500 KB)_                              | 153 _(143 - 163)_                          | 233 _(195 - 260)_                          | 80 _(1.52x)_                               |
| 60 _(600 KB)_                              | 168 _(157 - 183)_                          | 251 _(213 - 282)_                          | 83 _(1.5x)_                                |
| 70 _(700 KB)_                              | 184 _(174 - 209)_                          | 261 _(235 - 309)_                          | 77 _(1.42x)_                               |
| 80 _(800 KB)_                              | 201 _(184 - 221)_                          | 279 _(258 - 317)_                          | 78 _(1.39x)_                               |
| 90 _(900 KB)_                              | 213 _(203 - 225)_                          | 307 _(275 - 355)_                          | 94 _(1.44x)_                               |
| 100 _(1000 KB)_                            | 229 _(218 - 240)_                          | 326 _(301 - 388)_                          | 97 _(1.43x)_                               |

#### Firefox Throttled

| n                                          | Firefox Throttled (ms)                     | Firefox Throttled Import Maps ES Module Shims (ms) | Difference (ms, x)                         |
|--------------------------------------------|--------------------------------------------|----------------------------------------------------|--------------------------------------------|
| 10 _(100 KB)_                              | 175 _(128 - 410)_                          | 287 _(263 - 392)_                                  | 112 _(1.64x)_                              |
| 20 _(200 KB)_                              | 178 _(138 - 204)_                          | 336 _(296 - 395)_                                  | 158 _(1.88x)_                              |
| 30 _(300 KB)_                              | 199 _(143 - 434)_                          | 354 _(322 - 377)_                                  | 155 _(1.77x)_                              |
| 40 _(400 KB)_                              | 190 _(149 - 215)_                          | 366 _(333 - 386)_                                  | 176 _(1.93x)_                              |
| 50 _(500 KB)_                              | 200 _(157 - 233)_                          | 371 _(320 - 398)_                                  | 171 _(1.86x)_                              |
| 60 _(600 KB)_                              | 235 _(164 - 457)_                          | 363 _(335 - 410)_                                  | 127 _(1.54x)_                              |
| 70 _(700 KB)_                              | 216 _(165 - 258)_                          | 386 _(345 - 438)_                                  | 170 _(1.79x)_                              |
| 80 _(800 KB)_                              | 222 _(178 - 251)_                          | 382 _(362 - 434)_                                  | 160 _(1.72x)_                              |
| 90 _(900 KB)_                              | 248 _(191 - 494)_                          | 409 _(383 - 469)_                                  | 161 _(1.65x)_                              |
| 100 _(1000 KB)_                            | 261 _(202 - 493)_                          | 433 _(403 - 483)_                                  | 172 _(1.66x)_                              |

### Large Import Maps Performance

Import maps lie on the critical load path of an application - in theory a large import map might be a performance concern as it would delay module loading.

The large import map variation uses a mapping for every module in the case. So n = 10 corresponds two 20 separate import map entries, n = 20 to 40 etc.

#### Chrome Native Throttled

To investigate this, we run on a throttled connection using native import maps in Chrome.

Running on Chrome native, we can see this slowdown very slightly, although it is within the test variance and far more minimal than might have been expected in comparison to the test variation.

| n                                          | Chrome Throttled Import Maps (ms)          | Chrome Throttled Individual Import Maps (ms) | Difference (ms, x)                         |
|--------------------------------------------|--------------------------------------------|----------------------------------------------|--------------------------------------------|
| 10 _(100 KB)_                              | 143 _(141 - 146)_                          | 142 _(125 - 147)_                            | -1 _(0.99x)_                               |
| 20 _(200 KB)_                              | 151 _(144 - 154)_                          | 152 _(145 - 180)_                            | 1 _(1.01x)_                                |
| 30 _(300 KB)_                              | 162 _(157 - 167)_                          | 160 _(152 - 169)_                            | -1 _(0.99x)_                               |
| 40 _(400 KB)_                              | 169 _(163 - 175)_                          | 167 _(164 - 174)_                            | -1 _(0.99x)_                               |
| 50 _(500 KB)_                              | 162 _(159 - 167)_                          | 163 _(159 - 170)_                            | 0 _(1x)_                                   |
| 60 _(600 KB)_                              | 180 _(173 - 186)_                          | 182 _(174 - 198)_                            | 2 _(1.01x)_                                |
| 70 _(700 KB)_                              | 194 _(189 - 201)_                          | 194 _(188 - 200)_                            | 0 _(1x)_                                   |
| 80 _(800 KB)_                              | 219 _(208 - 232)_                          | 224 _(209 - 235)_                            | 5 _(1.02x)_                                |
| 90 _(900 KB)_                              | 230 _(222 - 246)_                          | 236 _(228 - 250)_                            | 6 _(1.03x)_                                |
| 100 _(1000 KB)_                            | 255 _(251 - 263)_                          | 266 _(254 - 277)_                            | 11 _(1.04x)_                               |

#### Polyfilled Throttled

To compare the polyfill case, we run the same comparison in Firefox comparing the use of a single path mapping with the individual mappings:

| n                                          | Firefox Throttled Import Maps ES Module Shims (ms) | Firefox Throttled Individual Import Maps ES Module Shims (ms) | Difference (ms, x)                         |
|--------------------------------------------|----------------------------------------------------|--------------------------------------------|--------------------------------------------|
| 10 _(100 KB)_                              | 287 _(263 - 392)_                                  | 286 _(259 - 333)_                          | -1 _(1x)_                                  |
| 20 _(200 KB)_                              | 336 _(296 - 395)_                                  | 342 _(300 - 365)_                          | 6 _(1.02x)_                                |
| 30 _(300 KB)_                              | 354 _(322 - 377)_                                  | 359 _(335 - 378)_                          | 5 _(1.01x)_                                |
| 40 _(400 KB)_                              | 366 _(333 - 386)_                                  | 360 _(314 - 400)_                          | -5 _(0.98x)_                               |
| 50 _(500 KB)_                              | 371 _(320 - 398)_                                  | 368 _(319 - 400)_                          | -3 _(0.99x)_                               |
| 60 _(600 KB)_                              | 363 _(335 - 410)_                                  | 385 _(325 - 427)_                          | 22 _(1.06x)_                               |
| 70 _(700 KB)_                              | 386 _(345 - 438)_                                  | 384 _(351 - 490)_                          | -2 _(1x)_                                  |
| 80 _(800 KB)_                              | 382 _(362 - 434)_                                  | 391 _(376 - 424)_                          | 9 _(1.02x)_                                |
| 90 _(900 KB)_                              | 409 _(383 - 469)_                                  | 414 _(390 - 462)_                          | 5 _(1.01x)_                                |
| 100 _(1000 KB)_                            | 433 _(403 - 483)_                                  | 439 _(401 - 502)_                          | 6 _(1.01x)_                                |

We again see the very slight slowdown of a similar order to native as expected.