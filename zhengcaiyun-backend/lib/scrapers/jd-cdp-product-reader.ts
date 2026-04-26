import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

export interface JDProductData {
  title: string;
  price: string;
  images: string[];
  detailImages: string[];
  detailHtml: string;
  skuData: {
    price: string;
    stock: string;
    specs?: Record<string, string>;
    model?: string;
    skuId?: string;
    specGroups?: unknown[];
    selectedSaleSpecs?: unknown[];
    skuSpecs?: unknown[];
    skuList?: Array<{
      skuId: string;
      model: string;
      price: number;
      stock: string;
      specs?: Record<string, string>;
    }>;
  };
  attributes: Record<string, string>;
  brand?: string;
  model?: string;
  categoryPath?: string[];
  shopName?: string;
}

export async function readJdProductViaCdp(productUrl: string): Promise<JDProductData> {
  const prototypeRoot = path.resolve(process.cwd(), '..', 'zcy-desktop-prototype');
  const scriptPath = path.join(prototypeRoot, 'src', 'collect-jd-cdp.mjs');

  if (!fs.existsSync(scriptPath)) {
    throw new Error(`JD CDP reader not found: ${scriptPath}`);
  }

  const stdout = await runNode(prototypeRoot, ['src/collect-jd-cdp.mjs', '--url', productUrl]);
  const parsed = parseJsonFromStdout(stdout);
  const data = parsed.scrapedData || {};
  const attributes = normalizeAttributes(data.attributes || data.specs || {});
  const selectedSpecs = Array.isArray(data.selectedSaleSpecs) ? data.selectedSaleSpecs : [];
  const selectedSpecMap = Object.fromEntries(
    selectedSpecs
      .map((item: any) => [String(item?.name || ''), String(item?.value || '')])
      .filter((entry: string[]) => entry[0] && entry[1])
  );
  const model = String(data.model || parsed.model || data.itemNo || data.skuId || '');
  const skuId = String(data.skuId || parsed.product?.info?.skuId || '');
  const detailImages = Array.isArray(data.detailImages) ? data.detailImages.filter(Boolean) : [];
  const images = Array.isArray(data.images) ? data.images.filter(Boolean) : [];
  const title = String(data.title || parsed.title || '').trim();

  if (!title || isLoginOrBlockedPage(parsed)) {
    throw new Error('JD page is not readable. Please make sure the local browser is logged in and the product page opened normally.');
  }

  if (images.length === 0) {
    throw new Error('JD product reader did not return any main images.');
  }

  return {
    title,
    price: '0',
    images,
    detailImages,
    detailHtml: buildDetailHtml(detailImages),
    attributes,
    brand: String(data.brand || parsed.brand || ''),
    model,
    categoryPath: Array.isArray(data.categoryPath) ? data.categoryPath : [],
    skuData: {
      price: '0',
      stock: '99',
      skuId,
      model,
      specs: Object.keys(selectedSpecMap).length ? selectedSpecMap : attributes,
      specGroups: Array.isArray(data.specGroups) ? data.specGroups : [],
      selectedSaleSpecs: selectedSpecs,
      skuSpecs: Array.isArray(data.skuSpecs) ? data.skuSpecs : [],
      skuList: [
        {
          skuId: skuId || 'default',
          model: model || 'default',
          price: 0,
          stock: '99',
          specs: Object.keys(selectedSpecMap).length ? selectedSpecMap : attributes
        }
      ]
    },
    shopName: '京东'
  };
}

function runNode(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('JD CDP reader timed out'));
    }, 180_000);

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error((stderr || stdout || `JD CDP reader exited with ${code}`).slice(0, 1200)));
        return;
      }
      resolve(stdout);
    });
  });
}

function parseJsonFromStdout(stdout: string): any {
  const start = stdout.indexOf('{');
  if (start < 0) throw new Error('JD CDP reader did not return JSON');
  return JSON.parse(stdout.slice(start));
}

function normalizeAttributes(input: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (!key) continue;
    out[key] = String(value ?? '');
  }
  return out;
}

function isLoginOrBlockedPage(parsed: any): boolean {
  const title = String(parsed?.state?.title || parsed?.title || '');
  const bodyStart = String(parsed?.state?.bodyStart || '');
  const text = `${title}\n${bodyStart}`;
  return /登录|登陆|欢迎登录|passport\.jd\.com|访问受限|拒绝访问|Access Denied/i.test(text);
}

function buildDetailHtml(images: string[]): string {
  if (!images.length) return '';
  return images
    .map((src) => `<p><img src="${escapeHtml(src)}" style="max-width:100%;" /></p>`)
    .join('\n');
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
