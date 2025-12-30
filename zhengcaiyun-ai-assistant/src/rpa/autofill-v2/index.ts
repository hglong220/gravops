/**
 * 动态必填项自动填表引擎 V2
 * 
 * 统一导出接口
 */

export * from './types';
export { PageScanner } from './PageScanner';
export { FieldSignature } from './FieldSignature';
export { CacheStore } from './CacheStore';
export { RuleMap } from './RuleMap';
export { SemanticResolver } from './SemanticResolver';
export { FillExecutor } from './FillExecutor';
export { ValidationLoop, runAutoFillV2 } from './ValidationLoop';

import { runAutoFillV2 } from './ValidationLoop';
import { CacheStore } from './CacheStore';

/**
 * 引擎对外暴露的统一管理器
 */
export const AutoFillEngineV2 = {
    /**
     * 主运行入口
     */
    run: runAutoFillV2,

    /**
     * 扫面页面预览（调试用）
     */
    preview: () => {
        const { PageScanner } = require('./PageScanner');
        return PageScanner.scanRequiredFields();
    },

    /**
     * 缓存管理
     */
    cache: {
        clear: () => CacheStore.recordFailure('ALL'), // 这里之后可以扩展更完善的 clear
        export: () => localStorage.getItem('zcy_v2_autofill_cache')
    }
};

// 暴露到 window 方便调试
if (typeof window !== 'undefined') {
    (window as any).AutoFillEngineV2 = AutoFillEngineV2;
}
