import json from '../json.json' with {
  type: 'json'
};

export const url = import
  .meta.url;

export const dynamic = () => import(
  /* comment */
  './es6.js'
);

export const spaced = () => import
  (
    './es6.js'
  );

export { json }; // LINE_MARKER
