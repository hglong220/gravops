# JD Image Reader Stable v1

Stable tag: `jd-image-reader-stable-v1`

Stable commit: `bfb65b6 Stabilize JD detail image capture`

## Scope

The JD main-image and detail-image collector is treated as a stable core module. Do not change the runtime collection logic unless `npm run test:jd-image` passes and the change explicitly updates the stable contract or snapshots.

## Runtime Entry Points

- Main image collection entry: `gravops-desktop-shell/Scripts/jd-webview-reader.js`
- Detail image collection entry: `gravops-desktop-shell/Scripts/jd-webview-reader.js`
- Desktop capture orchestration: `gravops-desktop-shell/MainForm.cs`
- Stable contract module: `gravops-desktop-shell/Scripts/jdImageCollector/index.ts`

## Stable Logic Notes

- Main images are collected from JD preview/image carousel DOM and `window.imageAndVideoJson` fallback.
- Detail images are merged by priority:
  1. detail HTML responses
  2. detail DOM containers
  3. network fallback only when trusted detail sources are insufficient
- Network captures are isolated per `captureId`.
- Old captures are cleared before reading a new product.
- Late network responses are ignored unless their `captureId` is still current.
- Detail DOM containers include `#graphic-content`, `#J-detail-content`, `#detail`, `.detail-content`, `.ssd-module-detail`, `.ssd-module-wrap`, `.ssd-module`, and `.detail`.
- Image filtering must return explicit keep/drop reasons.
- Product consistency must block uploads when current page product ID differs from the capture product ID.
- Audit logs are emitted through `desktop-read.log` with `jd-detail-summary` and `jd-detail-image` records.

## Stable Data Contract

The collector contract is defined in:

`gravops-desktop-shell/Scripts/jdImageCollector/types.ts`

The final image result must preserve:

- `captureId`
- `productId`
- optional `skuId`
- `pageUrl`
- `title`
- `mainImages`
- `detailImages`
- `warnings`
- `errors`
- optional `debug`

Each image must preserve:

- `url`
- `source`
- width/height when known
- `captureId`
- `productId`
- optional `skuId`
- `keepReason`

## Regression Gate

Before modifying any of these files, run:

```bash
npm run test:jd-image
```

Protected core files:

- `gravops-desktop-shell/Scripts/jd-webview-reader.js`
- `gravops-desktop-shell/MainForm.cs`
- `gravops-desktop-shell/Scripts/jdImageCollector/collectDetailImages.ts`
- `gravops-desktop-shell/Scripts/jdImageCollector/networkCapture.ts`
- `gravops-desktop-shell/Scripts/jdImageCollector/imageFilter.ts`
- `gravops-desktop-shell/Scripts/jdImageCollector/productConsistencyCheck.ts`

## Debug Logging

Set:

```text
JD_IMAGE_DEBUG=true
```

The code must preserve logging for:

- `captureId`
- product ID
- SKU
- current URL
- main image count
- detail HTML image count
- detail DOM image count
- network fallback image count
- final detail image count
- per-image source
- per-image keep/drop reason

## Recovery

To return to the stable runtime:

```powershell
git checkout feature/auto-publish-rpa-v3
git reset --hard jd-image-reader-stable-v1
```
