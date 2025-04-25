import stylesheet from './sheet.css' with { type: 'css' }
document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];

if (import.meta.hot) {
  import.meta.hot.accept(newMod => {
    if (window.acceptInvalidate) {
      import.meta.hot.invalidate();
      return;
    }
    p = newMod.p;
  });
  import.meta.hot.dispose(() => {
    window.disposed = true;
  });
}

export var p = 10;
