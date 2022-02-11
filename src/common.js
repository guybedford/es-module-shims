
export const edge = !!navigator.userAgent.match(/Edge\/\d+\.\d+/);
export const safari = !!window.safari;

export const baseUrl = document.baseURI;

export function createBlob (source, type = 'text/javascript') {
  return URL.createObjectURL(new Blob([source], { type }));
}

export function isURL (url) {
  try {
    new URL(url);
    return true;
  }
  catch(_) {
    return false;
  }
}

export const noop = () => {};
