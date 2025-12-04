import { Queue, Worker } from "bullmq";
import Redis from "ioredis";

const connection = new Redis({
    host: "localhost",
    port: 6379,
    maxRetriesPerRequest: null,
});

const queue = new Queue("zcy-publish", { connection });

async function main() {
    console.log("🔌 Connecting to Redis...");
    await connection.ping();
    console.log("✅ Redis connected");

    console.log("📥 Adding test job...");
    const job = await queue.add("test-job", {
        draftId: "test-123",
        userId: "user-test",
        title: "Test Product"
    });
    console.log(`✅ Job added: ${job.id}`);

    const counts = await queue.getJobCounts();
    console.log("📊 Queue counts:", counts);

    console.log("👷 Starting test worker...");

    const worker = new Worker("zcy-publish", async (job) => {
        console.log(`🎉 Processing job ${job.id}`);
        return { success: true };
    }, { connection });

    worker.on("completed", (job) => {
        console.log(`✅ Job ${job.id} completed`);
    });

    worker.on("failed", (job, err) => {
        console.log(`❌ Job ${job?.id} failed: ${err.message}`);
    });

    worker.on("error", (err) => {
        console.error("❌ Worker error:", err);
    });

    // Keep alive for a bit
    await new Promise(resolve => setTimeout(resolve, 10000));
    await worker.close();
    process.exit(0);
}

main().catch(console.error);
