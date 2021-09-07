import css from './sheet.css' assert { type: 'css' };

window.cssAssertion = css.cssRules[0].selectorText === 'body';

export default css;
