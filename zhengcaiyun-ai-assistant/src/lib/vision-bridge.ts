
/**
 * 视觉桥接工具
 * 连接插件前端、背景脚本和后端视觉 AI
 */

export interface ActionResponse {
    target: string;
    action: 'click' | 'input' | 'wait';
    point: { x: number; y: number };
    reason: string;
    confidence: number;
}

export const VisionBridge = {
    /**
     * 获取全屏截图
     */
    async captureScreenshot(): Promise<string> {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: 'capturePage' }, (response) => {
                if (response?.error) {
                    reject(new Error(response.error));
                } else if (response?.imageBase64) {
                    resolve(response.imageBase64);
                } else {
                    reject(new Error('未知截图错误'));
                }
            });
        });
    },

    /**
     * 调用后端视觉 AI 分析
     */
    async askAI(screenshot: string, task: string, context?: string): Promise<ActionResponse> {
        // 获取 API 配置
        const config = await new Promise<{ baseUrl: string }>(r =>
            chrome.storage.local.get(['apiUrl'], res => r({
                baseUrl: res.apiUrl || process.env.PLASMO_PUBLIC_BACKEND_URL || 'http://localhost:3000'
            }))
        );

        return new Promise((resolve, reject) => {
            // 使用 API_PROXY 绕过同源限制
            chrome.runtime.sendMessage({
                type: 'API_PROXY',
                url: `${config.baseUrl}/api/vision/agent`,
                method: 'POST',
                body: { screenshot, task, context }
            }, (response) => {
                if (response?.ok) {
                    resolve(response.data);
                } else {
                    reject(new Error(response?.error || 'AI 分析请求失败'));
                }
            });
        });
    },

    /**
     * 模拟点击（基于坐标百分比）
     */
    async clickPoint(point: { x: number; y: number }) {
        const width = window.innerWidth;
        const height = window.innerHeight;

        const clientX = point.x * width;
        const clientY = point.y * height;

        console.log(`[Vision Agent] 执行点击坐标: (${Math.round(clientX)}, ${Math.round(clientY)})`);

        // 创建视觉指示器（小圆圈）
        const dot = document.createElement('div');
        dot.style.position = 'fixed';
        dot.style.left = `${clientX - 10}px`;
        dot.style.top = `${clientY - 10}px`;
        dot.style.width = '20px';
        dot.style.height = '20px';
        dot.style.borderRadius = '50%';
        dot.style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
        dot.style.border = '2px solid red';
        dot.style.zIndex = '999999';
        dot.style.pointerEvents = 'none';
        dot.style.transition = 'all 0.3s ease-out';
        document.body.appendChild(dot);

        // 模拟点击事件
        const el = document.elementFromPoint(clientX, clientY) as HTMLElement;
        if (el) {
            console.log(`[Vision Agent] 命中元素:`, el.tagName, el.innerText?.substring(0, 20));
            // 原生事件触发
            el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX, clientY }));
            el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX, clientY }));
            el.click();
        }

        // 动画效果后移除
        setTimeout(() => {
            dot.style.transform = 'scale(2)';
            dot.style.opacity = '0';
            setTimeout(() => dot.remove(), 300);
        }, 500);
    },

    /**
     * 执行视觉任务（高层入口）
     */
    async performTask(task: string, context?: string): Promise<boolean> {
        console.log(`[Vision Agent] 开始视觉补救任务: "${task}"`);
        try {
            const screenshot = await this.captureScreenshot();
            const response = await this.askAI(screenshot, task, context);

            console.log(`[Vision Agent] AI 决定: ${response.action} -> ${response.target} (${response.reason})`);

            if (response.action === 'click' && response.point) {
                await this.clickPoint(response.point);
                return true;
            }

            return false;
        } catch (error) {
            console.error(`[Vision Agent] 任务失败:`, error);
            return false;
        }
    }
}
