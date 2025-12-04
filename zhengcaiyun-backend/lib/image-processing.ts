/**
 * 图片智能处理服务
 * 策略：
 * 1. 优先从政采云找同款图片（100%合规）
 * 2. AI处理去水印
 * 3. 降级方案
 */

interface ImageResult {
    images: string[];
    source: 'zcy' | 'ai-processed' | 'original' | 'fallback';
    compliance: number;
    needManualReview: boolean;
    processingLog: string[];
}

export class ImageProcessingService {

    /**
     * 获取合规图片（核心方法）
     */
    async getComplianceImages(product: any): Promise<ImageResult> {
        const log: string[] = [];

        // 策略1：从政采云找同款（优先）⭐⭐⭐
        log.push('🔍 策略1: 在政采云搜索同款图片...');
        const zcyImages = await this.findFromZCY(product);

        if (zcyImages.length >= 3) {
            log.push(`✅ 找到政采云同款图片 ${zcyImages.length} 张`);

            return {
                images: zcyImages,
                source: 'zcy',
                compliance: 1.0,  // 100%合规
                needManualReview: false,
                processingLog: log
            };
        }

        log.push(`⚠️ 仅找到 ${zcyImages.length} 张政采云图片，不够用`);

        // 策略2：AI处理原图片 ⭐⭐
        log.push('🤖 策略2: AI处理原图片...');

        if (product.source === 'zcy') {
            // 政采云来的图片，直接用
            log.push('✅ 来源是政采云，图片100%合规');

            return {
                images: product.images,
                source: 'zcy',
                compliance: 1.0,
                needManualReview: false,
                processingLog: log
            };
        }

        const processedImages = await this.aiProcessImages(product.images);

        if (processedImages.compliance > 0.90) {
            log.push(`✅ AI处理完成，合规度: ${processedImages.compliance}`);

            return {
                images: processedImages.data,
                source: 'ai-processed',
                compliance: processedImages.compliance,
                needManualReview: processedImages.compliance < 0.95,
                processingLog: log
            };
        }

        // 策略3：放宽搜索条件，再次查找政采云 ⭐
        log.push('🔍 策略3: 放宽条件再次搜索政采云...');
        const relaxedResults = await this.findFromZCY(product, {
            similarityThreshold: 0.6,  // 降低相似度要求
            expandKeywords: true
        });

        if (relaxedResults.length >= 3) {
            log.push(`✅ 放宽条件后找到 ${relaxedResults.length} 张`);

            return {
                images: relaxedResults,
                source: 'zcy',
                compliance: 0.95,
                needManualReview: false,
                processingLog: log
            };
        }

        // 策略4：混合使用（政采云 + AI处理）
        log.push('⚠️ 策略4: 混合使用政采云图片和处理后的图片');
        const mixed = [...zcyImages, ...processedImages.data.slice(0, 5 - zcyImages.length)];

        return {
            images: mixed,
            source: 'fallback',
            compliance: 0.85,
            needManualReview: true,
            processingLog: log
        };
    }

    /**
     * 从政采云搜索同款图片
     */
    private async findFromZCY(
        product: any,
        options: {
            similarityThreshold?: number;
            expandKeywords?: boolean;
        } = {}
    ): Promise<string[]> {
        const threshold = options.similarityThreshold || 0.80;
        const images: string[] = [];

        try {
            // 提取搜索关键词
            const keywords = this.extractSearchKeywords(product.title, options.expandKeywords);

            console.log('🔍 政采云搜索关键词:', keywords);

            // 在政采云搜索
            for (const keyword of keywords) {
                const searchResults = await this.searchZCY(keyword);

                for (const item of searchResults) {
                    const similarity = this.calculateProductSimilarity(product, item);

                    if (similarity > threshold) {
                        console.log(`✅ 找到相似商品 (${(similarity * 100).toFixed(0)}%):`, item.title);

                        // 提取这个商品的图片
                        const itemImages = await this.extractZCYProductImages(item.url);
                        images.push(...itemImages);

                        // 找到足够图片就返回
                        if (images.length >= 5) {
                            return images.slice(0, 5);
                        }
                    }
                }

                // 如果已经找到足够图片，停止搜索
                if (images.length >= 5) break;
            }

        } catch (error) {
            console.error('政采云搜索失败:', error);
        }

        return images;
    }

    /**
     * 提取搜索关键词
     */
    private extractSearchKeywords(title: string, expand: boolean = false): string[] {
        const keywords: string[] = [];

        // 提取品牌
        const brand = this.extractBrand(title);
        // 提取型号
        const model = this.extractModel(title);
        // 提取类型
        const type = this.extractType(title);

        // 精确搜索
        if (brand && model) {
            keywords.push(`${brand} ${model}`);
        }

        // 扩展搜索
        if (expand) {
            if (model) keywords.push(model);
            if (brand && type) keywords.push(`${brand} ${type}`);
            if (type) keywords.push(type);
        }

        // 如果没有提取到，用前20个字符
        if (keywords.length === 0) {
            keywords.push(title.substring(0, 20));
        }

        return keywords;
    }

    /**
     * 在政采云搜索
     */
    private async searchZCY(keyword: string): Promise<any[]> {
        try {
            const response = await fetch('/api/search/zcy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keyword, limit: 20 })
            });

            if (response.ok) {
                const data = await response.json();
                return data.products || [];
            }
        } catch (error) {
            console.error('政采云搜索失败:', error);
        }

        return [];
    }

    /**
     * 提取政采云商品图片
     */
    private async extractZCYProductImages(url: string): Promise<string[]> {
        try {
            const response = await fetch('/api/extract/zcy-images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });

            if (response.ok) {
                const data = await response.json();
                return data.images || [];
            }
        } catch (error) {
            console.error('提取图片失败:', error);
        }

        return [];
    }

    /**
     * AI处理图片（去水印、去logo、去联系方式）
     */
    private async aiProcessImages(images: string[]): Promise<{
        data: string[];
        compliance: number;
    }> {
        const processed: string[] = [];
        let totalCompliance = 0;

        for (const imageUrl of images) {
            try {
                // 下载图片
                const imageBuffer = await this.downloadImage(imageUrl);

                // 检测问题
                const issues = await this.detectImageIssues(imageBuffer);

                let cleanedImage = imageBuffer;
                let compliance = 1.0;

                // 处理水印
                if (issues.hasWatermark) {
                    console.log('⚠️ 检测到水印，AI去除中...');
                    cleanedImage = await this.removeWatermark(cleanedImage);
                    compliance *= 0.90;
                }

                // 处理logo
                if (issues.hasLogo) {
                    console.log('⚠️ 检测到logo，AI去除中...');
                    cleanedImage = await this.removeLogo(cleanedImage);
                    compliance *= 0.90;
                }

                // 处理联系方式
                if (issues.hasContact) {
                    console.log('⚠️ 检测到联系方式，AI去除中...');
                    cleanedImage = await this.removeContact(cleanedImage);
                    compliance *= 0.85;
                }

                // 上传处理后的图片
                const processedUrl = await this.uploadProcessedImage(cleanedImage);
                processed.push(processedUrl);
                totalCompliance += compliance;

            } catch (error) {
                console.error('图片处理失败:', error);
                // 如果处理失败，使用原图（但合规度低）
                processed.push(imageUrl);
                totalCompliance += 0.5;
            }
        }

        return {
            data: processed,
            compliance: processed.length > 0 ? totalCompliance / processed.length : 0
        };
    }

    /**
     * 检测图片问题
     */
    private async detectImageIssues(imageBuffer: Buffer): Promise<{
        hasWatermark: boolean;
        hasLogo: boolean;
        hasContact: boolean;
        hasPrice: boolean;
    }> {
        try {
            const response = await fetch('/api/ai/detect-image-issues', {
                method: 'POST',
                body: imageBuffer,
                headers: { 'Content-Type': 'image/jpeg' }
            });

            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('图片检测失败:', error);
        }

        return {
            hasWatermark: false,
            hasLogo: false,
            hasContact: false,
            hasPrice: false
        };
    }

    /**
     * 下载图片
     */
    private async downloadImage(url: string): Promise<Buffer> {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }

    /**
     * 上传处理后的图片
     */
    private async uploadProcessedImage(imageBuffer: Buffer): Promise<string> {
        const formData = new FormData();
        formData.append('image', new Blob([imageBuffer]));

        const response = await fetch('/api/upload/image', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        return data.url;
    }

    /**
     * AI去水印
     */
    private async removeWatermark(imageBuffer: Buffer): Promise<Buffer> {
        const response = await fetch('/api/ai/remove-watermark', {
            method: 'POST',
            body: imageBuffer,
            headers: { 'Content-Type': 'image/jpeg' }
        });

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }

    /**
     * AI去logo
     */
    private async removeLogo(imageBuffer: Buffer): Promise<Buffer> {
        const response = await fetch('/api/ai/remove-logo', {
            method: 'POST',
            body: imageBuffer,
            headers: { 'Content-Type': 'image/jpeg' }
        });

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }

    /**
     * AI去联系方式
     */
    private async removeContact(imageBuffer: Buffer): Promise<Buffer> {
        const response = await fetch('/api/ai/remove-contact', {
            method: 'POST',
            body: imageBuffer,
            headers: { 'Content-Type': 'image/jpeg' }
        });

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }

    /**
     * 计算商品相似度
     */
    private calculateProductSimilarity(product1: any, product2: any): number {
        const title1 = product1.title.toLowerCase();
        const title2 = product2.title.toLowerCase();

        // 提取关键特征
        const brand1 = this.extractBrand(title1);
        const brand2 = this.extractBrand(title2);
        const model1 = this.extractModel(title1);
        const model2 = this.extractModel(title2);

        let score = 0;

        // 品牌匹配（权重40%）
        if (brand1 && brand2 && brand1 === brand2) {
            score += 0.4;
        }

        // 型号匹配（权重50%）
        if (model1 && model2 && model1 === model2) {
            score += 0.5;
        }

        // 关键词匹配（权重10%）
        const words1 = title1.split(/\s+/);
        const words2 = title2.split(/\s+/);
        let matchCount = 0;

        words1.forEach(w1 => {
            if (w1.length > 2 && words2.some(w2 => w2.includes(w1) || w1.includes(w2))) {
                matchCount++;
            }
        });

        score += (matchCount / Math.max(words1.length, words2.length)) * 0.1;

        return score;
    }

    private extractBrand(text: string): string | null {
        const brands = ['联想', '华为', '小米', 'apple', 'thinkpad', '戴尔', '惠普', 'hp', 'dell', 'lenovo'];
        for (const brand of brands) {
            if (text.includes(brand)) return brand;
        }
        return null;
    }

    private extractModel(text: string): string | null {
        const match = text.match(/([a-z0-9]{2,}[-\s]?[a-z0-9]*)/i);
        return match ? match[0].toLowerCase() : null;
    }

    private extractType(text: string): string | null {
        const types = ['笔记本', '台式机', '鼠标', '键盘', '显示器', '打印机'];
        for (const type of types) {
            if (text.includes(type)) return type;
        }
        return null;
    }
}

export default new ImageProcessingService();
