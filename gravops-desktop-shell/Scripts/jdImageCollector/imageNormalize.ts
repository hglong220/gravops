// Stable core module. Run `npm run test:jd-image` before changing this file.

export function normalizeJdImageUrl(raw: string, mode: 'main' | 'detail' = 'detail'): string {
  let url = String(raw || '').trim().replace(/^url\(["']?|["']?\)$/g, '');
  if (!url || url.startsWith('data:') || url === 'about:blank') return '';
  url = url.replace(/\\\//g, '/').replace(/&amp;/g, '&');
  if (url.startsWith('//')) url = `https:${url}`;
  if (url.startsWith('/jfs/')) url = `https://img10.360buyimg.com/${mode === 'main' ? 'n1' : 'sku'}${url}`;
  if (url.startsWith('jfs/')) url = `https://img10.360buyimg.com/${mode === 'main' ? 'n1' : 'sku'}/${url}`;
  if (/^s\d+x\d+_jfs\//i.test(url)) url = `https://img10.360buyimg.com/${mode === 'main' ? 'n1' : 'sku'}/${url}`;

  try {
    url = new URL(url, 'https://item.jd.com/').href;
  } catch {
    return '';
  }

  if (!/360buyimg\.com/i.test(url)) return '';
  url = url
    .replace(/^http:/i, 'https:')
    .replace(/^https:\/\/img\d+\.360buyimg\.com\//i, 'https://img10.360buyimg.com/')
    .replace(/\.(avif|webp)(?=$|\?)/i, '');

  if (url.includes('/pcpubliccms/')) {
    return url.replace(/\/s\d+x\d+_jfs\//gi, '/s1440x1440_jfs/');
  }

  if (mode === 'main') {
    return url
      .replace(/\/s\d+x\d+_jfs\//gi, '/n1/jfs/')
      .replace(/\/s\d+x\d+_/gi, '/n1/')
      .replace(/\/n\d+\//gi, '/n1/');
  }

  return url
    .replace(/\/sku\/sku\/jfs\//gi, '/sku/jfs/')
    .replace(/\/n\d+\/sku\/jfs\//gi, '/sku/jfs/')
    .replace(/\/s\d+x\d+_jfs\//gi, '/sku/jfs/')
    .replace(/\/s\d+x\d+_(jfs|t\d+)\//gi, '/$1/');
}

export function canonicalImageKey(url: string): string {
  return normalizeJdImageUrl(url, 'detail')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/s\d+x\d+_jfs\//g, '/jfs/')
    .replace(/\/(?:n0|n1|n2|n5|n7|n9|sku)\/jfs\//g, '/jfs/')
    .replace(/[?#].*$/, '');
}

export function urlPayloadSize(url: string): number {
  try {
    const parts = new URL(String(url || ''), 'https://item.jd.com/').pathname.split('/').filter(Boolean);
    const fileIndex = parts.findIndex((part) => /\.(?:jpg|jpeg|png|gif)$/i.test(part));
    const beforeFile = fileIndex >= 0 ? parts.slice(0, fileIndex) : parts;
    for (let i = beforeFile.length - 1; i >= 0; i -= 1) {
      if (/^\d+$/.test(beforeFile[i])) return Number(beforeFile[i]);
    }
  } catch {
    const match = String(url || '').match(/\/(\d+)\/[^/]+\.(?:jpg|jpeg|png|gif)$/i);
    if (match) return Number(match[1]);
  }
  return 0;
}
