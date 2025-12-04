import { Queue, Worker, Job } from "bullmq";
import Redis from "ioredis";
import axios from "axios";
import { prisma } from "../lib/prisma";
import { chromium, BrowserContext, Page } from "playwright";
import path from "path";

const connection = new Redis({
  host: "localhost",
  port: 6379,
  maxRetriesPerRequest: null,
  retryStrategy: () => null
});

const collectQueue = new Queue("zcy-collect", { connection });
const publishQueue = new Queue("zcy-publish", { connection });

type CollectJob = { draftId: string; url: string; userId?: string };

type ZcyEndpoints = {
  item: string;
  params: string;
  stock: string;
  service: string;
  shipping: string;
  suppliers: string;
  brand?: string;
  privilege?: string;
};

type ZcyCollected = {
  title?: string;
  categoryId?: string;
  brand?: string;
  model?: string;
  detailHtml?: string;
  images?: string[];
  attributes?: Record<string, string>;
  skuData?: any;
  endpoints: ZcyEndpoints;
};

// 优先环境变量，其次读取 zcy-publisher 保存的 cookie 文件，避免手动反复粘贴
let ZCY_COOKIE = process.env.ZCY_COOKIE || "";
if (!ZCY_COOKIE) {
  const cookiePath = "../zcy-publisher/cookies/zcy-cookies.json";
  try {
    // 简单读取并拼成请求头格式
    // 文件格式是 Playwright 导出的数组，每项包含 name/value/domain/path 等
    // 我们将 name=value; 拼接为 Cookie 头
    // 仅在环境变量未设置时使用
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const raw = require(cookiePath);
    if (Array.isArray(raw)) {
      ZCY_COOKIE = raw.map((c: any) => `${c.name}=${c.value}`).join("; ");
      console.log("[Collector] Loaded cookie from", cookiePath);
    }
  } catch (e) {
    console.warn("[Collector] No ZCY_COOKIE env and failed to load cookie file", (e as any)?.message || e);
  }
}
const ZCY_REGION = process.env.ZCY_REGION || "630102";
const ZCY_INSTANCE = process.env.ZCY_INSTANCE || "ZJWC";
const ZCY_DISTRICT = process.env.ZCY_DISTRICT || "339900";

const axiosClient = axios.create({
  baseURL: "https://www.zcygov.cn",
  timeout: 15000,
  headers: {
    Cookie: ZCY_COOKIE,
    Origin: "https://www.zcygov.cn",
    Referer: "https://www.zcygov.cn/",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  },
  withCredentials: true
});

// 简单写入调试日志，便于查看返回是否被反爬
import fs from "fs";
function debugLog(label: string, content: any) {
  try {
    fs.appendFileSync(
      "crawler_debug.log",
      `\n[${new Date().toISOString()}] ${label}\n${typeof content === "string"
        ? content.slice(0, 800)
        : JSON.stringify(content, null, 2).slice(0, 800)
      }\n`
    );
  } catch {
    // ignore file write errors
  }
}

// Playwright 持久化上下文，复用你本地 Chrome 登录态，绕过 WAF
let pwContext: BrowserContext | null = null;
let pwPage: Page | null = null;
const USER_DATA_DIR =
  process.env.BROWSER_USER_DATA_DIR ||
  (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, "AppData", "Local", "Google", "Chrome", "User Data") : "");

async function getPlaywrightPage(): Promise<Page | null> {
  if (!USER_DATA_DIR) return null;
  try {
    if (!pwContext) {
      pwContext = await chromium.launchPersistentContext(USER_DATA_DIR, {
        channel: "chrome",
        headless: true
      });
      pwPage = await pwContext.newPage();
      console.log("[Collector] Playwright context opened with user data dir:", USER_DATA_DIR);
    } else if (!pwPage) {
      pwPage = await pwContext.newPage();
    }
    return pwPage;
  } catch (e) {
    console.warn("[Collector] Playwright context init failed", (e as any)?.message || e);
    return null;
  }
}

async function fetchJsonWithPlaywright<T>(url: string): Promise<T | null> {
  const page = await getPlaywrightPage();
  if (!page) return null;
  try {
    const result = await page.evaluate(
      async (u) => {
        const res = await fetch(u, { credentials: "include" });
        const txt = await res.text();
        try {
          return JSON.parse(txt);
        } catch {
          return { __raw__: txt };
        }
      },
      url
    );
    if (result && typeof result === "object" && !(result as any).__raw__) {
      return result as T;
    }
    debugLog(`pw_html_response ${url}`, (result as any)?.__raw__ || result);
    console.warn("[Collector] Playwright fetch non-JSON for", url);
    return null;
  } catch (e) {
    console.warn("[Collector] Playwright fetch failed", url, (e as any)?.message || e);
    return null;
  }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await axiosClient.get(url);
    // 如果返回的不是 JSON 对象，记录一份内容，方便排查是否被反爬或跳登录页
    if (typeof res.data === "string") {
      debugLog(`html_response ${url}`, res.data);
      console.warn("[Collector] non-JSON response for", url);
      return null;
    }
    return res.data as T;
  } catch (e) {
    const err = e as any;
    const status = err?.response?.status;
    const data = err?.response?.data;
    console.error("[Collector] request failed", url, status, err?.message);
    if (data) debugLog(`error_response ${url}`, data);
    return null;
  }
}

function extractItemId(url: string): string | null {
  const m = url.match(/\/items\/(\d+)/);
  return m ? m[1] : null;
}

async function collectZcy(itemId: string): Promise<ZcyCollected> {
  const ts = Date.now();
  const base = `/front/detail/item/${itemId}`;

  // 先走 axios，如果被反爬则 fallback 到 Playwright
  const fetchMaybe = async (u: string) => {
    const r1 = await fetchJson<any>(u);
    if (r1) return r1;
    const r2 = await fetchJsonWithPlaywright<any>(`https://www.zcygov.cn${u}`);
    return r2;
  };

  const item = await fetchMaybe(`${base}?timestamp=${ts}&zjxwcFlag=true`);
  const params = await fetchMaybe(`/front/detail/item/param?timestamp=${ts}&itemId=${itemId}`);
  const stock = await fetchMaybe(
    `/front/detail/item/stock?timestamp=${ts}&itemId=${itemId}&region=${ZCY_REGION}&itemInstanceCode=${ZCY_INSTANCE}`
  );
  const service = await fetchMaybe(
    `/front/detail/item/service?timestamp=${ts}&itemId=${itemId}&region=${ZCY_REGION}`
  );
  const shipping = await fetchMaybe(
    `/front/detail/shipping-method?timestamp=${ts}&itemId=${itemId}&region=${ZCY_REGION}&instanceCode=${ZCY_INSTANCE}`
  );
  const suppliers = await fetchMaybe(
    `/front/detail/item/supplier/list?timestamp=${ts}&itemId=${itemId}&industryCode=002&instanceCode=${ZCY_INSTANCE}&isLCBiddingItem=false`
  );

  const firstBrand = item?.data?.categoryBrandList?.[0];
  const brandInfo =
    firstBrand && firstBrand.brandId && firstBrand.categoryId && firstBrand.supplierOrgId
      ? await fetchJson<any>(
        `/front/detail/item/BrandInfo?timestamp=${ts}&itemId=${itemId}&brandId=${firstBrand.brandId}&categoryId=${firstBrand.categoryId}&supplierOrgId=${firstBrand.supplierOrgId}`
      )
      : null;

  const title = item?.data?.title ?? item?.data?.itemTitle;
  const images: string[] = item?.data?.imgs || [];
  const detailHtml: string | undefined = item?.data?.detailInfo;

  const attrs: Record<string, string> = {};
  const specs = params?.data?.specs || [];
  specs.forEach((s: any) => {
    if (s?.key && s?.value) attrs[s.key] = s.value;
  });

  const skuData = {
    stock: stock?.data,
    service: service?.data,
    shipping: shipping?.data,
    suppliers: suppliers?.data
  };

  return {
    title,
    categoryId: item?.data?.categoryId,
    brand: brandInfo?.data?.brandName || firstBrand?.brandName,
    model: attrs["型号"] || attrs["型號"] || attrs["型号/规格"] || undefined,
    detailHtml,
    images,
    attributes: attrs,
    skuData,
    endpoints: {
      item: `${base}?timestamp=${ts}&zjxwcFlag=true`,
      params: `/front/detail/item/param?timestamp=${ts}&itemId=${itemId}`,
      stock: `/front/detail/item/stock?timestamp=${ts}&itemId=${itemId}&region=${ZCY_REGION}&itemInstanceCode=${ZCY_INSTANCE}`,
      service: `/front/detail/item/service?timestamp=${ts}&itemId=${itemId}&region=${ZCY_REGION}`,
      shipping: `/front/detail/shipping-method?timestamp=${ts}&itemId=${itemId}&region=${ZCY_REGION}&instanceCode=${ZCY_INSTANCE}`,
      suppliers: `/front/detail/item/supplier/list?timestamp=${ts}&itemId=${itemId}&industryCode=002&instanceCode=${ZCY_INSTANCE}&isLCBiddingItem=false`,
      brand: brandInfo
        ? `/front/detail/item/BrandInfo?timestamp=${ts}&itemId=${itemId}&brandId=${firstBrand.brandId}&categoryId=${firstBrand.categoryId}&supplierOrgId=${firstBrand.supplierOrgId}`
        : undefined
    }
  };
}

const worker = new Worker(
  "zcy-collect",
  async (job: Job<CollectJob>) => {
    const { draftId, url, userId } = job.data;
    console.log(`📥 [Collector] draft ${draftId} url ${url}`);

    const itemId = extractItemId(url);
    if (!itemId) {
      console.error("⚠️ [Collector] invalid item url", url);
      await prisma.productDraft.update({
        where: { id: draftId },
        data: { status: "failed", updatedAt: new Date(), detailHtml: "Invalid item URL" }
      });
      throw new Error("Invalid item URL");
    }

    if (!ZCY_COOKIE) {
      console.error("⚠️ [Collector] ZCY_COOKIE not set (env or ../zcy-publisher/cookies/zcy-cookies.json)");
      await prisma.productDraft.update({
        where: { id: draftId },
        data: { status: "failed", updatedAt: new Date(), detailHtml: "ZCY_COOKIE not set" }
      });
      throw new Error("ZCY_COOKIE not set");
    }

    const collected = await collectZcy(itemId);
    if (!collected.title && !collected.images?.length) {
      console.warn("[Collector] Empty data collected for", itemId, "check cookie/permissions");
      debugLog(`empty_collect item ${itemId}`, {
        endpoints: collected.endpoints,
        note: "title/images empty; likely cookie/anti-bot"
      });
    }

    await prisma.productDraft.update({
      where: { id: draftId },
      data: {
        title: collected.title || url,
        originalUrl: url,
        originalId: itemId,
        status: "scraped",
        images: JSON.stringify(collected.images || []),
        attributes: JSON.stringify(collected.attributes || {}),
        skuData: JSON.stringify(collected.skuData || {}),
        detailHtml: collected.detailHtml || "",
        categoryId: collected.categoryId || null,
        brand: collected.brand || null,
        model: collected.model || null,
        updatedAt: new Date()
      }
    });

    await publishQueue.add(
      "publish",
      { draftId, userId },
      { jobId: `publish-${draftId}`, priority: 1 }
    );

    return { success: true, endpoints: collected.endpoints };
  },
  { connection, concurrency: 5 }
);

worker.on("completed", (job) => console.log(`🎉 [Collector] ${job.id} done`));
worker.on("failed", (job, err) => console.error(`⚠️ [Collector] ${job?.id} failed`, err));

console.log("🚀 Collector worker started (queue: zcy-collect)");
