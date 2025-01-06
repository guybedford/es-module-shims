import css from './sheet.css' with { type: 'css' };

window.cssAssertion = css.cssRules[0].selectorText === 'body';

export default css;
