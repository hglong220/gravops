// Stable core module. Run `npm run test:jd-image` before changing this file.

export const JD_DETAIL_CONTAINER_SELECTORS = [
  '#graphic-content',
  '#J-detail-content',
  '#detail',
  '.detail-content',
  '.ssd-module-detail',
  '.ssd-module-wrap',
  '.ssd-module',
  '.detail'
] as const;

export const JD_DOM_IMAGE_ATTRIBUTES = [
  'src',
  'data-src',
  'data-lazyload',
  'data-original',
  'data-url',
  'data-origin'
] as const;
