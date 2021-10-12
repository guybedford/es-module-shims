# Benchmark Summary

This benchmark suite uses Tachometer to test a variety of module loads with and without ES module shims, across Chrome, Firefox and Safari. A custom HTTP/2 server is used that allows for varying the network caching and throttling.

The primary test being benchmarked is currently n versions of Preact plus a hello world component, where each n corresponds to a unique instance of Preact. This way real work is being benchmarked and not just some hypothetical n module load test but actual non-trivial execution is also associated with each module load to more closely resemble a real world scenario.

The base test varies these loads from 10 to 100 modules (10KB Preact + hello world component for each n being rendered). n=10 corrsponds to 100KB of code being loaded and executed (10 unique instances of Preact with a component being rendered), and n=100 corresponds to 1MB of 100 module component / Preact pairs loading and executing in parallel. In addition a 1000 module load case (10MB) is also included for stress testing.

Each test includes the full network cost of loading the initial HTML by wrapping the top-level runner to call the network server for the actual test start. This way all benchmarks include the full cost of loading and initializing ES module shims itself.

## Test Cases

The first case is a baseline test of the module loading performance without import maps, allowing direct comparison of parallel module loads between browsers.

We then include the following variations on this same base execution:

1. Import Maps: Each component is loaded using an import mappipng, only supported natively in Chromium browsers.
2. Import Maps + ES Module Shims: (1) above but with the ES Module Shims included.
3. All Import Mapped: Each component is loaded with its own unique mapping, testing a large number of mappings in the import map itself.
4. All Import Mapped + ES Module Shims: (3) above, but with the ES Module Shims polyfill included.

The results can be explored through a web interface from [results.html](results.html) over any local server.

A summary of the results on a modern laptop are provided below.

## Results

### Native v Polyfill Performance

To investigate native versus polyfill performance there are two cases to consider:

* Native Passthrough: When the native loader is executing the application, ES Module Shims just initializes, runs feature detections, then gets out of the way.
* Full Polyfill: When the native loader doesn't support the needed features, ES Module Shims actively engages the polyfill for module execution.

The Chrome tests are all tests of the native passthrough functionality since the polyfill will never engage in Chrome.

In order to compare the performance of native execution versus the polyfill we compare the performance of Firefox with and without import maps using the polyfill.

This gives the following results table:

| N (Unique Preact + Component) | Firefox                        | Firefox (60+)                        | Safari (10.1+)                       | Edge (17+)                           |
| ---------------------------------- | ------------------------------------ | ------------------------------------ | ------------------------------------ | ------------------------------------ |
| Executes Modules in Correct Order  | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:<sup>1</sup>       |
| [Dynamic Import](#dynamic-import)  | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [import.meta.url](#importmetaurl)  | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [Module Workers](#module-workers)  | :heavy_check_mark: ~68+              | :x:<sup>2</sup>                      | :x:<sup>2</sup>                      | :x:<sup>2</sup>                      |
| [modulepreload](#modulepreload)    | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [Import Maps](#import-maps)        | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [JSON Modules](#json-modules)      | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [CSS Modules](#css-modules)        | :heavy_check_mark:<sup>3</sup>       | :heavy_check_mark:<sup>3</sup>       | :heavy_check_mark:<sup>3</sup>       | :heavy_check_mark:<sup>3</sup>       |
| [import.meta.resolve](#resolve)    | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |

n	Chrome Parallel Mapped Cached (ms)❌	Chrome Parallel Mapped ES Module Shims Cached (ms)❌	Chrome Parallel Mapped Fastest (ms)❌	Chrome Parallel Mapped ES Module Shims Fastest (ms)❌
10 (100 KB)	35 (31 - 41)	35 (29 - 37)	37 (34 - 47)	45 (40 - 54)
20 (200 KB)	38 (37 - 40)	44 (43 - 44)	50 (48 - 52)	58 (54 - 65)
30 (300 KB)	47 (44 - 49)	51 (49 - 54)	62 (60 - 64)	75 (70 - 86)
40 (400 KB)	50 (50 - 51)	58 (55 - 59)	74 (72 - 79)	86 (82 - 89)
50 (500 KB)	58 (56 - 61)	65 (62 - 68)	87 (84 - 91)	95 (92 - 98)
60 (600 KB)	66 (62 - 70)	69 (68 - 71)	99 (97 - 101)	107 (106 - 111)
70 (700 KB)	71 (69 - 76)	79 (77 - 81)	114 (109 - 120)	122 (120 - 124)
80 (800 KB)	78 (77 - 80)	85 (83 - 87)	129 (126 - 134)	137 (134 - 142)
90 (900 KB)	86 (83 - 89)	93 (90 - 96)	139 (136 - 142)	150 (141 - 161)
100 (1000 KB)	93 (91 - 97)	100 (98 - 105)	150 (145 - 158)	163 (158 - 169)
1000 (10000 KB)	968 (868 - 1,97)	1,8 (920 - 1,171)	1,290 (1,269 - 1,315)	1,369 (1,320 - 1,422)