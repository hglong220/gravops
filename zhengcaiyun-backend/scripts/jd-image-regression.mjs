import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = path.resolve(process.cwd(), '..');
const backendRoot = process.cwd();
const fixturePath = path.join(backendRoot, 'tests', 'jd-image', 'fixtures', 'cases.json');
const snapshotPath = path.join(backendRoot, 'tests', 'jd-image', 'snapshots', 'stable-v1.json');
const collectorRoot = path.join(repoRoot, 'gravops-desktop-shell', 'Scripts', 'jdImageCollector');
const runtimeReader = path.join(repoRoot, 'gravops-desktop-shell', 'Scripts', 'jd-webview-reader.js');
const desktopShell = path.join(repoRoot, 'gravops-desktop-shell', 'MainForm.cs');

const requiredCollectorFiles = [
  'index.ts',
  'collectMainImages.ts',
  'collectDetailImages.ts',
  'networkCapture.ts',
  'extractFromDetailHtml.ts',
  'extractFromDom.ts',
  'imageFilter.ts',
  'imageNormalize.ts',
  'productConsistencyCheck.ts',
  'debugLogger.ts',
  'healthCheck.ts',
  'types.ts'
];

function fail(message) {
  throw new Error(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function countOccurrences(text, pattern) {
  return (text.match(pattern) || []).length;
}

function validateFixtureCases(cases) {
  assert(Array.isArray(cases), 'fixture cases must be an array');
  assert(cases.length >= 10, `expected at least 10 JD image cases, got ${cases.length}`);

  const ids = new Set();
  for (const item of cases) {
    assert(item.id && typeof item.id === 'string', 'case id is required');
    assert(!ids.has(item.id), `duplicate case id: ${item.id}`);
    ids.add(item.id);
    assert(/^https:\/\/item\.jd\.com\/\d+\.html/.test(item.productUrl), `invalid JD product URL for ${item.id}`);
    assert(Number.isInteger(item.expectedMainImages?.min), `expectedMainImages.min missing for ${item.id}`);
    assert(Number.isInteger(item.expectedDetailImages?.min), `expectedDetailImages.min missing for ${item.id}`);
    assert(Array.isArray(item.forbiddenBrandKeywords), `forbiddenBrandKeywords missing for ${item.id}`);
    assert(Array.isArray(item.forbiddenPreviousProductImages), `forbiddenPreviousProductImages missing for ${item.id}`);
  }

  const descriptions = cases.map((item) => item.description).join('\n');
  [
    '普通京东自营商品',
    'pcpubliccms',
    'imgzone/jfs',
    '懒加载',
    '详情接口有图',
    '推荐商品/广告图',
    '多 SKU',
    'SPU 通用详情',
    '连续采集',
    '详情图为空'
  ].forEach((needle) => assert(descriptions.includes(needle), `missing regression category: ${needle}`));
}

function validateSnapshots(snapshot) {
  assert(snapshot.tag === 'jd-image-reader-stable-v1', 'snapshot tag mismatch');
  assert(snapshot.commit === 'bfb65b6', 'snapshot commit must record the frozen stable commit');
  assert(Array.isArray(snapshot.snapshots) && snapshot.snapshots.length > 0, 'snapshots missing');

  for (const item of snapshot.snapshots) {
    assert(item.productId, `snapshot ${item.id} missing productId`);
    assert(Array.isArray(item.mainImages), `snapshot ${item.id} missing mainImages`);
    assert(Array.isArray(item.detailImages), `snapshot ${item.id} missing detailImages`);
    assert(item.sourceDistribution && typeof item.sourceDistribution === 'object', `snapshot ${item.id} missing sourceDistribution`);
    assert(Array.isArray(item.warnings), `snapshot ${item.id} missing warnings`);
    assert(Array.isArray(item.errors), `snapshot ${item.id} missing errors`);
  }
}

function validateCollectorBoundary() {
  for (const file of requiredCollectorFiles) {
    assert(fs.existsSync(path.join(collectorRoot, file)), `missing collector module: ${file}`);
  }

  const index = fs.readFileSync(path.join(collectorRoot, 'index.ts'), 'utf8');
  assert(index.includes('collectJdProductImages'), 'collector index must expose collectJdProductImages');
  assert(index.includes('must pass `npm run test:jd-image`'), 'collector index must document regression gate');

  const types = fs.readFileSync(path.join(collectorRoot, 'types.ts'), 'utf8');
  [
    'JdImageCollectResult',
    'ImageRecord',
    'captureId',
    'productId',
    'mainImages',
    'detailImages',
    "'main_dom'",
    "'main_script'",
    "'detail_html'",
    "'detail_dom'",
    "'network_fallback'"
  ].forEach((needle) => assert(types.includes(needle), `types.ts missing contract token: ${needle}`));

  const filter = fs.readFileSync(path.join(collectorRoot, 'imageFilter.ts'), 'utf8');
  assert(filter.includes('ImageFilterDecision'), 'imageFilter must return ImageFilterDecision');
  assert(filter.includes('reason'), 'imageFilter must return reasons, not boolean only');

  const consistency = fs.readFileSync(path.join(collectorRoot, 'productConsistencyCheck.ts'), 'utf8');
  assert(consistency.includes('当前页面商品状态不一致'), 'consistency check must refuse product mismatches');

  const health = fs.readFileSync(path.join(collectorRoot, 'healthCheck.ts'), 'utf8');
  [
    'main-images-empty',
    'detail-images-empty',
    'capture-id-mismatch',
    'product-id-mismatch',
    'network-fallback-ratio-high',
    'detail-images-duplicate-main-images',
    'page-url-product-id-mismatch'
  ].forEach((needle) => assert(health.includes(needle), `healthCheck missing ${needle}`));
}

function validateRuntimeGuards() {
  const reader = fs.readFileSync(runtimeReader, 'utf8');
  const mainForm = fs.readFileSync(desktopShell, 'utf8');

  assert(reader.includes('captureId'), 'runtime reader must preserve captureId');
  assert(reader.includes('detail_html'), 'runtime reader must preserve detail_html source');
  assert(reader.includes('detail_dom'), 'runtime reader must preserve detail_dom source');
  assert(reader.includes('network_image'), 'runtime reader must preserve network fallback source');
  assert(reader.includes('consistencyOk'), 'runtime reader must preserve consistency check output');
  assert(reader.includes('network-fallback-not-needed'), 'runtime reader must prevent unnecessary network fallback');
  assert(countOccurrences(reader, /detail_html/g) >= 8, 'detail_html handling appears to have regressed');
  assert(countOccurrences(reader, /detail_dom/g) >= 8, 'detail_dom handling appears to have regressed');

  assert(mainForm.includes('BeginJdCapture'), 'desktop shell must isolate captures');
  assert(mainForm.includes('SnapshotJdNetworkCaptures(captureId)'), 'desktop shell must snapshot by captureId');
  assert(mainForm.includes('ParseScriptInt64'), 'desktop shell must tolerate WebView script result types');
  assert(mainForm.includes('当前页面商品状态不一致'), 'desktop shell must block inconsistent product uploads');
  assert(mainForm.includes('jd-detail-summary'), 'desktop shell must emit detail summary logs');
  assert(mainForm.includes('jd-detail-image'), 'desktop shell must emit per-image audit logs');
}

function validateLiveReportIfPresent() {
  const reportPath = path.join(backendRoot, 'tests', 'jd-image', 'last-live-report.json');
  if (!fs.existsSync(reportPath)) return { skipped: true };

  const report = readJson(reportPath);
  assert(Array.isArray(report.results), 'last-live-report results missing');
  for (const item of report.results) {
    assert(item.captureId, `live result ${item.id} missing captureId`);
    assert(item.productId, `live result ${item.id} missing productId`);
    assert(item.mainImages?.length >= item.expectedMainImages.min, `live result ${item.id} main images below minimum`);
    assert(item.detailImages?.length >= item.expectedDetailImages.min, `live result ${item.id} detail images below minimum`);
    assert(new Set([...item.mainImages, ...item.detailImages].map((img) => img.captureId)).size === 1, `live result ${item.id} captureId mismatch`);
    assert(new Set([...item.mainImages, ...item.detailImages].map((img) => img.productId)).size === 1, `live result ${item.id} productId mismatch`);
  }
  return { skipped: false };
}

const cases = readJson(fixturePath);
const snapshots = readJson(snapshotPath);

validateFixtureCases(cases);
validateSnapshots(snapshots);
validateCollectorBoundary();
validateRuntimeGuards();
const live = validateLiveReportIfPresent();

console.log('JD image regression report');
console.log(`- fixed cases: ${cases.length}`);
console.log(`- snapshot file: ${path.relative(backendRoot, snapshotPath)}`);
console.log(`- collector modules: ${requiredCollectorFiles.length}`);
console.log(`- runtime guards: ok`);
console.log(`- live report: ${live.skipped ? 'not present, static guard only' : 'validated'}`);
