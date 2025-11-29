/**
 * 批量上传管理器
 */

import { ProductData, uploadProduct } from './zcy-dom';
import { searchProductImages } from '../services/image-search';
import { analyzeCategory, captureScreenshot } from '../services/ai-service';

export interface BatchTask {
    id: string;
    product: ProductData;
    status: 'pending' | 'processing' | 'success' | 'failed';
    error?: string;
    progress: number;
}

export class BatchUploadManager {
    private tasks: Map<string, BatchTask> = new Map();
    private concurrency: number = 3;
    private running: number = 0;

    constructor(concurrency: number = 3) {
        this.concurrency = concurrency;
    }

    /**
     * 添加批量任务
     */
    addTasks(products: ProductData[]): string[] {
        const ids: string[] = [];

        products.forEach(product => {
            const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            this.tasks.set(id, {
                id,
                product,
                status: 'pending',
                progress: 0
            });
            ids.push(id);
        });

        return ids;
    }

    /**
     * 开始批量上传
     */
    async start(onProgress?: (task: BatchTask) => void): Promise<void> {
        const pendingTasks = Array.from(this.tasks.values())
            .filter(t => t.status === 'pending');

        for (const task of pendingTasks) {
            while (this.running >= this.concurrency) {
                await this.sleep(1000);
            }

            this.processTask(task, onProgress);
        }

        // 等待所有任务完成
        while (this.running > 0) {
            await this.sleep(1000);
        }
    }

    /**
     * 处理单个任务
     */
    private async processTask(
        task: BatchTask,
        onProgress?: (task: BatchTask) => void
    ): Promise<void> {
        this.running++;
        task.status = 'processing';

        try {
            // 1. 搜索图片
            task.progress = 10;
            onProgress?.(task);

            const images = await searchProductImages(task.product.name, 3);

            // 2. AI识别类目
            task.progress = 40;
            onProgress?.(task);

            const screenshot = await captureScreenshot();
            const category = await analyzeCategory(screenshot, task.product.name);

            // 3. 上传
            task.progress = 70;
            onProgress?.(task);

            const result = await uploadProduct({
                ...task.product,
                category: category.category,
                images: images.map(img => img.url)
            });

            if (result.success) {
                task.status = 'success';
                task.progress = 100;
            } else {
                task.status = 'failed';
                task.error = result.error;
            }

        } catch (error) {
            task.status = 'failed';
            task.error = error instanceof Error ? error.message : '未知错误';
        } finally {
            onProgress?.(task);
            this.running--;
        }
    }

    /**
     * 获取所有任务状态
     */
    getTasks(): BatchTask[] {
        return Array.from(this.tasks.values());
    }

    /**
     * 获取统计信息
     */
    getStats() {
        const tasks = this.getTasks();
        return {
            total: tasks.length,
            pending: tasks.filter(t => t.status === 'pending').length,
            processing: tasks.filter(t => t.status === 'processing').length,
            success: tasks.filter(t => t.status === 'success').length,
            failed: tasks.filter(t => t.status === 'failed').length
        };
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
