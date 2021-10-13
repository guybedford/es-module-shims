# Benchmark Summary

This benchmark suite provides comprehensive performance comparisons of ES Module Shims versus native modules across browsers.

## Summary

* Uncached 2x slower
* Cached 1.5x slower
* Large import maps don't matter

## Benchmark

### Test Case

The test being benchmarked is **loading and executing** n versions of Preact plus a hello world component, where each n corresponds to a unique instance of Preact. This way real work is being benchmarked and not just some hypothetical n module load test but actual non-trivial execution is also associated with each module load to more closely resemble a real world scenario.

The base test varies these loads from 10 to 100 modules (separate Preact + hello world component for each n being rendered). n=10 corrsponds to 100KB of code being loaded and executed (10 unique instances of the 10KB Preact with the small component being rendered), and n=100 corresponds to 1MB of 100 module component / Preact pairs loading and executing in parallel. In addition a 1000 module load case (10MB) is also included for stress testing.

Each test includes the full network cost of loading the initial HTML by wrapping the top-level runner to call the network server for the actual test start. This way all benchmarks include the full cost of loading and initializing ES module shims itself.

### Variations

Tests are run via Tachometer which then starts benchmarking of loading an iFrame to a custom HTTP/2 server, to ensure full end-to-end performance is benchmarked.

Network variations include:

* Uncached: Fully cold loads, running at maximum throughput over the Node.js HTTP/2 server.
* Cached: Loaded from disk or memory cache, primed via Tachometer warmup phase.
* Throttled: Same as uncached but with 800Kb/s / 100KB/s throttling handled by the Node.js HTTP/2 server.

Browser tests done on a modern Windows machine with versions:

* Chrome: 91.0.4435.0
* Firefox: 93
* Safari: 14 running on Catalina over Virtualbox.

## Results

* [Chrome Passthrough Performance](#chrome-passthrough-performance)
* [Native v Polyfill Performance](#native-v-polyfill-performance)
* [Large Import Maps Performance](#large-import-maps-performance)

### Chrome Passthrough Performance

When running in latest Chromium browser (~70% of users), ES Module Shims fully delegates to the native loader, and users will get native-level performance.

These benchmarks verify this by comparing page loads with and without ES Module Shims, where the benchmark includes the time it takes to load ES Module Shims, run the feature detections, then have `importShim()` delegate to the native loader.

#### Uncached

| n                                          | Chrome Import Maps (ms)                    | Chrome Import Maps ES Module Shims (ms)    | Difference (x)                             |
|--------------------------------------------|--------------------------------------------|--------------------------------------------|--------------------------------------------|
| 10 _(100 KB)_                              | 37 _(34 - 47)_                             | 45 _(40 - 54)_                             | 1.2x                                       |
| 20 _(200 KB)_                              | 50 _(48 - 52)_                             | 58 _(54 - 65)_                             | 1.17x                                      |
| 30 _(300 KB)_                              | 62 _(60 - 64)_                             | 75 _(70 - 86)_                             | 1.21x                                      |
| 40 _(400 KB)_                              | 74 _(72 - 79)_                             | 86 _(82 - 89)_                             | 1.15x                                      |
| 50 _(500 KB)_                              | 87 _(84 - 91)_                             | 95 _(92 - 98)_                             | 1.1x                                       |
| 60 _(600 KB)_                              | 99 _(97 - 101)_                            | 107 _(106 - 111)_                          | 1.08x                                      |
| 70 _(700 KB)_                              | 114 _(109 - 120)_                          | 122 _(120 - 124)_                          | 1.07x                                      |
| 80 _(800 KB)_                              | 129 _(126 - 134)_                          | 137 _(134 - 142)_                          | 1.06x                                      |
| 90 _(900 KB)_                              | 139 _(136 - 142)_                          | 150 _(141 - 161)_                          | 1.07x                                      |
| 100 _(1000 KB)_                            | 150 _(145 - 158)_                          | 163 _(158 - 169)_                          | 1.08x                                      |
| 1000 _(10000 KB)_                          | 1,290 _(1,269 - 1,315)_                    | 1,369 _(1,320 - 1,422)_                    | 1.06x                                      |

#### Cached

| n                                          | Chrome Cached Import Maps (ms)             | Chrome Cached Import Maps ES Module Shims (ms) | Difference (x)                             |
|--------------------------------------------|--------------------------------------------|--------------------------------------------|--------------------------------------------|
| 10 _(100 KB)_                              | 35 _(31 - 41)_                             | 35 _(29 - 37)_                             | 1.01x                                      |
| 20 _(200 KB)_                              | 38 _(37 - 40)_                             | 44 _(43 - 44)_                             | 1.13x                                      |
| 30 _(300 KB)_                              | 47 _(44 - 49)_                             | 51 _(49 - 54)_                             | 1.08x                                      |
| 40 _(400 KB)_                              | 50 _(50 - 51)_                             | 58 _(55 - 59)_                             | 1.14x                                      |
| 50 _(500 KB)_                              | 58 _(56 - 61)_                             | 65 _(62 - 68)_                             | 1.11x                                      |
| 60 _(600 KB)_                              | 66 _(62 - 70)_                             | 69 _(68 - 71)_                             | 1.05x                                      |
| 70 _(700 KB)_                              | 71 _(69 - 76)_                             | 79 _(77 - 81)_                             | 1.11x                                      |
| 80 _(800 KB)_                              | 78 _(77 - 80)_                             | 85 _(83 - 87)_                             | 1.09x                                      |
| 90 _(900 KB)_                              | 86 _(83 - 89)_                             | 93 _(90 - 96)_                             | 1.08x                                      |
| 100 _(1000 KB)_                            | 93 _(91 - 97)_                             | 100 _(98 - 105)_                           | 1.07x                                      |
| 1000 _(10000 KB)_                          | 968 _(868 - 1,97)_                         | 1,8 _(920 - 1,171)_                        | 1.04x                                      |

#### Throttled

| n                                          | Chrome Throttled Import Maps (ms)          | Chrome Throttled Import Maps ES Module Shims (ms) | Difference (x)                             |
|--------------------------------------------|--------------------------------------------|--------------------------------------------|--------------------------------------------|
| 10 _(100 KB)_                              | 124 _(121 - 126)_                          | 166 _(162 - 167)_                          | 1.34x                                      |
| 20 _(200 KB)_                              | 140 _(135 - 143)_                          | 284 _(275 - 293)_                          | 2.03x                                      |
| 30 _(300 KB)_                              | 259 _(243 - 271)_                          | 433 _(422 - 440)_                          | 1.67x                                      |
| 40 _(400 KB)_                              | 442 _(435 - 456)_                          | 565 _(557 - 577)_                          | 1.28x                                      |
| 50 _(500 KB)_                              | 582 _(574 - 594)_                          | 706 _(695 - 719)_                          | 1.21x                                      |
| 60 _(600 KB)_                              | 722 _(718 - 732)_                          | 840 _(837 - 842)_                          | 1.16x                                      |
| 70 _(700 KB)_                              | 850 _(841 - 860)_                          | 981 _(971 - 991)_                          | 1.15x                                      |
| 80 _(800 KB)_                              | 1,1 _(987 - 1,11)_                         | 1,118 _(1,116 - 1,120)_                    | 1.12x                                      |
| 90 _(900 KB)_                              | 1,129 _(1,124 - 1,134)_                    | 1,250 _(1,243 - 1,260)_                    | 1.11x                                      |
| 100 _(1000 KB)_                            | 1,267 _(1,253 - 1,277)_                    | 1,388 _(1,377 - 1,397)_                    | 1.1x                                       |

### Native v Polyfill Performance

To compare native v polyfill performance we compare execution without import maps to execution with import maps and ES Module Shims in Firefox and Safari (which don't support import maps).

#### Firefox

| n                                          | Firefox (ms)                               | Firefox Import Maps ES Module Shims (ms)   | Difference (x)                             |
|--------------------------------------------|--------------------------------------------|--------------------------------------------|--------------------------------------------|
| 10 _(100 KB)_                              | 30 _(27 - 33)_                             | 70 _(49 - 142)_                            | 2.38x                                      |
| 20 _(200 KB)_                              | 54 _(51 - 60)_                             | 80 _(72 - 91)_                             | 1.47x                                      |
| 30 _(300 KB)_                              | 74 _(71 - 76)_                             | 115 _(95 - 131)_                           | 1.56x                                      |
| 40 _(400 KB)_                              | 93 _(90 - 99)_                             | 122 _(108 - 137)_                          | 1.31x                                      |
| 50 _(500 KB)_                              | 109 _(102 - 114)_                          | 146 _(132 - 175)_                          | 1.34x                                      |
| 60 _(600 KB)_                              | 122 _(116 - 126)_                          | 186 _(150 - 271)_                          | 1.52x                                      |
| 70 _(700 KB)_                              | 143 _(132 - 153)_                          | 183 _(181 - 184)_                          | 1.28x                                      |
| 80 _(800 KB)_                              | 152 _(144 - 162)_                          | 220 _(192 - 309)_                          | 1.44x                                      |
| 90 _(900 KB)_                              | 173 _(168 - 178)_                          | 227 _(222 - 234)_                          | 1.31x                                      |
| 100 _(1000 KB)_                            | 182 _(177 - 188)_                          | 265 _(230 - 354)_                          | 1.45x                                      |
| 1000 _(10000 KB)_                          | 1,613 _(1,553 - 1,716)_                    | 2,69 _(2,40 - 2,91)_                       | 1.28x                                      |

#### Firefox Throttled

| n                                          | Firefox Throttled (ms)                     | Firefox Throttled Import Maps ES Module Shims (ms) | Difference (x)                             |
|--------------------------------------------|--------------------------------------------|--------------------------------------------|--------------------------------------------|
| 10 _(100 KB)_                              | 120 _(115 - 127)_                          | 208 _(199 - 214)_                          | 1.73x                                      |
| 20 _(200 KB)_                              | 131 _(123 - 142)_                          | 352 _(341 - 360)_                          | 2.68x                                      |
| 30 _(300 KB)_                              | 238 _(187 - 272)_                          | 495 _(481 - 503)_                          | 2.08x                                      |
| 40 _(400 KB)_                              | 444 _(436 - 454)_                          | 624 _(616 - 634)_                          | 1.41x                                      |
| 50 _(500 KB)_                              | 573 _(524 - 604)_                          | 765 _(756 - 775)_                          | 1.34x                                      |
| 60 _(600 KB)_                              | 714 _(700 - 720)_                          | 893 _(876 - 900)_                          | 1.25x                                      |
| 70 _(700 KB)_                              | 840 _(802 - 858)_                          | 1,36 _(1,29 - 1,41)_                       | 1.23x                                      |
| 80 _(800 KB)_                              | 985 _(948 - 997)_                          | 1,169 _(1,161 - 1,178)_                    | 1.19x                                      |
| 90 _(900 KB)_                              | 1,119 _(1,110 - 1,126)_                    | 1,311 _(1,304 - 1,314)_                    | 1.17x                                      |
| 100 _(1000 KB)_                            | 1,245 _(1,221 - 1,268)_                    | 1,442 _(1,434 - 1,453)_                    | 1.16x                                      |

#### Safari

| n                                          | Safari (ms)                                | Safari Import Maps ES Module Shims (ms)    | Difference (x)                             |
|--------------------------------------------|--------------------------------------------|--------------------------------------------|--------------------------------------------|
| 10 _(100 KB)_                              | 84 _(47 - 115)_                            | 157 _(121 - 248)_                          | 1.87x                                      |
| 20 _(200 KB)_                              | 139 _(75 - 203)_                           | 243 _(199 - 288)_                          | 1.74x                                      |
| 30 _(300 KB)_                              | 143 _(98 - 198)_                           | 237 _(167 - 271)_                          | 1.66x                                      |
| 40 _(400 KB)_                              | 144 _(105 - 217)_                          | 260 _(202 - 310)_                          | 1.8x                                       |
| 50 _(500 KB)_                              | 174 _(126 - 223)_                          | 283 _(223 - 331)_                          | 1.62x                                      |
| 60 _(600 KB)_                              | 186 _(146 - 212)_                          | 323 _(300 - 370)_                          | 1.73x                                      |
| 70 _(700 KB)_                              | 212 _(155 - 265)_                          | 356 _(329 - 381)_                          | 1.67x                                      |
| 80 _(800 KB)_                              | 194 _(164 - 241)_                          | 372 _(332 - 401)_                          | 1.91x                                      |
| 90 _(900 KB)_                              | 205 _(181 - 236)_                          | 377 _(332 - 420)_                          | 1.84x                                      |
| 100 _(1000 KB)_                            | 251 _(221 - 294)_                          | 398 _(335 - 457)_                          | 1.59x                                      |
| 1000 _(10000 KB)_                          | 1,289 _(1,222 - 1,332)_                    | 2,336 _(2,217 - 2,431)_                    | 1.81x                                      |

#### Safari Throttled

| n                                          | Safari Throttled (ms)                      | Safari Throttled Import Maps ES Module Shims (ms) | Difference (x)                             |
|--------------------------------------------|--------------------------------------------|--------------------------------------------|--------------------------------------------|
| 10 _(100 KB)_                              | 210 _(186 - 230)_                          | 276 _(228 - 335)_                          | 1.32x                                      |
| 20 _(200 KB)_                              | 235 _(180 - 293)_                          | 304 _(245 - 348)_                          | 1.29x                                      |
| 30 _(300 KB)_                              | 240 _(195 - 346)_                          | 331 _(279 - 361)_                          | 1.38x                                      |
| 40 _(400 KB)_                              | 243 _(203 - 296)_                          | 340 _(277 - 397)_                          | 1.4x                                       |
| 50 _(500 KB)_                              | 284 _(188 - 342)_                          | 340 _(301 - 394)_                          | 1.2x                                       |
| 60 _(600 KB)_                              | 269 _(219 - 314)_                          | 360 _(313 - 441)_                          | 1.34x                                      |
| 70 _(700 KB)_                              | 444 _(343 - 543)_                          | 565 _(438 - 694)_                          | 1.27x                                      |
| 80 _(800 KB)_                              | 735 _(619 - 906)_                          | 801 _(787 - 815)_                          | 1.09x                                      |
| 90 _(900 KB)_                              | 895 _(794 - 973)_                          | 935 _(859 - 1,29)_                         | 1.05x                                      |
| 100 _(1000 KB)_                            | 1,101 _(1,41 - 1,159)_                     | 1,124 _(1,62 - 1,150)_                     | 1.02x                                      |

### Large Import Maps Performance

Import maps lie on the critical load path of an application - in theory a large import map might be a performance concern as it would delay module loading.

The large import map variation uses a mapping for every module in the case. So n = 10 corresponds two 20 separate import map entries, n = 20 to 40 etc.

#### Chrome Native Throttled

To investigate this, we run on a throttled connection using native import maps in Chrome.

Running on Chrome native, we can see this slowdown very slightly, although it is far more minimal than might have been expected - of the order of milliseonds.

| n                                          | Chrome Throttled Import Maps (ms)          | Chrome Throttled Individual Import Maps (ms) | Difference (x)                             |
|--------------------------------------------|--------------------------------------------|--------------------------------------------|--------------------------------------------|
| 10 _(100 KB)_                              | 124 _(121 - 126)_                          | 123 _(121 - 125)_                          | 0.99x                                      |
| 20 _(200 KB)_                              | 140 _(135 - 143)_                          | 138 _(131 - 145)_                          | 0.99x                                      |
| 30 _(300 KB)_                              | 259 _(243 - 271)_                          | 273 _(258 - 290)_                          | 1.05x                                      |
| 40 _(400 KB)_                              | 442 _(435 - 456)_                          | 455 _(443 - 460)_                          | 1.03x                                      |
| 50 _(500 KB)_                              | 582 _(574 - 594)_                          | 588 _(578 - 598)_                          | 1.01x                                      |
| 60 _(600 KB)_                              | 722 _(718 - 732)_                          | 729 _(716 - 741)_                          | 1.01x                                      |
| 70 _(700 KB)_                              | 850 _(841 - 860)_                          | 865 _(858 - 876)_                          | 1.02x                                      |
| 80 _(800 KB)_                              | 1,1 _(987 - 1,11)_                         | 1,3 _(981 - 1,16)_                         | 1x                                         |
| 90 _(900 KB)_                              | 1,129 _(1,124 - 1,134)_                    | 1,141 _(1,136 - 1,150)_                    | 1.01x                                      |
| 100 _(1000 KB)_                            | 1,267 _(1,253 - 1,277)_                    | 1,286 _(1,280 - 1,291)_                    | 1.02x                                      |

#### Polyfilled

To compare the polyfill case, we run the same comparison in Firefox comparing the use of a single path mapping with the individual mappings:

| n                                          | Firefox Throttled Import Maps ES Module Shims (ms) | Firefox Throttled Individual Import Maps ES Module Shims (ms) | Difference (x)                             |
|--------------------------------------------|--------------------------------------------|--------------------------------------------|--------------------------------------------|
| 10 _(100 KB)_                              | 208 _(199 - 214)_                          | 211 _(204 - 218)_                          | 1.01x                                      |
| 20 _(200 KB)_                              | 352 _(341 - 360)_                          | 354 _(339 - 363)_                          | 1x                                         |
| 30 _(300 KB)_                              | 495 _(481 - 503)_                          | 498 _(494 - 508)_                          | 1.01x                                      |
| 40 _(400 KB)_                              | 624 _(616 - 634)_                          | 626 _(616 - 637)_                          | 1x                                         |
| 50 _(500 KB)_                              | 765 _(756 - 775)_                          | 771 _(763 - 775)_                          | 1.01x                                      |
| 60 _(600 KB)_                              | 893 _(876 - 900)_                          | 908 _(896 - 918)_                          | 1.02x                                      |
| 70 _(700 KB)_                              | 1,36 _(1,29 - 1,41)_                       | 1,37 _(1,18 - 1,51)_                       | 1x                                         |
| 80 _(800 KB)_                              | 1,169 _(1,161 - 1,178)_                    | 1,187 _(1,174 - 1,193)_                    | 1.01x                                      |
| 90 _(900 KB)_                              | 1,311 _(1,304 - 1,314)_                    | 1,319 _(1,309 - 1,330)_                    | 1.01x                                      |
| 100 _(1000 KB)_                            | 1,442 _(1,434 - 1,453)_                    | 1,449 _(1,410 - 1,469)_                    | 1x                                         |

We again see the very slight slowdown of a similar order to native as expected.