/**
 * AI + RPA FINAL 一体化自动发布引擎
 * 
 * 完整流程：
 * 1. PageReader 采集页面上下文
 * 2. AI 分析生成 categoryPath + attributes
 * 3. SuperCategorySelector 选择类目
 * 4. FormFiller 填写所有表单字段
 * 5. Flow 控制流程（下一步、发布）
 */

// ========== 基础工具 ==========
export const Util = {
    log(...args: any[]) {
        console.log("[AI+RPA]", ...args);
    },
    warn(...args: any[]) {
        console.warn("[AI+RPA]", ...args);
    },
    wait(ms: number): Promise<void> {
        return new Promise(r => setTimeout(r, ms));
    },
    normalizeText(t: string): string {
        return (t || "")
            .trim()
            .replace(/[：:*＊]/g, "")
            .replace(/\s+/g, "")
            .toLowerCase();
    }
};

// ========== 页面信息采集 ==========
export const PageReader = {
    // 商品文本上下文
    collectContext(): { title: string; allText: string } {
        const title =
            (document.querySelector("input[placeholder*='商品名称']") as HTMLInputElement)?.value ||
            (document.querySelector("input[placeholder*='商品标题']") as HTMLInputElement)?.value ||
            (document.querySelector("textarea[placeholder*='商品名称']") as HTMLTextAreaElement)?.value ||
            document.title || "";

        const allText = Array.from(
            document.querySelectorAll("body *:not(script):not(style)")
        )
            .map(el => (el as HTMLElement).innerText)
            .filter(Boolean)
            .join("\n")
            .slice(0, 8000);

        return { title, allText };
    },

    // 当前已选类目（面包屑）
    getSelectedCategoryBreadcrumb(): string {
        const selectors = [
            ".goods-category-breadcrumb",
            ".breadcrumb",
            "[class*='goods-category']",
            ".category-breadcrumb"
        ];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) return (el as HTMLElement).innerText.trim();
        }
        return "";
    },

    // 获取所有必填字段标签
    getRequiredFieldLabels(): string[] {
        const result: string[] = [];
        const labelNodes = document.querySelectorAll(
            ".el-form-item__label, label, [class*='label'], th"
        );

        labelNodes.forEach(node => {
            const txt = (node as HTMLElement).innerText || "";
            if (!txt) return;

            // 检查是否必填（带星号或在 is-required 容器内）
            const hasStar = /[*＊]/.test(txt);
            const inRequired = node.closest('.is-required, .required') !== null;

            if (!hasStar && !inRequired) return;

            const clean = txt.replace(/[*＊：:]/g, "").trim();
            if (!clean) return;
            result.push(clean);
        });

        return Array.from(new Set(result));
    },

    // 获取所有可见字段（不仅仅是必填）
    getAllFieldLabels(): string[] {
        const result: string[] = [];
        const labelNodes = document.querySelectorAll(
            ".el-form-item__label, label, [class*='label'], th"
        );

        labelNodes.forEach(node => {
            const txt = (node as HTMLElement).innerText || "";
            const clean = txt.replace(/[*＊：:]/g, "").trim();
            if (clean && clean.length < 20) {
                result.push(clean);
            }
        });

        return Array.from(new Set(result));
    }
};

// ========== 类目默认值配置 ==========
const CATEGORY_DEFAULTS: { [category: string]: { [field: string]: string } } = {
    '点钞机': {
        '产地': '浙江省宁波市宁海县',
        '计量单位': '台',
        '生产厂商': '得力集团有限公司',
        '清点速度': '全入',
        '产品类型': '点钞机',
        '工作电压': 'AC220V',
        '功率': '80W',
        '库存': '999',
        '是否需要安装': '否',
        '是否支持过热保护': '是',
        '售后服务': '全国联保',
    },
    '碎纸机': {
        '产地': '浙江省宁波市宁海县',
        '计量单位': '台',
        '碎纸能力': '5-10张',
        '碎纸方式': '粒状',
        '库存': '999',
        '是否需要安装': '否',
    },
    '打印机': {
        '产地': '浙江省宁波市宁海县',
        '计量单位': '台',
        '打印方式': '激光',
        '接口类型': 'USB',
        '库存': '999',
        '是否需要安装': '否',
    },
    '复印纸': {
        '产地': '浙江省宁波市宁海县',
        '计量单位': '包',
        '纸张规格': 'A4',
        '纸张克重': '70g',
        '库存': '999',
        '是否需要安装': '否',
    },
    '打印纸': {
        '产地': '浙江省宁波市宁海县',
        '计量单位': '包',
        '库存': '999',
        '是否需要安装': '否',
    },
    '办公设备': {
        '产地': '浙江省宁波市宁海县',
        '计量单位': '台',
        '库存': '999',
        '是否需要安装': '否',
    },
    'default': {
        '产地': '浙江省宁波市宁海县',
        '计量单位': '个',
        '库存': '999',
        '是否需要安装': '否',
        '是否支持过热保护': '是',
    }
};

// ========== 品牌对应的产地地址 ==========
const BRAND_ADDRESSES: { [brand: string]: string } = {
    '得力': '浙江省宁波市宁海县',
    'deli': '浙江省宁波市宁海县',
    '齐心': '广东省深圳市龙岗区',
    '晨光': '上海市奉贤区',
    '惠普': '中国上海市',
    'HP': '中国上海市',
    '佳能': '中国广东省',
    'Canon': '中国广东省',
    '爱普生': '中国江苏省',
    'Epson': '中国江苏省',
    '联想': '北京市海淀区',
    'Lenovo': '北京市海淀区',
    '华为': '广东省深圳市',
    'default': '中国',
};

// ========== AI 智能分析模块 ==========
export interface AIAnalysisResult {
    categoryPath: string[];
    brand: string;
    model: string;
    attributes: Array<{ label: string; value: string }>;
    images: string[];
}

export interface TaskExtra {
    categoryPath?: string[];
    brand?: string;
    model?: string;
    price?: number;
    stock?: number;
    specs?: { [key: string]: string };
    images?: string[];
    detailImages?: string[];
    categoryName?: string;
    title?: string;
    // ⭐ 新增字段
    sourceUrl?: string;      // 电商平台链接（采集来源）
    originAddress?: string;  // 产地地址

}

export const AI = {
    /**
     * 核心方法：根据页面上下文和采集数据，生成填写指令
     * ⭐ 关键优化：只为页面上实际存在的字段生成 attributes
     */
    async analyzeForPublish(taskExtra: TaskExtra = {}): Promise<AIAnalysisResult> {
        const ctx = PageReader.collectContext();
        const breadcrumb = PageReader.getSelectedCategoryBreadcrumb();
        const requiredLabels = PageReader.getRequiredFieldLabels();
        const allLabels = PageReader.getAllFieldLabels();

        Util.log("═══════════════════════════════════════");
        Util.log("🧠 AI 开始分析页面");
        Util.log("页面标题:", ctx.title.slice(0, 50));
        Util.log("已选类目:", breadcrumb);
        Util.log("必填字段:", requiredLabels.join(", "));
        Util.log("采集数据:", JSON.stringify(taskExtra, null, 2));
        Util.log("═══════════════════════════════════════");

        const attributes: Array<{ label: string; value: string }> = [];
        const addedLabels = new Set<string>();  // 防止重复

        const categoryName = taskExtra.categoryName ||
            breadcrumb.split('>').pop()?.trim() ||
            'default';

        // 获取类目默认值
        let defaults = CATEGORY_DEFAULTS['default'];
        for (const [cat, vals] of Object.entries(CATEGORY_DEFAULTS)) {
            if (categoryName.includes(cat) || cat.includes(categoryName)) {
                defaults = { ...defaults, ...vals };
                break;
            }
        }

        // ⭐⭐⭐ 品牌清洗逻辑 ⭐⭐⭐
        let cleanBrand = taskExtra.brand || '';
        let cleanModel = taskExtra.model || '';

        // 如果品牌太长（超过10个字符），可能是误把标题当品牌了
        if (cleanBrand.length > 10) {
            Util.log(`⚠️ 品牌太长，尝试从标题提取: "${cleanBrand}"`);

            // 常见品牌列表
            const knownBrands = [
                '得力', 'deli', '齐心', '晨光', '惠普', 'HP', '佳能', 'Canon',
                '爱普生', 'Epson', '联想', 'Lenovo', '华为', 'HUAWEI', '小米', 'MI',
                '虎牌', 'TIGER', '永发', '全能', '大一', '艾谱', 'AIPU', '科密',
                '三星', 'Samsung', '戴尔', 'Dell', '华硕', 'ASUS', '宏碁', 'Acer',
                '兄弟', 'Brother', '理光', 'Ricoh', '京瓷', 'Kyocera', '柯尼卡',
                '史泰博', 'Staples', '得印', '天威', 'PrintRite', '格之格',
                '美的', 'Midea', '格力', 'GREE', '海尔', 'Haier', '西门子', 'Siemens',
            ];

            // 尝试从标题中匹配品牌
            const titleLower = (taskExtra.title || cleanBrand).toLowerCase();
            for (const brand of knownBrands) {
                if (titleLower.includes(brand.toLowerCase())) {
                    cleanBrand = brand;
                    Util.log(`✓ 从标题提取品牌: "${cleanBrand}"`);
                    break;
                }
            }

            // 如果还是没找到，尝试用括号中的内容
            const bracketMatch = (taskExtra.title || '').match(/[（(]([^)）]+)[)）]/);
            if (bracketMatch && bracketMatch[1].length <= 10 && cleanBrand.length > 10) {
                cleanBrand = bracketMatch[1];
                Util.log(`✓ 从括号提取品牌: "${cleanBrand}"`);
            }

            // 如果还是太长，清空让用户手动填
            if (cleanBrand.length > 15) {
                Util.log(`⚠️ 无法识别品牌，将留空`);
                cleanBrand = '';
            }
        }

        // ⭐⭐⭐ 型号清洗逻辑 ⭐⭐⭐
        // 如果没有型号，尝试从标题或规格参数中提取
        if (!cleanModel && taskExtra.title) {
            // 常见型号模式：字母+数字，如 HP-1850, DL-33302S
            const modelMatch = taskExtra.title.match(/[A-Za-z]+[-]?[0-9]+[A-Za-z0-9-]*/);
            if (modelMatch) {
                cleanModel = modelMatch[0];
                Util.log(`✓ 从标题提取型号: "${cleanModel}"`);
            }
        }

        // 从 specs 中尝试获取
        if (!cleanModel && taskExtra.specs) {
            cleanModel = taskExtra.specs['型号'] || taskExtra.specs['商品型号'] || '';
        }

        // ⭐ 辅助函数：只有当字段存在于页面上时才添加
        const addIfExists = (possibleLabels: string[], value: string) => {
            for (const label of possibleLabels) {
                // 检查是否在页面的字段列表中
                const existsOnPage = allLabels.some(pageLabel =>
                    Util.normalizeText(pageLabel) === Util.normalizeText(label) ||
                    Util.normalizeText(pageLabel).includes(Util.normalizeText(label)) ||
                    Util.normalizeText(label).includes(Util.normalizeText(pageLabel))
                );

                if (existsOnPage && !addedLabels.has(label)) {
                    attributes.push({ label, value });
                    addedLabels.add(label);
                    return true;  // 只添加第一个匹配的
                }
            }
            return false;
        };

        // 1. 品牌（使用清洗后的品牌）
        if (cleanBrand) {
            Util.log(`📌 使用品牌: "${cleanBrand}"`);
            addIfExists(['品牌', '商品品牌'], cleanBrand);
        }

        // 2. 型号（使用清洗后的型号）
        if (cleanModel) {
            Util.log(`📌 使用型号: "${cleanModel}"`);
            addIfExists(['型号', '商品型号', '规格型号'], cleanModel);
        }

        // 3. 价格（下浮 3-5%）
        if (taskExtra.price) {
            const discountRate = 0.03 + Math.random() * 0.02;
            const discountedPrice = Math.floor(taskExtra.price * (1 - discountRate) * 100) / 100;
            Util.log(`💰 价格计算: 原价 ${taskExtra.price} → 下浮后 ${discountedPrice} (下浮 ${(discountRate * 100).toFixed(1)}%)`);

            addIfExists(['供价', '售价', '销售价', '单价'], discountedPrice.toString());
            addIfExists(['市场价', '参考价', '原价'], taskExtra.price.toString());
        }

        // 4. 库存
        const stock = taskExtra.stock?.toString() || defaults['库存'] || '999';
        addIfExists(['库存', '库存数量', '可售数量'], stock);

        // 5. 生产厂商
        if (taskExtra.brand) {
            addIfExists(['生产厂商', '生产商', '制造商', '厂商'], `${taskExtra.brand}集团有限公司`);
        }

        // 6. 产地（使用品牌对应的地址）
        let originAddress = taskExtra.originAddress || '';
        if (!originAddress && taskExtra.brand) {
            originAddress = BRAND_ADDRESSES[taskExtra.brand] ||
                BRAND_ADDRESSES[taskExtra.brand.toLowerCase()] ||
                BRAND_ADDRESSES['default'];
        }
        if (!originAddress) {
            originAddress = defaults['产地'] || '浙江省宁波市宁海县';
        }
        addIfExists(['产地', '原产地', '生产产地', '产地省市区'], originAddress);

        // 7. 计量单位
        addIfExists(['计量单位', '单位', '销售单位'], defaults['计量单位'] || '台');

        // ⭐ 8. 是否需要安装（默认否）
        addIfExists(['是否需要安装', '需要安装', '安装服务'], '否');

        // ⭐ 9. 是否支持过热保护（默认是）
        addIfExists(['是否支持过热保护', '过热保护', '是否过热保护'], '是');

        // ⭐ 10. 电商平台链接
        if (taskExtra.sourceUrl) {
            addIfExists(['电商平台链接', '电商链接', '来源链接', '商品链接', '原链接'], taskExtra.sourceUrl);
        }

        // ⭐ 11. 售后服务
        addIfExists(['售后服务', '售后'], '全国联保');

        // ⭐ 12. 货号（用型号填充）
        if (taskExtra.model) {
            addIfExists(['货号'], taskExtra.model);
        }

        // 8. 从采集的 specs 中填充
        if (taskExtra.specs) {
            for (const [key, value] of Object.entries(taskExtra.specs)) {
                if (value && !addedLabels.has(key)) {
                    attributes.push({ label: key, value });
                    addedLabels.add(key);
                }
            }
        }

        // 9. 从类目默认值填充剩余必填字段
        for (const label of requiredLabels) {
            if (addedLabels.has(label)) continue;

            // 从默认值中查找
            const defaultValue = defaults[label];
            if (defaultValue) {
                attributes.push({ label, value: defaultValue });
                addedLabels.add(label);
                continue;
            }

            // 特殊字段处理
            if (label.includes('产地') || label.includes('原产地')) {
                if (!addedLabels.has(label)) {
                    attributes.push({ label, value: '境内' });
                    addedLabels.add(label);
                }
            } else if (label.includes('单位') || label.includes('计量')) {
                if (!addedLabels.has(label)) {
                    attributes.push({ label, value: defaults['计量单位'] || '个' });
                    addedLabels.add(label);
                }
            } else if (label.includes('厂商') || label.includes('生产商') || label.includes('制造商')) {
                if (!addedLabels.has(label)) {
                    const manufacturer = taskExtra.brand ?
                        `${taskExtra.brand}集团有限公司` : '详见商品描述';
                    attributes.push({ label, value: manufacturer });
                    addedLabels.add(label);
                }
            } else if (label.includes('保质期') || label.includes('质保')) {
                if (!addedLabels.has(label)) {
                    attributes.push({ label, value: '1年' });
                    addedLabels.add(label);
                }
            } else if (label.includes('售后')) {
                if (!addedLabels.has(label)) {
                    attributes.push({ label, value: '全国联保' });
                    addedLabels.add(label);
                }
            }
        }

        Util.log(`📋 生成 ${attributes.length} 个属性:`);
        attributes.forEach(a => Util.log(`  - ${a.label}: ${a.value}`));

        return {
            categoryPath: taskExtra.categoryPath || [],
            brand: taskExtra.brand || '',
            model: taskExtra.model || '',
            attributes,
            images: taskExtra.images || []
        };
    }
};

// ========== 超级类目选择器 ==========
export const SuperCategorySelector = {
    getColumns(): HTMLElement[] {
        const selectors = [
            ".category-list ul.doraemon-list-items",
            "ul.doraemon-list-items",
            ".category-tree ul",
            ".cascader-menu",
            ".category-panel ul",
            "ul[class*='list-items']"
        ];
        for (const sel of selectors) {
            const cols = document.querySelectorAll(sel);
            if (cols.length) return Array.from(cols) as HTMLElement[];
        }
        return [];
    },

    getLevelItems(level: number): HTMLElement[] {
        const cols = this.getColumns();
        if (!cols.length || !cols[level]) return [];
        const col = cols[level];
        const items = col.querySelectorAll(
            ".category-item, li, span, div, [role='treeitem'], [class*='item']"
        );
        return Array.from(items).filter(el =>
            (el as HTMLElement).offsetParent !== null
        ) as HTMLElement[];
    },

    findNode(level: number, name: string): HTMLElement | null {
        const items = this.getLevelItems(level);
        if (!items.length) return null;
        const target = Util.normalizeText(name);

        // 完全匹配
        for (const el of items) {
            if (Util.normalizeText(el.innerText) === target) return el;
        }
        // 包含匹配
        for (const el of items) {
            if (Util.normalizeText(el.innerText).includes(target)) return el;
        }
        return null;
    },

    async clickNode(el: HTMLElement): Promise<void> {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        await Util.wait(150);
        el.click();
        await Util.wait(400);
    },

    async clickLevel(level: number, name: string): Promise<boolean> {
        Util.log(`类目 Level ${level + 1} → "${name}"`);
        let retry = 15;
        while (retry--) {
            const node = this.findNode(level, name);
            if (node) {
                Util.log(`找到类目并点击: "${name}"`);
                await this.clickNode(node);
                return true;
            }
            await Util.wait(200);
        }
        Util.log(`未找到类目: "${name}"`);
        return false;
    },

    async selectPath(path: string[]): Promise<boolean> {
        if (!path || !path.length) {
            Util.log("AI 未提供类目路径，跳过类目选择");
            return true;
        }
        Util.log("开始选择类目路径:", path.join(" > "));
        for (let i = 0; i < path.length; i++) {
            const ok = await this.clickLevel(i, path[i]);
            if (!ok) {
                Util.log(`类目选择失败在 Level ${i + 1}: "${path[i]}"`);
                return false;
            }
        }
        Util.log("类目选择完成");
        return true;
    }
};

// ========== 表单填写执行器 ==========
export const FormFiller = {
    /**
     * 根据标签文本查找表单行
     * ⭐ 增强版：支持多种选择器和标签名变体
     */
    findRowByLabel(labelText: string): HTMLElement | null {
        // 1. 更全面的选择器
        const labelSelectors = [
            ".el-form-item__label",
            "label",
            "[class*='label']",
            "th",
            "td:first-child",
            ".form-label",
            ".field-label",
            "[class*='form-item'] > *:first-child",
            ".doraemon-form-item__label"
        ];

        const labels = document.querySelectorAll(labelSelectors.join(", "));
        const targetNorm = Util.normalizeText(labelText);

        // 2. 标签名变体（用于模糊匹配）
        const labelVariants = [labelText];

        // 常见变体映射
        const variantMap: { [key: string]: string[] } = {
            '产地': ['产地', '原产地', '生产产地', '产地省市区', '产地地址'],
            '是否需要安装': ['是否需要安装', '需要安装', '安装服务', '安装'],
            '是否支持过热保护': ['是否支持过热保护', '过热保护', '支持过热保护'],
            '电商平台链接': ['电商平台链接', '电商链接', '商品链接', '原链接', '来源链接', '原始链接'],
            '生产厂商': ['生产厂商', '生产商', '制造商', '厂商', '厂家'],
            '计量单位': ['计量单位', '单位', '销售单位', '基本单位'],
            '售后服务': ['售后服务', '售后', '售后保障'],
            '库存': ['库存', '库存数量', '可售数量', '库存量'],
            '供价': ['供价', '售价', '销售价', '单价', '价格'],
        };

        // 添加变体
        for (const [key, variants] of Object.entries(variantMap)) {
            if (labelText.includes(key) || key.includes(labelText)) {
                labelVariants.push(...variants);
            }
        }

        // 3. 遍历所有标签
        for (const node of Array.from(labels)) {
            const raw = (node as HTMLElement).innerText || "";
            const clean = raw.replace(/[*＊：:]/g, "").trim();
            if (!clean || clean.length > 30) continue;  // 跳过太长的文本

            const norm = Util.normalizeText(clean);
            if (!norm) continue;

            // 检查是否匹配任何变体
            const isMatch = labelVariants.some(variant => {
                const variantNorm = Util.normalizeText(variant);
                return norm === variantNorm ||
                    norm.includes(variantNorm) ||
                    variantNorm.includes(norm);
            });

            if (isMatch) {
                // 4. 更全面的行定位
                const rowSelectors = [
                    ".el-form-item",
                    ".form-item",
                    "tr",
                    "[class*='row']",
                    "[class*='form-group']",
                    ".doraemon-form-item",
                    "[class*='field']"
                ];

                let row = null;
                for (const sel of rowSelectors) {
                    row = node.closest(sel);
                    if (row) break;
                }

                // 如果还是没找到，尝试父级
                if (!row) {
                    row = node.parentElement?.parentElement;
                }

                if (row) return row as HTMLElement;
            }
        }

        // 5. 备用方案：直接搜索页面上包含该文本的元素
        const allElements = document.querySelectorAll('*');
        for (const el of allElements) {
            const text = (el as HTMLElement).innerText?.trim();
            if (!text || text.length > 50) continue;

            const textNorm = Util.normalizeText(text);
            if (textNorm === targetNorm) {
                const row = el.closest(".el-form-item, .form-item, tr, [class*='row']");
                if (row) return row as HTMLElement;
            }
        }

        return null;
    },

    /**
     * 填充输入框
     * ⭐ 增强版：模拟真实用户输入，支持 Vue/React 框架
     */
    async fillInput(row: HTMLElement, value: string): Promise<boolean> {
        // 更广泛的输入框选择器
        const inputSelectors = [
            "input:not([type='radio']):not([type='checkbox']):not([readonly])",
            "textarea",
            ".el-input__inner",
            ".doraemon-input__inner",
            "[contenteditable='true']",
            "input.el-input__inner"
        ];

        let input: HTMLInputElement | null = null;
        for (const sel of inputSelectors) {
            input = row.querySelector(sel) as HTMLInputElement | null;
            if (input && input.offsetParent !== null) break;  // 确保可见
        }

        if (!input) {
            Util.log(`⚠️ 未找到输入框`);
            return false;
        }

        try {
            // 1. 滚动到可见
            input.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await Util.wait(100);

            // 2. 聚焦
            input.focus();
            input.click();
            await Util.wait(100);

            // 3. 清空现有值
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            await Util.wait(50);

            // 4. 尝试多种输入方式

            // 方式1: 使用 nativeInputValueSetter（绕过 React/Vue 的代理）
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype, 'value'
            )?.set;

            if (nativeInputValueSetter) {
                nativeInputValueSetter.call(input, value);
            } else {
                input.value = value;
            }

            // 5. 触发完整的事件序列
            const inputEvent = new Event('input', { bubbles: true, cancelable: true });
            input.dispatchEvent(inputEvent);

            const changeEvent = new Event('change', { bubbles: true, cancelable: true });
            input.dispatchEvent(changeEvent);

            // 额外触发 keyup 事件（某些框架需要）
            input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
            input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));

            await Util.wait(100);

            // 6. 验证是否填入成功
            if (input.value !== value) {
                Util.log(`⚠️ 输入验证失败: 期望 "${value}", 实际 "${input.value}"`);
                // 再次尝试直接赋值
                input.value = value;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // 7. 失焦触发验证
            input.blur();
            await Util.wait(50);

            return true;
        } catch (e) {
            Util.log(`⚠️ 输入异常: ${e}`);
            return false;
        }
    },

    /**
     * 填充下拉选择框
     * ⭐ 增强版：支持多种下拉框类型，多次重试
     */
    async fillSelect(row: HTMLElement, value: string): Promise<boolean> {
        // 更广泛的触发器选择器
        const triggerSelectors = [
            ".el-select",
            ".doraemon-select",
            "[role='combobox']",
            "input[readonly]",
            ".el-input__inner[readonly]",
            "[class*='select']",
            ".el-select__input",
            ".ant-select",
            "[class*='dropdown']"
        ];

        let trigger: HTMLElement | null = null;
        for (const sel of triggerSelectors) {
            trigger = row.querySelector(sel) as HTMLElement | null;
            if (trigger && trigger.offsetParent !== null) break;
        }

        if (!trigger) {
            // 尝试直接点击整个行来打开下拉
            const clickable = row.querySelector('div[class*="select"], div[class*="input"]') as HTMLElement;
            if (clickable) {
                trigger = clickable;
            } else {
                Util.log(`⚠️ 未找到下拉框触发器`);
                return false;
            }
        }

        // 多次尝试打开下拉框
        for (let attempt = 0; attempt < 3; attempt++) {
            trigger.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await Util.wait(100);
            trigger.click();
            await Util.wait(300 + attempt * 100);

            // 检查是否有下拉面板出现
            const visiblePanels = document.querySelectorAll(
                ".el-select-dropdown, .doraemon-select-dropdown, .el-scrollbar, .el-popper, [class*='dropdown']:not([style*='display: none'])"
            );

            let foundPanel = false;
            for (const panel of Array.from(visiblePanels)) {
                const rect = panel.getBoundingClientRect();
                if (rect.height > 0 && rect.width > 0) {
                    foundPanel = true;
                    break;
                }
            }

            if (foundPanel) break;

            Util.log(`⚠️ 下拉面板未出现，第 ${attempt + 1} 次重试...`);
        }

        await Util.wait(200);

        // 获取所有可能的下拉面板
        const panels = document.querySelectorAll(
            ".el-select-dropdown, .doraemon-select-dropdown, .el-scrollbar, .el-popper, [class*='popper'], .el-select-dropdown__wrap"
        );

        if (!panels.length) {
            Util.log(`⚠️ 未找到下拉面板`);
            document.body.click();
            return false;
        }

        const targetNorm = Util.normalizeText(value);

        // 特殊值映射（用于常见的简写）
        const valueMap: { [key: string]: string[] } = {
            '否': ['否', '不需要', 'no', '无', '不'],
            '是': ['是', '需要', 'yes', '有'],
            '台': ['台', '台/个'],
            '个': ['个', '只', '件'],
        };

        const matchTargets = [value, ...(valueMap[value] || [])];

        for (const panel of Array.from(panels)) {
            const rect = panel.getBoundingClientRect();
            if (rect.height === 0 || rect.width === 0) continue;  // 跳过隐藏的面板

            const options = panel.querySelectorAll(
                ".el-select-dropdown__item, li, [class*='option'], span[class*='item']"
            );

            for (const op of Array.from(options)) {
                const txt = (op as HTMLElement).innerText?.trim() || "";
                if (!txt) continue;

                const norm = Util.normalizeText(txt);

                for (const target of matchTargets) {
                    const targetN = Util.normalizeText(target);
                    if (norm === targetN || norm.includes(targetN) || targetN.includes(norm)) {
                        Util.log(`  → 选择选项: "${txt}"`);
                        (op as HTMLElement).click();
                        await Util.wait(200);
                        return true;
                    }
                }
            }
        }

        Util.log(`⚠️ 未找到匹配的选项: "${value}"`);
        // 关闭下拉框
        document.body.click();
        await Util.wait(100);
        return false;
    },

    async fillRadio(row: HTMLElement, value: string): Promise<boolean> {
        const radios = row.querySelectorAll(
            "label.el-radio, .el-radio, [type='radio'], .doraemon-radio, .el-radio-group label"
        );
        if (!radios.length) return false;

        const targetNorm = Util.normalizeText(value);

        for (const r of Array.from(radios)) {
            const txt = (r as HTMLElement).innerText || (r as HTMLInputElement).getAttribute("value") || "";
            const norm = Util.normalizeText(txt);
            if (norm === targetNorm || norm.includes(targetNorm) || targetNorm.includes(norm)) {
                const radioInput = (r as HTMLElement).querySelector("input[type='radio']") || r;
                (radioInput as HTMLElement).click();
                await Util.wait(150);
                return true;
            }
        }
        return false;
    },

    /**
     * 填充带搜索建议的输入框（如品牌、型号）
     * ⭐ 输入后等待下拉建议，优先选择匹配项
     */
    async fillSearchInput(row: HTMLElement, value: string): Promise<boolean> {
        const input = row.querySelector(
            "input:not([type='radio']):not([type='checkbox']), .el-input__inner"
        ) as HTMLInputElement | null;

        if (!input) return false;

        try {
            // 1. 聚焦并清空
            input.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await Util.wait(100);
            input.focus();
            input.click();
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            await Util.wait(200);

            // 2. 输入搜索值
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype, 'value'
            )?.set;

            if (nativeInputValueSetter) {
                nativeInputValueSetter.call(input, value);
            } else {
                input.value = value;
            }

            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

            // 3. 等待下拉建议出现
            await Util.wait(500);

            // 4. 检查是否有下拉建议
            const dropdowns = document.querySelectorAll(
                ".el-select-dropdown, .el-autocomplete-suggestion, .el-scrollbar, [class*='dropdown'], [class*='suggestion']"
            );

            for (const dropdown of Array.from(dropdowns)) {
                const rect = dropdown.getBoundingClientRect();
                if (rect.height === 0 || rect.width === 0) continue;

                const options = dropdown.querySelectorAll(
                    "li, [class*='item'], [class*='option']"
                );

                const targetNorm = Util.normalizeText(value);

                for (const op of Array.from(options)) {
                    const txt = (op as HTMLElement).innerText?.trim() || "";
                    if (!txt) continue;

                    const norm = Util.normalizeText(txt);

                    // 匹配逻辑：包含关系
                    if (norm.includes(targetNorm) || targetNorm.includes(norm) || norm === targetNorm) {
                        Util.log(`  → 选择建议: "${txt}"`);
                        (op as HTMLElement).click();
                        await Util.wait(200);
                        return true;
                    }
                }
            }

            // 5. 没有匹配的建议，保留输入值
            Util.log(`  📝 无匹配建议，使用输入值: "${value}"`);
            input.blur();
            return true;

        } catch (e) {
            Util.log(`⚠️ 搜索输入异常: ${e}`);
            return false;
        }
    },

    async fillField(label: string, value: string): Promise<boolean> {
        const row = this.findRowByLabel(label);
        if (!row) {
            Util.log(`⚠️ 未找到字段: ${label}`);
            return false;
        }

        // ⭐ 品牌和型号使用特殊的搜索输入框处理
        const isBrandOrModel = ['品牌', '商品品牌', '型号', '商品型号', '规格型号'].includes(label);
        if (isBrandOrModel) {
            if (await this.fillSearchInput(row, value)) {
                Util.log(`✓ 字段(搜索): ${label} = ${value}`);
                return true;
            }
        }

        // 优先判断是否 radio
        if (await this.fillRadio(row, value)) {
            Util.log(`✓ 字段(单选): ${label} = ${value}`);
            return true;
        }

        // 再判断是否选择框
        if (await this.fillSelect(row, value)) {
            Util.log(`✓ 字段(下拉): ${label} = ${value}`);
            return true;
        }

        // 最后按普通输入框处理
        if (await this.fillInput(row, value)) {
            Util.log(`✓ 字段(输入): ${label} = ${value}`);
            return true;
        }

        Util.log(`✗ 字段填写失败: ${label}`);
        return false;
    },

    async fillAll(attributes: Array<{ label: string; value: string }> = []): Promise<{ success: number; failed: number }> {
        if (!attributes || !attributes.length) {
            Util.log("没有属性需要填写");
            return { success: 0, failed: 0 };
        }

        Util.log(`\n📝 开始填写 ${attributes.length} 个属性`);

        let success = 0;
        let failed = 0;
        const filled = new Set<string>();  // 防止重复填写

        for (const item of attributes) {
            const label = item.label || "";
            const value = item.value ?? "";
            if (!label || value === "") continue;
            if (filled.has(label)) continue;  // 已填过，跳过

            // ⭐ 跳过品牌和型号，因为已由 RPAClicker 处理
            if (['品牌', '商品品牌', '型号', '商品型号', '规格型号'].includes(label)) {
                Util.log(`⏭️ 跳过 ${label}（已由 RPAClicker 处理）`);
                continue;
            }

            const ok = await this.fillField(label, value);
            if (ok) {
                success++;
                filled.add(label);
            } else {
                failed++;
            }
            await Util.wait(200);
        }

        Util.log(`\n📊 填写统计: ${success} 成功, ${failed} 失败`);
        return { success, failed };
    }
};

// ========== 流程控制 ==========
export const Flow = {
    async clickButtonByText(text: string): Promise<boolean> {
        const selectors = [
            "button",
            ".el-button",
            ".doraemon-btn",
            "[role='button']"
        ];
        const targetNorm = Util.normalizeText(text);

        for (const sel of selectors) {
            const nodes = document.querySelectorAll(sel);
            for (const node of Array.from(nodes)) {
                const txt = (node as HTMLElement).innerText || "";
                const norm = Util.normalizeText(txt);
                if (!norm) continue;
                if (norm === targetNorm || norm.includes(targetNorm)) {
                    (node as HTMLElement).scrollIntoView({ block: "center", behavior: "smooth" });
                    await Util.wait(120);
                    (node as HTMLElement).click();
                    await Util.wait(600);
                    return true;
                }
            }
        }
        return false;
    },

    async nextStep(): Promise<boolean> {
        return await this.clickButtonByText("下一步");
    },

    async submitPublish(): Promise<boolean> {
        if (await this.clickButtonByText("发布")) {
            await Util.wait(500);
            await this.clickButtonByText("确定");
            return true;
        }
        if (await this.clickButtonByText("提交")) {
            await Util.wait(500);
            await this.clickButtonByText("确定");
            return true;
        }
        return false;
    }
};

// ========== 总控：AI + RPA FINAL 一体化 ==========
export const AutoPublisher = {
    aiResult: null as AIAnalysisResult | null,

    async run(taskExtra: TaskExtra = {}): Promise<boolean> {
        Util.log("═══════════════════════════════════════");
        Util.log("🚀 AI + RPA FINAL 自动发布开始");
        Util.log("═══════════════════════════════════════");

        try {
            // 1. 调 AI 生成填写指令
            this.aiResult = await AI.analyzeForPublish(taskExtra);

            // 2. 选类目（如果提供了路径）
            if (this.aiResult.categoryPath && this.aiResult.categoryPath.length) {
                const ok = await SuperCategorySelector.selectPath(this.aiResult.categoryPath);
                if (!ok) {
                    Util.log("❌ 类目选择失败，终止流程");
                    return false;
                }
                // 等待属性区域加载
                await Util.wait(2000);
            }

            // 3. 填写属性
            const fillResult = await FormFiller.fillAll(this.aiResult.attributes || []);
            Util.log(`属性填写完成: ${fillResult.success} 成功`);

            // 4. 确保品牌和型号填写
            if (this.aiResult.brand) {
                await FormFiller.fillField("品牌", this.aiResult.brand);
            }
            if (this.aiResult.model) {
                await FormFiller.fillField("型号", this.aiResult.model);
            }

            // 5. 点击下一步
            await Util.wait(500);
            await Flow.nextStep();

            Util.log("═══════════════════════════════════════");
            Util.log("✅ AI + RPA FINAL 自动发布阶段完成");
            Util.log("═══════════════════════════════════════");

            return true;

        } catch (error) {
            Util.log("❌ 自动发布异常:", error);
            return false;
        }
    }
};

// 导出所有模块
export default {
    Util,
    PageReader,
    AI,
    SuperCategorySelector,
    FormFiller,
    Flow,
    AutoPublisher
};
