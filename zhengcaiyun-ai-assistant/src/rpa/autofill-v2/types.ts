/**
 * 自动填表引擎 V2 类型定义
 */

export type ControlType = 'text' | 'number' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'date' | 'cascader' | 'dialog_picker' | 'unknown';

export type SemanticKey = string;

/**
 * 填充计划
 */
export interface FillPlan {
    kind: 'fixed_value' | 'use_product_data' | 'skip';
    value?: any;
    key?: string; // productData 中的 key (如 brand, price) 或 specs 中的 key
    reason?: string;
}

/**
 * 执行计划（具体的 RPA 操作）
 */
export interface ExecutePlan {
    action: 'type' | 'select' | 'click_radio' | 'pick_date' | 'toggle_checkbox' | 'cascader';
    payload?: any;
}

/**
 * 页面扫描到的字段候选
 */
export interface FieldCandidate {
    id: string;
    signature: string;      // 字段指纹
    label: string;          // 字段名称
    helpText?: string;      // 提示文字/placeholder
    section: string;        // 所在分组面板
    controlType: ControlType;
    domRef: HTMLElement;    // DOM 引用
    selectors?: {           // 辅助定位的选择器
        container: string;
        control: string;
        label: string;
    };
    required: boolean;
    currentValueText?: string;
    errorText?: string;     // 校验错误文字
    options?: string[];     // 若是下拉/单选，记录选项
}

/**
 * 决策结果
 */
export interface SemanticDecision {
    signature: string;
    semantic: SemanticKey;
    confidence: number;
    fillValue?: any;        // V2 新增：最终填入的值
    fillPlan: FillPlan;     // 保留原始计划供回溯
    executePlan: ExecutePlan; // V2：直接指令
    source: 'cache' | 'rule' | 'ai' | 'specs' | 'default' | 'failed';
    notes?: string;
}

/**
 * 缓存条目
 */
export interface CacheEntry {
    signature: string;
    semantic: SemanticKey;
    controlType: ControlType;
    fillPlan: FillPlan;
    controlPlan: ExecutePlan; // 对应 ExecutePlan
    lastSuccessAt: number;
    successCount: number;
    failureCount: number;
    exampleLabel?: string;
    exampleSection?: string;
}

/**
 * 商品数据结构
 */
export interface ProductData {
    title?: string;
    brand?: string;
    model?: string;
    price?: string | number;
    stock?: string | number;
    unit?: string;
    origin?: string;
    manufacturer?: string;
    platform_link?: string;
    specs?: Record<string, any>; // 核心：原始抓取参数
    [key: string]: any;
}

/**
 * 填表报告
 */
export interface AutoFillReport {
    success: boolean;
    filledCount: number;
    failedCount: number;
    failedFields: Array<{
        label: string;
        reason: string;
        errorText?: string;
    }>;
}

/**
 * 单个字段填充结果
 */
export interface FillResult {
    field: FieldCandidate;
    decision: SemanticDecision;
    success: boolean;
    error?: string;
    retryable?: boolean;
}

/**
 * 运行日志
 */
export interface RunLog {
    logId: string;
    timestamp: number;
    pageKey: string;
    productTitle?: string;
    scannedFields: any[];
    decisions: any[];
    results: any[];
    validationLoops: number;
    finalStatus: 'success' | 'partial' | 'failed';
    failedFields?: any[];
}
