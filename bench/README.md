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
| 10 _(100 KB)_                              | 54 _(51 - 58)_                             | 62 _(59 - 66)_                             | 8 _(1.15x)_                                |
| 20 _(200 KB)_                              | 75 _(72 - 78)_                             | 81 _(79 - 84)_                             | 7 _(1.09x)_                                |
| 30 _(300 KB)_                              | 96 _(94 - 98)_                             | 102 _(99 - 104)_                           | 6 _(1.06x)_                                |
| 40 _(400 KB)_                              | 119 _(115 - 123)_                          | 125 _(123 - 131)_                          | 6 _(1.05x)_                                |
| 50 _(500 KB)_                              | 140 _(135 - 145)_                          | 147 _(143 - 157)_                          | 7 _(1.05x)_                                |
| 60 _(600 KB)_                              | 162 _(158 - 175)_                          | 168 _(164 - 179)_                          | 6 _(1.04x)_                                |
| 70 _(700 KB)_                              | 182 _(180 - 185)_                          | 190 _(185 - 204)_                          | 8 _(1.04x)_                                |
| 80 _(800 KB)_                              | 202 _(199 - 206)_                          | 208 _(203 - 215)_                          | 6 _(1.03x)_                                |
| 90 _(900 KB)_                              | 225 _(217 - 236)_                          | 231 _(225 - 242)_                          | 6 _(1.03x)_                                |
| 100 _(1000 KB)_                            | 246 _(241 - 256)_                          | 251 _(247 - 257)_                          | 5 _(1.02x)_                                |

#### Throttled

| n                                          | Chrome Throttled Import Maps (ms)   | Chrome Throttled Import Maps ES Module Shims (ms) | Difference (ms, x)                         |
|--------------------------------------------|--------------------------------------------|--------------------------------------------|--------------------------------------------|
| 10 _(100 KB)_                              | 149 _(143 - 164)_                          | 168 _(161 - 171)_                          | 19 _(1.13x)_                               |
| 20 _(200 KB)_                              | 207 _(194 - 210)_                          | 209 _(207 - 216)_                          | 3 _(1.01x)_                                |
| 30 _(300 KB)_                              | 254 _(246 - 269)_                          | 270 _(267 - 272)_                          | 16 _(1.06x)_                               |
| 40 _(400 KB)_                              | 311 _(304 - 320)_                          | 317 _(310 - 327)_                          | 6 _(1.02x)_                                |
| 50 _(500 KB)_                              | 364 _(358 - 415)_                          | 362 _(357 - 370)_                          | -2 _(1x)_                                  |
| 60 _(600 KB)_                              | 418 _(416 - 427)_                          | 418 _(414 - 428)_                          | 0 _(1x)_                                   |
| 70 _(700 KB)_                              | 475 _(469 - 488)_                          | 481 _(470 - 492)_                          | 6 _(1.01x)_                                |
| 80 _(800 KB)_                              | 548 _(539 - 554)_                          | 547 _(539 - 552)_                          | -1 _(1x)_                                  |
| 90 _(900 KB)_                              | 603 _(597 - 611)_                          | 606 _(597 - 610)_                          | 3 _(1x)_                                   |
| 100 _(1000 KB)_                            | 662 _(659 - 670)_                          | 666 _(660 - 672)_                          | 4 _(1.01x)_                                |

### Native v Polyfill Performance

To compare native v polyfill performance we compare execution without import maps to execution with import maps and ES Module Shims in Firefox and Safari (which don't support import maps).

#### Firefox Fastest

| n                                          | Firefox (ms)                               | Firefox Import Maps ES Module Shims (ms)   | Difference (ms, x)                         |
|--------------------------------------------|--------------------------------------------|--------------------------------------------|--------------------------------------------|
| 10 _(100 KB)_                              | 76 _(46 - 114)_                            | 132 _(118 - 171)_                          | 56 _(1.74x)_                               |
| 20 _(200 KB)_                              | 109 _(100 - 124)_                          | 186 _(138 - 218)_                          | 77 _(1.71x)_                               |
| 30 _(300 KB)_                              | 111 _(78 - 133)_                           | 187 _(158 - 234)_                          | 76 _(1.68x)_                               |
| 40 _(400 KB)_                              | 134 _(101 - 153)_                          | 206 _(164 - 248)_                          | 71 _(1.53x)_                               |
| 50 _(500 KB)_                              | 145 _(112 - 168)_                          | 244 _(200 - 272)_                          | 99 _(1.68x)_                               |
| 60 _(600 KB)_                              | 158 _(123 - 207)_                          | 237 _(208 - 269)_                          | 78 _(1.5x)_                                |
| 70 _(700 KB)_                              | 171 _(143 - 195)_                          | 259 _(238 - 294)_                          | 88 _(1.52x)_                               |
| 80 _(800 KB)_                              | 185 _(150 - 218)_                          | 285 _(257 - 356)_                          | 100 _(1.54x)_                              |
| 90 _(900 KB)_                              | 205 _(179 - 233)_                          | 303 _(278 - 338)_                          | 98 _(1.48x)_                               |
| 100 _(1000 KB)_                            | 219 _(191 - 248)_                          | 319 _(297 - 373)_                          | 100 _(1.46x)_                              |

#### Firefox Throttled

| n                                          | Firefox Throttled (ms)              | Firefox Throttled Import Maps ES Module Shims (ms) | Difference (ms, x)                         |
|--------------------------------------------|--------------------------------------------|--------------------------------------------|--------------------------------------------|
| 10 _(100 KB)_                              | 203 _(196 - 213)_                          | 253 _(241 - 297)_                          | 50 _(1.24x)_                               |
| 20 _(200 KB)_                              | 254 _(245 - 266)_                          | 303 _(287 - 346)_                          | 49 _(1.19x)_                               |
| 30 _(300 KB)_                              | 308 _(297 - 323)_                          | 411 _(394 - 420)_                          | 103 _(1.33x)_                              |
| 40 _(400 KB)_                              | 357 _(347 - 364)_                          | 409 _(390 - 455)_                          | 52 _(1.15x)_                               |
| 50 _(500 KB)_                              | 418 _(411 - 433)_                          | 461 _(455 - 506)_                          | 44 _(1.11x)_                               |
| 60 _(600 KB)_                              | 471 _(463 - 488)_                          | 516 _(507 - 567)_                          | 45 _(1.1x)_                                |
| 70 _(700 KB)_                              | 525 _(515 - 539)_                          | 573 _(555 - 604)_                          | 48 _(1.09x)_                               |
| 80 _(800 KB)_                              | 585 _(577 - 599)_                          | 630 _(608 - 645)_                          | 46 _(1.08x)_                               |
| 90 _(900 KB)_                              | 640 _(635 - 647)_                          | 678 _(669 - 688)_                          | 38 _(1.06x)_                               |
| 100 _(1000 KB)_                            | 692 _(684 - 711)_                          | 742 _(732 - 754)_                          | 50 _(1.07x)_                               |

### Large Import Maps Performance

Import maps lie on the critical load path of an application - in theory a large import map might be a performance concern as it would delay module loading.

The large import map variation uses a mapping for every module in the case. So n = 10 corresponds two 20 separate import map entries, n = 20 to 40 etc.

#### Chrome Native Throttled

To investigate this, we run on a throttled connection using native import maps in Chrome.

Running on Chrome native, we can see this slowdown very slightly, although it is within the test variance and far more minimal than might have been expected in comparison to the test variation.

| n                                          | Chrome Throttled Import Maps (ms)   | Chrome Throttled Individual Import Maps (ms) | Difference (ms, x)                         |
|--------------------------------------------|--------------------------------------------|--------------------------------------------|--------------------------------------------|
| 10 _(100 KB)_                              | 149 _(143 - 164)_                          | 156 _(146 - 167)_                          | 7 _(1.04x)_                                |
| 20 _(200 KB)_                              | 207 _(194 - 210)_                          | 202 _(194 - 213)_                          | -5 _(0.98x)_                               |
| 30 _(300 KB)_                              | 254 _(246 - 269)_                          | 265 _(251 - 270)_                          | 12 _(1.05x)_                               |
| 40 _(400 KB)_                              | 311 _(304 - 320)_                          | 313 _(305 - 327)_                          | 2 _(1.01x)_                                |
| 50 _(500 KB)_                              | 364 _(358 - 415)_                          | 368 _(361 - 376)_                          | 4 _(1.01x)_                                |
| 60 _(600 KB)_                              | 418 _(416 - 427)_                          | 422 _(418 - 430)_                          | 4 _(1.01x)_                                |
| 70 _(700 KB)_                              | 475 _(469 - 488)_                          | 482 _(476 - 498)_                          | 7 _(1.01x)_                                |
| 80 _(800 KB)_                              | 548 _(539 - 554)_                          | 552 _(546 - 560)_                          | 4 _(1.01x)_                                |
| 90 _(900 KB)_                              | 603 _(597 - 611)_                          | 609 _(605 - 611)_                          | 6 _(1.01x)_                                |
| 100 _(1000 KB)_                            | 662 _(659 - 670)_                          | 671 _(667 - 678)_                          | 9 _(1.01x)_                                |


#### Polyfilled Throttled

To compare the polyfill case, we run the same comparison in Firefox comparing the use of a single path mapping with the individual mappings:

| n                                          | Firefox Throttled Import Maps ES Module Shims (ms) | Firefox Throttled Individual Import Maps ES Module Shims (ms) | Difference (ms, x)                         |
|--------------------------------------------|--------------------------------------------|--------------------------------------------|--------------------------------------------|
| 10 _(100 KB)_                              | 253 _(241 - 297)_                          | 259 _(242 - 297)_                          | 6 _(1.02x)_                                |
| 20 _(200 KB)_                              | 303 _(287 - 346)_                          | 316 _(292 - 355)_                          | 13 _(1.04x)_                               |
| 30 _(300 KB)_                              | 411 _(394 - 420)_                          | 417 _(398 - 426)_                          | 6 _(1.01x)_                                |
| 40 _(400 KB)_                              | 409 _(390 - 455)_                          | 417 _(401 - 462)_                          | 8 _(1.02x)_                                |
| 50 _(500 KB)_                              | 461 _(455 - 506)_                          | 470 _(458 - 517)_                          | 9 _(1.02x)_                                |
| 60 _(600 KB)_                              | 516 _(507 - 567)_                          | 529 _(514 - 589)_                          | 13 _(1.02x)_                               |
| 70 _(700 KB)_                              | 573 _(555 - 604)_                          | 581 _(563 - 629)_                          | 8 _(1.01x)_                                |
| 80 _(800 KB)_                              | 630 _(608 - 645)_                          | 632 _(614 - 671)_                          | 2 _(1x)_                                   |
| 90 _(900 KB)_                              | 678 _(669 - 688)_                          | 698 _(681 - 749)_                          | 20 _(1.03x)_                               |
| 100 _(1000 KB)_                            | 742 _(732 - 754)_                          | 761 _(743 - 799)_                          | 18 _(1.02x)_                               |

We again see the very slight slowdown of a similar order to native as expected.