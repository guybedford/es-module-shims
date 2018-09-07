import fs from 'fs';
import assert from 'assert';
import { analyzeModuleSyntax } from '../src/lexer.js';

function parse (source) {
  const result = analyzeModuleSyntax(source);
  if (result[2])
    throw result[2];
  return result;
}

suite('Rollup', () => {
  test('Unminified', () => {
    const source = fs.readFileSync('test/fixtures/rollup.js').toString();
    run(source);
  });

  test('Minified', () => {
    const source = fs.readFileSync('test/fixtures/rollup.min.js').toString();
    run(source);
  });

  function run (source) {
    const [imports, exports] = parse(source);
    const importNames = imports.map(impt => source.slice(impt.s, impt.e)).sort();
    assert.deepEqual(importNames, [
      'crypto',
      'events',
      'fs',
      'module',
      'path',
      'util'
    ]);
    assert.equal(exports.length, 3);
  }
});

suite('d3', () => {
  test('Unminified', () => {
    const source = fs.readFileSync('test/fixtures/d3.js').toString();
    run(source);
  });

  test('Minified', () => {
    const source = fs.readFileSync('test/fixtures/d3.min.js').toString();
    run(source);
  });

  function run (source) {
    const [imports, exports] = parse(source);
    const importNames = imports.map(impt => source.slice(impt.s, impt.e)).sort();
    assert.deepEqual(importNames, []);
    assert.deepEqual(exports, [
      "version", "bisect", "bisectRight", "bisectLeft", "ascending", "bisector", "cross", "descending", "deviation", "extent", "histogram", "thresholdFreedmanDiaconis", "thresholdScott", "thresholdSturges", "max", "mean", "median", "merge", "min", "pairs", "permute", "quantile", "range", "scan", "shuffle", "sum", "ticks", "tickIncrement", "tickStep", "transpose", "variance", "zip", "axisTop", "axisRight", "axisBottom", "axisLeft", "brush", "brushX", "brushY", "brushSelection", "chord", "ribbon", "nest", "set", "map", "keys", "values", "entries", "color", "rgb", "hsl", "lab", "hcl", "lch", "gray", "cubehelix", "contours", "contourDensity", "dispatch", "drag", "dragDisable", "dragEnable", "dsvFormat", "csvParse", "csvParseRows", "csvFormat", "csvFormatRows", "tsvParse", "tsvParseRows", "tsvFormat", "tsvFormatRows", "easeLinear", "easeQuad", "easeQuadIn", "easeQuadOut", "easeQuadInOut", "easeCubic", "easeCubicIn", "easeCubicOut", "easeCubicInOut", "easePoly", "easePolyIn", "easePolyOut", "easePolyInOut", "easeSin", "easeSinIn", "easeSinOut", "easeSinInOut", "easeExp", "easeExpIn", "easeExpOut", "easeExpInOut", "easeCircle", "easeCircleIn", "easeCircleOut", "easeCircleInOut", "easeBounce", "easeBounceIn", "easeBounceOut", "easeBounceInOut", "easeBack", "easeBackIn", "easeBackOut", "easeBackInOut", "easeElastic", "easeElasticIn", "easeElasticOut", "easeElasticInOut", "blob", "buffer", "dsv", "csv", "tsv", "image", "json", "text", "xml", "html", "svg", "forceCenter", "forceCollide", "forceLink", "forceManyBody", "forceRadial", "forceSimulation", "forceX", "forceY", "formatDefaultLocale", "format", "formatPrefix", "formatLocale", "formatSpecifier", "precisionFixed", "precisionPrefix", "precisionRound", "geoArea", "geoBounds", "geoCentroid", "geoCircle", "geoClipAntimeridian", "geoClipCircle", "geoClipExtent", "geoClipRectangle", "geoContains", "geoDistance", "geoGraticule", "geoGraticule10", "geoInterpolate", "geoLength", "geoPath", "geoAlbers", "geoAlbersUsa", "geoAzimuthalEqualArea", "geoAzimuthalEqualAreaRaw", "geoAzimuthalEquidistant", "geoAzimuthalEquidistantRaw", "geoConicConformal", "geoConicConformalRaw", "geoConicEqualArea", "geoConicEqualAreaRaw", "geoConicEquidistant", "geoConicEquidistantRaw", "geoEqualEarth", "geoEqualEarthRaw", "geoEquirectangular", "geoEquirectangularRaw", "geoGnomonic", "geoGnomonicRaw", "geoIdentity", "geoProjection", "geoProjectionMutator", "geoMercator", "geoMercatorRaw", "geoNaturalEarth1", "geoNaturalEarth1Raw", "geoOrthographic", "geoOrthographicRaw", "geoStereographic", "geoStereographicRaw", "geoTransverseMercator", "geoTransverseMercatorRaw", "geoRotation", "geoStream", "geoTransform", "cluster", "hierarchy", "pack", "packSiblings", "packEnclose", "partition", "stratify", "tree", "treemap", "treemapBinary", "treemapDice", "treemapSlice", "treemapSliceDice", "treemapSquarify", "treemapResquarify", "interpolate", "interpolateArray", "interpolateBasis", "interpolateBasisClosed", "interpolateDate", "interpolateDiscrete", "interpolateHue", "interpolateNumber", "interpolateObject", "interpolateRound", "interpolateString", "interpolateTransformCss", "interpolateTransformSvg", "interpolateZoom", "interpolateRgb", "interpolateRgbBasis", "interpolateRgbBasisClosed", "interpolateHsl", "interpolateHslLong", "interpolateLab", "interpolateHcl", "interpolateHclLong", "interpolateCubehelix", "interpolateCubehelixLong", "piecewise", "quantize", "path", "polygonArea", "polygonCentroid", "polygonHull", "polygonContains", "polygonLength", "quadtree", "randomUniform", "randomNormal", "randomLogNormal", "randomBates", "randomIrwinHall", "randomExponential", "scaleBand", "scalePoint", "scaleIdentity", "scaleLinear", "scaleLog", "scaleOrdinal", "scaleImplicit", "scalePow", "scaleSqrt", "scaleQuantile", "scaleQuantize", "scaleThreshold", "scaleTime", "scaleUtc", "scaleSequential", "scaleDiverging", "schemeCategory10", "schemeAccent", "schemeDark2", "schemePaired", "schemePastel1", "schemePastel2", "schemeSet1", "schemeSet2", "schemeSet3", "interpolateBrBG", "schemeBrBG", "interpolatePRGn", "schemePRGn", "interpolatePiYG", "schemePiYG", "interpolatePuOr", "schemePuOr", "interpolateRdBu", "schemeRdBu", "interpolateRdGy", "schemeRdGy", "interpolateRdYlBu", "schemeRdYlBu", "interpolateRdYlGn", "schemeRdYlGn", "interpolateSpectral", "schemeSpectral", "interpolateBuGn", "schemeBuGn", "interpolateBuPu", "schemeBuPu", "interpolateGnBu", "schemeGnBu", "interpolateOrRd", "schemeOrRd", "interpolatePuBuGn", "schemePuBuGn", "interpolatePuBu", "schemePuBu", "interpolatePuRd", "schemePuRd", "interpolateRdPu", "schemeRdPu", "interpolateYlGnBu", "schemeYlGnBu", "interpolateYlGn", "schemeYlGn", "interpolateYlOrBr", "schemeYlOrBr", "interpolateYlOrRd", "schemeYlOrRd", "interpolateBlues", "schemeBlues", "interpolateGreens", "schemeGreens", "interpolateGreys", "schemeGreys", "interpolatePurples", "schemePurples", "interpolateReds", "schemeReds", "interpolateOranges", "schemeOranges", "interpolateCubehelixDefault", "interpolateRainbow", "interpolateWarm", "interpolateCool", "interpolateSinebow", "interpolateViridis", "interpolateMagma", "interpolateInferno", "interpolatePlasma", "create", "creator", "local", "matcher", "mouse", "namespace", "namespaces", "clientPoint", "select", "selectAll", "selection", "selector", "selectorAll", "style", "touch", "touches", "window", "event", "customEvent", "arc", "area", "line", "pie", "areaRadial", "radialArea", "lineRadial", "radialLine", "pointRadial", "linkHorizontal", "linkVertical", "linkRadial", "symbol", "symbols", "symbolCircle", "symbolCross", "symbolDiamond", "symbolSquare", "symbolStar", "symbolTriangle", "symbolWye", "curveBasisClosed", "curveBasisOpen", "curveBasis", "curveBundle", "curveCardinalClosed", "curveCardinalOpen", "curveCardinal", "curveCatmullRomClosed", "curveCatmullRomOpen", "curveCatmullRom", "curveLinearClosed", "curveLinear", "curveMonotoneX", "curveMonotoneY", "curveNatural", "curveStep", "curveStepAfter", "curveStepBefore", "stack", "stackOffsetExpand", "stackOffsetDiverging", "stackOffsetNone", "stackOffsetSilhouette", "stackOffsetWiggle", "stackOrderAscending", "stackOrderDescending", "stackOrderInsideOut", "stackOrderNone", "stackOrderReverse", "timeInterval", "timeMillisecond", "timeMilliseconds", "utcMillisecond", "utcMilliseconds", "timeSecond", "timeSeconds", "utcSecond", "utcSeconds", "timeMinute", "timeMinutes", "timeHour", "timeHours", "timeDay", "timeDays", "timeWeek", "timeWeeks", "timeSunday", "timeSundays", "timeMonday", "timeMondays", "timeTuesday", "timeTuesdays", "timeWednesday", "timeWednesdays", "timeThursday", "timeThursdays", "timeFriday", "timeFridays", "timeSaturday", "timeSaturdays", "timeMonth", "timeMonths", "timeYear", "timeYears", "utcMinute", "utcMinutes", "utcHour", "utcHours", "utcDay", "utcDays", "utcWeek", "utcWeeks", "utcSunday", "utcSundays", "utcMonday", "utcMondays", "utcTuesday", "utcTuesdays", "utcWednesday", "utcWednesdays", "utcThursday", "utcThursdays", "utcFriday", "utcFridays", "utcSaturday", "utcSaturdays", "utcMonth", "utcMonths", "utcYear", "utcYears", "timeFormatDefaultLocale", "timeFormat", "timeParse", "utcFormat", "utcParse", "timeFormatLocale", "isoFormat", "isoParse", "now", "timer", "timerFlush", "timeout", "interval", "transition", "active", "interrupt", "voronoi", "zoom", "zoomTransform", "zoomIdentity"
    ]);
  }
});

suite('Magic String', () => {
  test('Unminified', () => {
    const source = fs.readFileSync('test/fixtures/magic-string.js').toString();
    run(source);
  });

  test('Minified', () => {
    const source = fs.readFileSync('test/fixtures/magic-string.min.js').toString();
    run(source);
  });

  function run (source) {
    const [imports, exports] = parse(source);
    const importNames = imports.map(impt => source.slice(impt.s, impt.e)).sort();
    assert.deepEqual(importNames, [
      'sourcemap-codec'
    ]);
    assert.deepEqual(exports, ['default', 'Bundle', 'SourceMap']);
  }
});