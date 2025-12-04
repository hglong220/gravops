/**
 * 用户授权类目抓取服务
 * 从政采云抓取用户有权限的类目
 */

import { chromium, Browser, Page } from 'playwright';

interface AuthorizedCategory {
    id: number;
    name: string;
    categoryCode: string;
    level: number;
    hasChildren: boolean;
    authed: true;
}

export class UserCategoryService {

    private browser: Browser | null = null;
    private page: Page | null = null;

    /**
     * 初始化浏览器
     */
    async init() {
        if (!this.browser) {
            this.browser = await chromium.launch({
                headless: false
            });
            this.page = await this.browser.newPage();
        }
    }

    /**
     * 抓取用户的授权类目（核心方法）
     */
    async fetchUserAuthorizedCategories(userId: string): Promise<{
        userId: string;
        categories: AuthorizedCategory[];
        fetchedAt: string;
    }> {
        await this.init();
        if (!this.page) throw new Error('浏览器未初始化');

        console.log('🔍 开始抓取用户授权类目...');

        const authorizedCategories: AuthorizedCategory[] = [];

        // 方法1：监听API（推荐）⭐⭐⭐
        this.page.on('response', async (response) => {
            try {
                const url = response.url();

                // 检测类目相关的API
                if (url.includes('category') && url.includes('auth')) {
                    const data = await response.json();

                    // 提取授权类目
                    const categories = this.extractAuthedCategories(data);
                    authorizedCategories.push(...categories);

                    console.log(`✅ 捕获到 ${categories.length} 个授权类目`);
                }
            } catch (error) {
                // 忽略非JSON响应
            }
        });

        // 打开政采云商品发布页（会加载用户的授权类目）
        await this.page.goto('https://www.zcygov.cn/goods-center/goods/publish');

        console.log('⏳ 等待授权类目加载...');
        await this.page.waitForTimeout(5000);

        // 点击类目选择器，触发加载
        try {
            await this.page.click('.category-selector');
            await this.page.waitForTimeout(2000);
        } catch (error) {
            console.log('⚠️ 类目选择器点击失败，使用备选方案');
        }

        // 方法2：从页面DOM抓取（备选）
        if (authorizedCategories.length === 0) {
            console.log('💡 使用备选方案：从DOM抓取类目');
            const domCategories = await this.extractFromDOM(this.page);
            authorizedCategories.push(...domCategories);
        }

        // 去重
        const uniqueCategories = this.deduplicateCategories(authorizedCategories);

        console.log(`✅ 总共抓取到 ${uniqueCategories.length} 个授权类目`);

        // 扁平化所有子类目
        const allCategories = this.flattenCategories(uniqueCategories);

        console.log(`📦 包含子类目，总计 ${allCategories.length} 个`);

        return {
            userId,
            categories: allCategories,
            fetchedAt: new Date().toISOString()
        };
    }

    /**
     * 从API响应中提取授权类目
     */
    private extractAuthedCategories(data: any): AuthorizedCategory[] {
        const categories: AuthorizedCategory[] = [];

        // 递归提取
        const extract = (obj: any) => {
            if (Array.isArray(obj)) {
                obj.forEach(item => extract(item));
            } else if (typeof obj === 'object' && obj !== null) {
                // 检查是否是类目对象
                if (obj.id && obj.name && obj.authed === true) {
                    categories.push({
                        id: obj.id,
                        name: obj.name,
                        categoryCode: obj.code || obj.categoryCode || obj.id.toString(),
                        level: obj.level || 1,
                        hasChildren: obj.hasChildren || false,
                        authed: true
                    });
                }

                // 递归子属性
                Object.values(obj).forEach(val => extract(val));
            }
        };

        extract(data);

        return categories;
    }

    /**
     * 从DOM抓取授权类目
     */
    private async extractFromDOM(page: Page): Promise<AuthorizedCategory[]> {
        const categories: AuthorizedCategory[] = [];

        try {
            // 等待类目列表加载
            await page.waitForSelector('.category-item, .market-item', { timeout: 5000 });

            // 提取所有类目项
            const items = await page.$$('.category-item, .market-item');

            for (const item of items) {
                try {
                    const name = await item.$eval('.name, .title', el => el.textContent?.trim());
                    const authed = await item.$eval('.status', el => el.textContent?.includes('已授权'));

                    if (name && authed) {
                        categories.push({
                            id: Date.now() + Math.random(), // 临时ID
                            name: name,
                            categoryCode: name, // 临时使用名称
                            level: 1,
                            hasChildren: true,
                            authed: true
                        });
                    }
                } catch (error) {
                    // 跳过解析失败的项
                }
            }

        } catch (error) {
            console.error('从DOM提取类目失败:', error);
        }

        return categories;
    }

    /**
     * 去重
     */
    private deduplicateCategories(categories: AuthorizedCategory[]): AuthorizedCategory[] {
        const map = new Map<number, AuthorizedCategory>();

        categories.forEach(cat => {
            if (!map.has(cat.id)) {
                map.set(cat.id, cat);
            }
        });

        return Array.from(map.values());
    }

    /**
     * 扁平化类目树（包含所有子类目）
     */
    private flattenCategories(categories: AuthorizedCategory[]): AuthorizedCategory[] {
        // 这里需要从完整的18575个类目中，找出这些授权类目的所有子类目
        // 因为用户可以用一级类目下的所有子类目

        const allCategoriesData = this.loadAllCategories();
        const result: AuthorizedCategory[] = [];

        categories.forEach(authedCat => {
            // 找到这个类目在完整数据中的位置
            const fullCategory = allCategoriesData.find(c => c.id === authedCat.id || c.name === authedCat.name);

            if (fullCategory) {
                // 添加自身
                result.push(authedCat);

                // 添加所有子类目（2级、3级、4级、5级）
                const children = this.findAllChildren(fullCategory.id, allCategoriesData);
                result.push(...children.map(c => ({
                    ...c,
                    authed: true
                })));
            }
        });

        return result;
    }

    /**
     * 查找所有子类目
     */
    private findAllChildren(parentId: number, allCategories: any[]): any[] {
        const children: any[] = [];

        allCategories.forEach(cat => {
            if (cat.parentId === parentId) {
                children.push(cat);
                // 递归查找子类目的子类目
                children.push(...this.findAllChildren(cat.id, allCategories));
            }
        });

        return children;
    }

    /**
     * 加载完整的18575个类目
     */
    private loadAllCategories(): any[] {
        // 从本地加载完整类目数据
        const fs = require('fs');
        const path = require('path');

        try {
            const data = fs.readFileSync(
                path.join(process.cwd(), 'public/api/categories.json'),
                'utf8'
            );
            const json = JSON.parse(data);
            return this.flattenTree(json.categories);
        } catch (error) {
            console.error('加载类目数据失败:', error);
            return [];
        }
    }

    /**
     * 扁平化树形结构
     */
    private flattenTree(tree: any[]): any[] {
        const result: any[] = [];

        const flatten = (nodes: any[], parentId: number | null = null) => {
            nodes.forEach(node => {
                result.push({
                    id: node.id,
                    name: node.name,
                    categoryCode: node.categoryCode,
                    level: node.level,
                    parentId: parentId,
                    hasChildren: node.children && node.children.length > 0
                });

                if (node.children && node.children.length > 0) {
                    flatten(node.children, node.id);
                }
            });
        };

        flatten(tree);
        return result;
    }

    /**
     * 保存用户授权类目到数据库
     */
    async saveUserCategories(userId: string, categories: AuthorizedCategory[]) {
        // TODO: 保存到数据库
        // await prisma.userAuthorizedCategory.createMany({
        //   data: categories.map(cat => ({
        //     userId,
        //     categoryId: cat.id,
        //     categoryCode: cat.categoryCode,
        //     categoryName: cat.name,
        //     level: cat.level
        //   }))
        // });

        // 临时：保存到JSON文件
        const fs = require('fs');
        const path = require('path');

        const filePath = path.join(process.cwd(), 'data', `user-${userId}-categories.json`);

        fs.writeFileSync(filePath, JSON.stringify({
            userId,
            categories,
            updatedAt: new Date().toISOString()
        }, null, 2));

        console.log(`✅ 已保存用户授权类目: ${filePath}`);
    }

    /**
     * 获取用户授权类目
     */
    async getUserCategories(userId: string): Promise<AuthorizedCategory[]> {
        // TODO: 从数据库读取
        // const result = await prisma.userAuthorizedCategory.findMany({
        //   where: { userId }
        // });

        // 临时：从JSON文件读取
        const fs = require('fs');
        const path = require('path');

        const filePath = path.join(process.cwd(), 'data', `user-${userId}-categories.json`);

        if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            return data.categories;
        }

        return [];
    }

    /**
     * 关闭浏览器
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }
}

export default new UserCategoryService();
