/**
 * 字段指纹生成器 V2
 * 
 * 职责：
 * 1. 为每个字段生成一个稳定的 ID（signature）
 * 2. 确保即使页面结构微调，只要语义不变，指纹就保持一致
 * 3. 支撑缓存系统的“命中”判断
 */

import type { FieldCandidate } from './types';

/**
 * 生成字段指纹
 * 组合：页面路径 + 模块名 + 标签名 + 控件类型
 */
export function generateSignature(field: FieldCandidate): string {
    const components = [
        // 1. 页面上下文（排除 ID 这种动态参数，只保留路径）
        window.location.pathname.split('/').slice(0, 3).join('/'),

        // 2. 模块名（如：基本信息、技术参数）
        field.section.toLowerCase().trim(),

        // 3. 标签名（核心语义）
        field.label.toLowerCase().trim(),

        // 4. 控件类型（辅助区分同名但类型不同的字段）
        field.controlType
    ];

    const rawString = components.join('|');

    // 使用简单的哈希算法确保指纹长度固定且无特殊字符
    return btoa(unescape(encodeURIComponent(rawString)))
        .replace(/[+/=]/g, '')
        .substring(0, 32);
}

export const FieldSignature = {
    generateSignature
};
