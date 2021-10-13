# Benchmark Summary

This benchmark suite provides comprehensive performance comparisons of ES Module Shims versus native modules across browsers.

### Summary

* [ES Module Shims Chrome Passthrough](#chrome-passthrough-performance) results in ~5ms extra initialization time over native for ES Module Shims fetching, execution and initialization, and on a slow connection the additional non-blocking bandwidth cost of its 10.5KB download as expected.
* [ES Module Shims Polyfilling](#native-v-polyfill-performance) is on average 1.4x - 1.5x slower than native module loading, and up to 1.8x slower on slow networks (most likely due to the browser preloader), both for cached and uncached loads, and this result scales linearly up to 10MB and 20k modules loaded executing on the fastest connection in just over 2 seconds in Firefox.
* [Very large import maps](#large-import-maps-performance) (100s of entries) cost only a few extra milliseconds upfront for the additional loading cost.

## Benchmark

### Test Case

The test being benchmarked is **loading and executing** n versions of Preact plus a hello world component, where each n corresponds to a unique instance of Preact. This way real work is being benchmarked and not just some hypothetical n module load test but actual non-trivial execution is also associated with each module load to more closely resemble a real world scenario.

The base test varies these loads from 10 to 100 modules (separate Preact + hello world component for each n being rendered). n=10 corrsponds to 100KB of code being loaded and executed (10 unique instances of the 10KB Preact with the small component being rendered), and n=100 corresponds to 1MB of 100 module component / Preact pairs loading and executing in parallel. In addition a 1000 module load case (10MB) is also included for stress testing.

Each test includes the full network cost of loading the initial HTML by wrapping the top-level runner to call the network server for the actual test start. This way all benchmarks include the full cost of loading and initializing ES module shims itself.

### Variations

Tests are run via [Tachometer](https://github.com/Polymer/tachometer) which then starts benchmarking and loads an IFrame to a custom HTTP/2 server. This ensures full end-to-end performance is benchmarked.

Network variations include:

* Uncached: Fully cold loads, running at maximum throughput over the Node.js HTTP/2 server.
* Cached: Loaded from disk or memory cache, primed via Tachometer warmup phase.
* Throttled: 800Kb/s / 100KB/s throttling with Brotli enabled, handled by the Node.js HTTP/2 server.

Browser tests done on a modern Windows machine with versions:

* Chrome: 91.0.4435.0
* Firefox: 93

## Results

* [Chrome Passthrough Performance](#chrome-passthrough-performance)
* [Native v Polyfill Performance](#native-v-polyfill-performance)
* [Large Import Maps Performance](#large-import-maps-performance)

### Chrome Passthrough Performance

When running in latest Chromium browser (~70% of users), ES Module Shims fully delegates to the native loader, and users will get native-level performance.

These benchmarks verify this by comparing page loads with and without ES Module Shims, where the benchmark includes the time it takes to load ES Module Shims, run the feature detections, then have `importShim()` delegate to the native loader.

#### Uncached

| n                                          | Chrome Import Maps (ms)                    | Chrome Import Maps ES Module Shims (ms)    | Difference (ms, x)                         |
|--------------------------------------------|--------------------------------------------|--------------------------------------------|--------------------------------------------|
| 10 _(100 KB)_                              | 36 _(32 - 40)_                             | 44 _(40 - 49)_                             | 8 _(1.23x)_                                |
| 20 _(200 KB)_                              | 171 _(167 - 176)_                          | 177 _(172 - 182)_                          | 6 _(1.03x)_                                |
| 30 _(300 KB)_                              | 186 _(183 - 194)_                          | 191 _(187 - 198)_                          | 5 _(1.02x)_                                |
| 40 _(400 KB)_                              | 200 _(193 - 218)_                          | 207 _(200 - 218)_                          | 6 _(1.03x)_                                |
| 50 _(500 KB)_                              | 213 _(207 - 223)_                          | 220 _(210 - 227)_                          | 7 _(1.03x)_                                |
| 60 _(600 KB)_                              | 228 _(222 - 238)_                          | 231 _(223 - 246)_                          | 3 _(1.01x)_                                |
| 70 _(700 KB)_                              | 243 _(235 - 256)_                          | 246 _(239 - 256)_                          | 4 _(1.02x)_                                |
| 80 _(800 KB)_                              | 257 _(247 - 270)_                          | 260 _(251 - 266)_                          | 3 _(1.01x)_                                |
| 90 _(900 KB)_                              | 265 _(253 - 279)_                          | 266 _(252 - 281)_                          | 1 _(1x)_                                   |
| 100 _(1000 KB)_                            | 270 _(255 - 289)_                          | 275 _(259 - 291)_                          | 5 _(1.02x)_                                |
| 1000 _(10000 KB)_                          | 1,444 _(1,404 - 1,474)_                    | 1,454 _(1,391 - 1,557)_                    | 9 _(1.01x)_                                |

#### Throttled

| n                                          | Chrome Throttled Import Maps (ms)          | Chrome Throttled Import Maps ES Module Shims (ms) | Difference (ms, x)                         |
|--------------------------------------------|--------------------------------------------|--------------------------------------------|--------------------------------------------|
| 10 _(100 KB)_                              | 157 _(136 - 182)_                          | 186 _(159 - 198)_                          | 29 _(1.19x)_                               |
| 20 _(200 KB)_                              | 231 _(211 - 251)_                          | 215 _(198 - 232)_                          | -16 _(0.93x)_                              |
| 30 _(300 KB)_                              | 232 _(210 - 255)_                          | 225 _(209 - 239)_                          | -7 _(0.97x)_                               |
| 40 _(400 KB)_                              | 228 _(217 - 243)_                          | 230 _(217 - 243)_                          | 2 _(1.01x)_                                |
| 50 _(500 KB)_                              | 238 _(226 - 254)_                          | 236 _(226 - 248)_                          | -3 _(0.99x)_                               |
| 60 _(600 KB)_                              | 239 _(212 - 259)_                          | 241 _(201 - 258)_                          | 2 _(1.01x)_                                |
| 70 _(700 KB)_                              | 249 _(240 - 270)_                          | 257 _(245 - 275)_                          | 8 _(1.03x)_                                |
| 80 _(800 KB)_                              | 252 _(224 - 281)_                          | 265 _(255 - 274)_                          | 13 _(1.05x)_                               |
| 90 _(900 KB)_                              | 255 _(237 - 280)_                          | 271 _(238 - 285)_                          | 16 _(1.06x)_                               |
| 100 _(1000 KB)_                            | 240 _(216 - 266)_                          | 277 _(254 - 295)_                          | 37 _(1.15x)_                               |

### Native v Polyfill Performance

To compare native v polyfill performance we compare execution without import maps to execution with import maps and ES Module Shims in Firefox and Safari (which don't support import maps).

#### Firefox

| n                                          | Firefox (ms)                               | Firefox Import Maps ES Module Shims (ms)   | Difference (ms, x)                         |
|--------------------------------------------|--------------------------------------------|--------------------------------------------|--------------------------------------------|
| 10 _(100 KB)_                              | 38 _(34 - 52)_                             | 80 _(52 - 248)_                            | 42 _(2.11x)_                               |
| 20 _(200 KB)_                              | 68 _(51 - 80)_                             | 96 _(76 - 126)_                            | 27 _(1.4x)_                                |
| 30 _(300 KB)_                              | 87 _(77 - 93)_                             | 120 _(102 - 212)_                          | 33 _(1.38x)_                               |
| 40 _(400 KB)_                              | 109 _(100 - 119)_                          | 144 _(128 - 185)_                          | 35 _(1.32x)_                               |
| 50 _(500 KB)_                              | 120 _(113 - 131)_                          | 170 _(144 - 262)_                          | 50 _(1.41x)_                               |
| 60 _(600 KB)_                              | 138 _(128 - 149)_                          | 178 _(160 - 215)_                          | 39 _(1.28x)_                               |
| 70 _(700 KB)_                              | 156 _(148 - 164)_                          | 219 _(184 - 315)_                          | 63 _(1.41x)_                               |
| 80 _(800 KB)_                              | 172 _(160 - 180)_                          | 224 _(205 - 313)_                          | 53 _(1.31x)_                               |
| 90 _(900 KB)_                              | 188 _(175 - 232)_                          | 247 _(224 - 337)_                          | 59 _(1.31x)_                               |
| 100 _(1000 KB)_                            | 202 _(183 - 219)_                          | 274 _(251 - 363)_                          | 72 _(1.36x)_                               |
| 1000 _(10000 KB)_                          | 1,734 _(1,641 - 1,811)_                    | 2,180 _(2,080 - 2,287)_                     | 447 _(1.26x)_                              |

The 10k test above demonstates these results scale to 20,000 modules in under 2 seconds just fine.

#### Firefox Cached

| n                                          | Firefox Cached (ms)                        | Firefox Cached Import Maps ES Module Shims (ms) | Difference (ms, x)                         |
|--------------------------------------------|--------------------------------------------|--------------------------------------------|--------------------------------------------|
| 10 _(100 KB)_                              | 26 _(24 - 32)_                             | 87 _(43 - 212)_                            | 61 _(3.36x)_                               |
| 20 _(200 KB)_                              | 43 _(39 - 49)_                             | 69 _(65 - 77)_                             | 26 _(1.59x)_                               |
| 30 _(300 KB)_                              | 63 _(54 - 127)_                            | 92 _(82 - 106)_                            | 29 _(1.45x)_                               |
| 40 _(400 KB)_                              | 78 _(69 - 88)_                             | 116 _(104 - 142)_                          | 39 _(1.5x)_                                |
| 50 _(500 KB)_                              | 92 _(88 - 113)_                            | 126 _(113 - 151)_                          | 34 _(1.37x)_                               |
| 60 _(600 KB)_                              | 107 _(101 - 119)_                          | 160 _(133 - 205)_                          | 53 _(1.49x)_                               |
| 70 _(700 KB)_                              | 121 _(114 - 132)_                          | 189 _(150 - 265)_                          | 68 _(1.56x)_                               |
| 80 _(800 KB)_                              | 130 _(121 - 134)_                          | 178 _(172 - 184)_                          | 48 _(1.37x)_                               |
| 90 _(900 KB)_                              | 144 _(138 - 151)_                          | 196 _(183 - 204)_                          | 52 _(1.36x)_                               |
| 100 _(1000 KB)_                            | 157 _(145 - 212)_                          | 216 _(206 - 225)_                          | 58 _(1.37x)_                               |
| 1000 _(10000 KB)_                          | 1,351 _(1,279 - 1,425)_                    | 1,945 _(1,842 - 2,059)_                     | 594 _(1.44x)_                              |

#### Firefox Throttled

| n                                          | Firefox Throttled (ms)                     | Firefox Throttled Import Maps ES Module Shims (ms) | Difference (ms, x)                         |
|--------------------------------------------|--------------------------------------------|--------------------------------------------|--------------------------------------------|
| 10 _(100 KB)_                              | 120 _(100 - 146)_                          | 235 _(209 - 298)_                          | 115 _(1.96x)_                              |
| 20 _(200 KB)_                              | 133 _(120 - 152)_                          | 253 _(234 - 274)_                          | 120 _(1.9x)_                               |
| 30 _(300 KB)_                              | 143 _(127 - 165)_                          | 276 _(244 - 343)_                          | 134 _(1.94x)_                              |
| 40 _(400 KB)_                              | 150 _(127 - 168)_                          | 285 _(262 - 343)_                          | 135 _(1.9x)_                               |
| 50 _(500 KB)_                              | 159 _(150 - 174)_                          | 300 _(275 - 352)_                          | 142 _(1.89x)_                              |
| 60 _(600 KB)_                              | 167 _(158 - 175)_                          | 316 _(279 - 352)_                          | 149 _(1.9x)_                               |
| 70 _(700 KB)_                              | 180 _(172 - 190)_                          | 332 _(303 - 407)_                          | 152 _(1.84x)_                              |
| 80 _(800 KB)_                              | 200 _(187 - 220)_                          | 338 _(317 - 382)_                          | 138 _(1.69x)_                              |
| 90 _(900 KB)_                              | 213 _(195 - 267)_                          | 360 _(342 - 417)_                          | 147 _(1.69x)_                              |
| 100 _(1000 KB)_                            | 230 _(208 - 301)_                          | 390 _(350 - 456)_                          | 160 _(1.7x)_                               |

### Large Import Maps Performance

Import maps lie on the critical load path of an application - in theory a large import map might be a performance concern as it would delay module loading.

The large import map variation uses a mapping for every module in the case. So n = 10 corresponds two 20 separate import map entries, n = 20 to 40 etc.

#### Chrome Native Throttled

To investigate this, we run on a throttled connection using native import maps in Chrome.

Running on Chrome native, we can see this slowdown very slightly, although it is within the test variance and far more minimal than might have been expected in comparison to the test variation.

| n                                          | Chrome Throttled Import Maps (ms)          | Chrome Throttled Individual Import Maps (ms) | Difference (ms, x)                         |
|--------------------------------------------|--------------------------------------------|--------------------------------------------|--------------------------------------------|
| 10 _(100 KB)_                              | 157 _(136 - 182)_                          | 154 _(133 - 179)_                          | -3 _(0.98x)_                               |
| 20 _(200 KB)_                              | 231 _(211 - 251)_                          | 229 _(216 - 241)_                          | -2 _(0.99x)_                               |
| 30 _(300 KB)_                              | 232 _(210 - 255)_                          | 225 _(212 - 246)_                          | -7 _(0.97x)_                               |
| 40 _(400 KB)_                              | 228 _(217 - 243)_                          | 226 _(200 - 241)_                          | -2 _(0.99x)_                               |
| 50 _(500 KB)_                              | 238 _(226 - 254)_                          | 241 _(206 - 265)_                          | 3 _(1.01x)_                                |
| 60 _(600 KB)_                              | 239 _(212 - 259)_                          | 236 _(213 - 254)_                          | -3 _(0.99x)_                               |
| 70 _(700 KB)_                              | 249 _(240 - 270)_                          | 247 _(224 - 288)_                          | -2 _(0.99x)_                               |
| 80 _(800 KB)_                              | 252 _(224 - 281)_                          | 253 _(236 - 273)_                          | 1 _(1x)_                                   |
| 90 _(900 KB)_                              | 255 _(237 - 280)_                          | 251 _(232 - 285)_                          | -4 _(0.98x)_                               |
| 100 _(1000 KB)_                            | 240 _(216 - 266)_                          | 247 _(222 - 270)_                          | 7 _(1.03x)_                                |

#### Polyfilled

To compare the polyfill case, we run the same comparison in Firefox comparing the use of a single path mapping with the individual mappings:

| n                                          | Firefox Throttled Import Maps ES Module Shims (ms) | Firefox Throttled Individual Import Maps ES Module Shims (ms) | Difference (ms, x)                         |
|--------------------------------------------|--------------------------------------------|--------------------------------------------|--------------------------------------------|
| 10 _(100 KB)_                              | 235 _(209 - 298)_                          | 243 _(217 - 307)_                          | 8 _(1.04x)_                                |
| 20 _(200 KB)_                              | 253 _(234 - 274)_                          | 258 _(238 - 328)_                          | 5 _(1.02x)_                                |
| 30 _(300 KB)_                              | 276 _(244 - 343)_                          | 273 _(251 - 319)_                          | -4 _(0.99x)_                               |
| 40 _(400 KB)_                              | 285 _(262 - 343)_                          | 288 _(264 - 322)_                          | 4 _(1.01x)_                                |
| 50 _(500 KB)_                              | 300 _(275 - 352)_                          | 306 _(280 - 338)_                          | 6 _(1.02x)_                                |
| 60 _(600 KB)_                              | 316 _(279 - 352)_                          | 319 _(292 - 372)_                          | 3 _(1.01x)_                                |
| 70 _(700 KB)_                              | 332 _(303 - 407)_                          | 335 _(308 - 387)_                          | 3 _(1.01x)_                                |
| 80 _(800 KB)_                              | 338 _(317 - 382)_                          | 344 _(330 - 427)_                          | 6 _(1.02x)_                                |
| 90 _(900 KB)_                              | 360 _(342 - 417)_                          | 376 _(349 - 443)_                          | 16 _(1.05x)_                               |
| 100 _(1000 KB)_                            | 390 _(350 - 456)_                          | 404 _(367 - 472)_                          | 14 _(1.04x)_                               |

We again see the very slight slowdown of a similar order to native as expected.