import { Queue, Worker, Job } from "bullmq";
import Redis from "ioredis";
import { spawn } from "child_process";
import { prisma } from "../lib/prisma";

interface ProductDraft {
  id: string;
  userId: string;
  originalUrl?: string;
  originalId?: string;
  shopName?: string;
  title: string;
  categoryPath?: string;
  categoryId?: string;
  brand?: string;
  model?: string;
  images?: string; // JSON stringified string[]
  attributes?: string; // JSON stringified Record<string, string>
  skuData?: string; // JSON stringified
  detailHtml?: string;
  status: string;
  publishUrl?: string;
  createdAt: string;
  updatedAt: string;
}

type PublishResult = { publishId: string; note?: string };

console.log("🔧 Initializing Redis connection...");
const connection = new Redis({
  host: "localhost",
  port: 6379,
  maxRetriesPerRequest: null,
  retryStrategy: () => null
});
console.log("✅ Redis connection initialized");

connection.on("connect", () => console.log("🔌 Redis connected!"));
connection.on("error", (err) => console.error("❗ Redis error:", err));

const publishQueue = new Queue("zcy-publish", { connection });

const worker = new Worker(
  "zcy-publish",
  async (job: Job) => {
    const { draftId, userId } = job.data as { draftId: string; userId?: string };
    console.log(`📥 [Worker ${process.pid}] Processing draft: ${draftId} user: ${userId ?? "-"}`);

    try {
      await markStatus(draftId, "processing");

      // 1. 获取草稿
      const draft = await fetchDraft(draftId);
      await job.updateProgress(20);

      // 2. 解析图片/属性
      const { images, attributes } = parseDraftData(draft);
      await job.updateProgress(40);

      // 3. 上传图片（当前直接复用原链接，如需上传 OSS 在此实现）
      const imageUrls = await uploadImages(images);
      await job.updateProgress(60);

      // 4. 发布到政采云（占位：调用外部发布逻辑）
      const result = await publishToZcy(draft, attributes, imageUrls);
      await job.updateProgress(90);

      // 5. 更新状态
      await updateProductStatus(draftId, "published", result);
      await job.updateProgress(100);

      console.log(`✅ [Worker ${process.pid}] Completed draft: ${draftId}`);
      return { success: true, result };
    } catch (error: any) {
      console.error(`⚠️ [Worker ${process.pid}] Failed draft: ${draftId}`, error);
      await markStatus(draftId, "failed", error?.message || String(error));
      throw error;
    }
  },
  {
    connection,
    concurrency: 10
  }
);

worker.on("completed", (job) => {
  console.log(`🎉 Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.log(`⚠️ Job ${job?.id} failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("Worker error:", err);
});

async function fetchDraft(draftId: string): Promise<ProductDraft> {
  const resp = await fetch(`http://localhost:3000/api/copy/get?id=${draftId}`);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`获取草稿失败 ${resp.status}: ${text}`);
  }
  const data = (await resp.json()) as { draft: ProductDraft };
  return data.draft;
}

function parseDraftData(draft: ProductDraft) {
  const images = draft.images ? (JSON.parse(draft.images) as string[]) : [];
  const attributes = draft.attributes ? (JSON.parse(draft.attributes) as Record<string, string>) : {};
  return { images, attributes };
}

async function uploadImages(images: string[]): Promise<string[]> {
  // TODO: 如需上传到 OSS/素材库，在这里实现；当前直接复用原始 URL
  return images;
}

async function publishToZcy(
  draft: ProductDraft,
  attributes: Record<string, string>,
  imageUrls: string[]
): Promise<PublishResult> {
  // 调用 zcy-publisher 脚本，复用 Playwright 发布逻辑
  const cmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  return new Promise<PublishResult>((resolve, reject) => {
    const child = spawn(cmd, ["exec", "ts-node", "src/index.ts", "--draft-id", draft.id], {
      cwd: "../zcy-publisher",
      stdio: "inherit",
      env: {
        ...process.env,
        TS_NODE_TRANSPILE_ONLY: "1"
      }
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ publishId: `ZCY-${draft.id}-${Date.now()}`, note: "published via zcy-publisher" });
      } else {
        reject(new Error(`zcy-publisher exited with code ${code}`));
      }
    });
  });
}

async function markStatus(draftId: string, status: string, note?: string) {
  try {
    await prisma.productDraft.update({
      where: { id: draftId },
      data: {
        status,
        publishUrl: note || undefined,
        updatedAt: new Date()
      }
    });
  } catch (e) {
    console.error(`⚠️ Failed to mark status ${status} for ${draftId}:`, e);
  }
}

async function updateProductStatus(draftId: string, status: string, result: PublishResult) {
  try {
    await prisma.productDraft.update({
      where: { id: draftId },
      data: {
        status,
        publishUrl: result?.publishId || result?.note,
        updatedAt: new Date()
      }
    });
  } catch (e) {
    console.error(`⚠️ Failed to update product status for ${draftId}:`, e);
  }
}

console.log("🚀 Worker started");
console.log("📊 Queue: zcy-publish | Concurrency: 10");
console.log("🔄 Retry/Backoff is handled by queue configuration when enqueueing");
