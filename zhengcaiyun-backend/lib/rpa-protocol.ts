/**
 * RPA 指令协议 - AI 与 RPA 之间的标准通信格式
 * 
 * AI 输出这些指令，RPA 负责解释执行
 */

// ========== 指令类型枚举 ==========

export type RpaCommandType =
    | 'OPEN_DIALOG'        // 点击修改按钮，打开电子卖场弹窗
    | 'EXPAND_MARKET'      // 展开"网上超市"行
    | 'SELECT_BID'         // 选择标项（一级类目）
    | 'CONFIRM_DIALOG'     // 点击弹窗确定按钮
    | 'SELECT_CATEGORY'    // 选择类目（二级/三级）
    | 'INPUT_BRAND'        // 在品牌输入框输入文字
    | 'SELECT_BRAND'       // 从下拉列表选择品牌
    | 'INPUT_MODEL'        // 在型号输入框输入文字
    | 'SELECT_MODEL'       // 从下拉列表选择型号
    | 'CLICK_NEXT'         // 点击"下一步"按钮
    | 'WAIT';              // 等待指定时间

// ========== 指令参数接口 ==========

export interface RpaCommand {
    /** 指令类型 */
    type: RpaCommandType;
    /** 指令参数（如类目名、品牌名等） */
    value?: string;
    /** 等待时间（毫秒） */
    waitMs?: number;
    /** 备注说明 */
    note?: string;
}

// ========== 指令序列 ==========

export interface RpaCommandSequence {
    /** 商品标题 */
    productTitle: string;
    /** 类目路径 */
    categoryPath: string[];
    /** 品牌 */
    brand: string | null;
    /** 型号 */
    model: string | null;
    /** 指令列表 */
    commands: RpaCommand[];
    /** 生成来源 */
    source: 'ai' | 'cache' | 'template';
}

// ========== 指令类型说明（用于 AI Prompt） ==========

export const COMMAND_DESCRIPTIONS: Record<RpaCommandType, string> = {
    OPEN_DIALOG: '点击页面上的"修改"按钮，打开电子卖场选择弹窗',
    EXPAND_MARKET: '点击"网上超市(青海网超)"前面的"+"号，展开标项列表',
    SELECT_BID: '在展开的标项列表中，点击选中指定的标项（value 为标项名称）',
    CONFIRM_DIALOG: '点击弹窗右下角的"确定"按钮，关闭弹窗',
    SELECT_CATEGORY: '在类目选择区域，点击指定的类目名称（value 为类目名称）',
    INPUT_BRAND: '在品牌输入框中输入文字（value 为品牌名称）',
    SELECT_BRAND: '从品牌下拉列表中点击选中指定品牌（value 为品牌名称）',
    INPUT_MODEL: '在型号输入框中输入文字（value 为型号）',
    SELECT_MODEL: '从型号下拉列表中点击选中指定型号（value 为型号）',
    CLICK_NEXT: '点击页面底部的"下一步"按钮',
    WAIT: '等待指定时间（waitMs 为毫秒数）'
};

// ========== 示例指令序列 ==========

export const EXAMPLE_COMMAND_SEQUENCE: RpaCommand[] = [
    { type: 'OPEN_DIALOG', note: '打开电子卖场弹窗' },
    { type: 'WAIT', waitMs: 2000, note: '等待弹窗加载' },
    { type: 'EXPAND_MARKET', note: '展开网上超市' },
    { type: 'WAIT', waitMs: 2000, note: '等待展开' },
    { type: 'SELECT_BID', value: '办公设备', note: '选择一级类目' },
    { type: 'CONFIRM_DIALOG', note: '确认选择' },
    { type: 'WAIT', waitMs: 3000, note: '等待页面更新' },
    { type: 'SELECT_CATEGORY', value: '办公用纸', note: '选择二级类目' },
    { type: 'WAIT', waitMs: 1000 },
    { type: 'SELECT_CATEGORY', value: '打印/复印纸', note: '选择三级类目' },
    { type: 'WAIT', waitMs: 1000 },
    { type: 'INPUT_BRAND', value: '得力', note: '输入品牌' },
    { type: 'WAIT', waitMs: 500 },
    { type: 'SELECT_BRAND', value: '得力', note: '选择品牌' },
    { type: 'WAIT', waitMs: 1000 },
    { type: 'INPUT_MODEL', value: 'A4', note: '输入型号' },
    { type: 'WAIT', waitMs: 500 },
    { type: 'SELECT_MODEL', value: 'A4', note: '选择型号' },
    { type: 'CLICK_NEXT', note: '进入下一步' }
];
