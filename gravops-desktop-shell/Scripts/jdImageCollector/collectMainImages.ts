// Stable core module. Run `npm run test:jd-image` before changing this file.
// Runtime main-image extraction remains in jd-webview-reader.js and must not be changed without regression tests.

export const JD_MAIN_IMAGE_SELECTORS = [
  '.image-carousel-track img.image',
  '.image-carousel-track img',
  '#spec-list img',
  '#spec-n1 img',
  '.preview > img',
  '.preview #spec-list img',
  '.preview .spec-items img',
  '.preview .lh img',
  '#preview img'
] as const;
