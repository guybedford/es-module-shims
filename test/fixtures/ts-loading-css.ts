export { default as style } from './sheet.css' with { type: 'css' };

export function getStyle () {
  return import('./sheet.css', { with: { type: 'css' } });
}

export const p: number = 50;
