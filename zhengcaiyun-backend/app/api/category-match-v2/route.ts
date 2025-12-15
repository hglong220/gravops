/**
 * 三层类目匹配 API v2
 * 
 * 架构：
 * 1. 模板缓存查询（0成本，命中率高）
 * 2. 本地规则匹配（0成本，快速）
 * 3. DeepSeek AI匹配（低成本，只发少量候选）
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ========== 类型定义 ==========

interface Category {
    id: number;
    name: string;
    categoryCode?: string;
    level: number;
    parentId?: number | null;
    children?: Category[];
}

interface CategoryTree {
    meta: {
        name: string;
        totalCategories: number;
    };
    categories: Category[];
}

interface MatchResult {
    categoryPath: string[];
    confidence: number;
    source: 'template' | 'rule' | 'ai';
    hitCount?: number;
}

// ========== 工具函数 ==========

let categoryTreeCache: CategoryTree | null = null;

function loadCategoryTree(): CategoryTree {
    if (categoryTreeCache) return categoryTreeCache;

    const filePath = path.join(process.cwd(), 'public', 'api', '政采云完整类目.json');
    const data = fs.readFileSync(filePath, 'utf-8');
    categoryTreeCache = JSON.parse(data);
    return categoryTreeCache!;
}

// 提取标题关键词（用于缓存key）
function extractTitleKey(title: string, brand?: string): string {
    // 去除品牌
    let cleaned = brand ? title.replace(brand, '') : title;

    // 去除常见无意义词
    const stopWords = ['的', '正品', '包邮', '特价', '促销', '新款', '热卖'];
    stopWords.forEach(word => {
        cleaned = cleaned.replace(new RegExp(word, 'g'), '');
    });

    // 提取核心词（中文2-8字，英文4-20字母）
    const words = cleaned.match(/[\u4e00-\u9fa5]{2,8}|[a-zA-Z]{4,20}/g) || [];

    // 取前3个核心词
    return words.slice(0, 3).join(' ').toLowerCase();
}

// ========== 第一层：模板缓存 ==========

async function checkTemplateCache(
    titleKey: string,
    platform?: string,
    brand?: string
): Promise<MatchResult | null> {
    try {
        const template = await prisma.categoryTemplate.findFirst({
            where: {
                titleKey,
                platform: platform ?? '',
                brand: brand ?? ''
            },
            orderBy: { hitCount: 'desc' }
        });

        if (template) {
            // 更新命中次数
            await prisma.categoryTemplate.update({
                where: { id: template.id },
                data: {
                    hitCount: { increment: 1 },
                    updatedAt: new Date()
                }
            });

            return {
                categoryPath: JSON.parse(template.categoryPath),
                confidence: template.confidence,
                source: 'template',
                hitCount: template.hitCount + 1
            };
        }

        return null;
    } catch (error) {
        console.error('[模板缓存] 查询失败:', error);
        return null;
    }
}

// ========== 第二层：本地规则匹配 ==========

function localRuleMatch(
    title: string,
    userCategories: Category[]
): MatchResult | null {
    const titleLower = title.toLowerCase();

    // 递归搜索最佳匹配
    function search(
        cats: Category[],
        path: string[] = [],
        depth: number = 0
    ): { path: string[]; score: number } | null {
        let bestMatch: { path: string[]; score: number } | null = null;

        for (const cat of cats) {
            const currentPath = [...path, cat.name];
            let score = 0;

            // 检查类目名是否在标题中
            if (titleLower.includes(cat.name.toLowerCase())) {
                score += 10 * (depth + 1); // 越深层级权重越高
            }

            // 检查标题分词是否在类目名中
            const titleWords = title.match(/[\u4e00-\u9fa5]{2,}|[a-zA-Z]{3,}/g) || [];
            for (const word of titleWords) {
                if (cat.name.includes(word)) {
                    score += 5 * (depth + 1);
                }
            }

            if (score > 0 && (!bestMatch || score > bestMatch.score)) {
                bestMatch = { path: currentPath, score };
            }

            // 递归子类目
            if (cat.children && cat.children.length > 0 && depth < 4) {
                const childMatch = search(cat.children, currentPath, depth + 1);
                if (childMatch && (!bestMatch || childMatch.score > bestMatch.score)) {
                    bestMatch = childMatch;
                }
            }
        }

        return bestMatch;
    }

    const bestMatch = search(userCategories);

    if (bestMatch && bestMatch.score >= 15) {
        const confidence = Math.min(bestMatch.score / 50, 0.95);
        return {
            categoryPath: bestMatch.path,
            confidence,
            source: 'rule' as const
        };
    }

    return null;
}

// ========== 第三层：DeepSeek AI 匹配 ==========

async function deepseekMatch(
    title: string,
    candidates: string[][]
): Promise<MatchResult | null> {
    if (!process.env.DEEPSEEK_API_KEY) {
        console.warn('[DeepSeek] 未配置API Key');
        return null;
    }

    try {
        // 构建候选列表
        const candidateList = candidates
            .map((path, idx) => `${idx + 1}. ${path.join(' > ')}`)
            .join('\n');

        const prompt = `请从以下类目候选中，选择最适合该商品的类目。只返回编号。

商品标题：${title}

类目候选：
${candidateList}

请返回最合适的编号（1-${candidates.length}），只返回数字。`;

        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
                max_tokens: 10
            })
        });

        const data = await response.json();
        const answer = data.choices?.[0]?.message?.content?.trim();
        const selectedIdx = parseInt(answer) - 1;

        if (selectedIdx >= 0 && selectedIdx < candidates.length) {
            return {
                categoryPath: candidates[selectedIdx],
                confidence: 0.85,
                source: 'ai'
            };
        }

        return null;
    } catch (error) {
        console.error('[DeepSeek] 调用失败:', error);
        return null;
    }
}

// ========== 主匹配逻辑 ==========

async function matchCategory(
    title: string,
    licenseKey: string,
    platform?: string,
    brand?: string
): Promise<MatchResult & { logs: string[] }> {
    const logs: string[] = [];
    logs.push(`[匹配] 标题: ${title}`);

    // 提取关键词
    const titleKey = extractTitleKey(title, brand);
    logs.push(`[关键词] ${titleKey}`);

    // 第一层：模板缓存
    logs.push('[第1层] 查询模板缓存...');
    const cachedResult = await checkTemplateCache(titleKey, platform, brand);
    if (cachedResult) {
        logs.push(`[第1层] ✓ 命中缓存! 路径: ${cachedResult.categoryPath.join(' > ')}`);
        logs.push(`[第1层] 历史命中次数: ${cachedResult.hitCount}`);
        return { ...cachedResult, logs };
    }
    logs.push('[第1层] 缓存未命中');

    // 获取用户权限类目
    const permissions = await prisma.userCategoryPermission.findMany({
        where: { licenseKey }
    });

    if (permissions.length === 0) {
        throw new Error('未找到用户类目权限');
    }

    // 构建用户类目树
    const categoryTree = loadCategoryTree();
    const userLevel1Names = permissions.map(p => p.level1Category);
    const userCategories = categoryTree.categories.filter(c =>
        userLevel1Names.includes(c.name)
    );

    // 第二层：本地规则匹配
    logs.push('[第2层] 本地规则匹配...');
    const ruleResult = localRuleMatch(title, userCategories);
    if (ruleResult && ruleResult.confidence >= 0.8) {
        logs.push(`[第2层] ✓ 规则匹配成功! 置信度: ${ruleResult.confidence.toFixed(2)}`);
        logs.push(`[第2层] 路径: ${ruleResult.categoryPath.join(' > ')}`);

        // 保存到模板库
        await saveToTemplate(titleKey, platform, brand, ruleResult);
        logs.push('[第2层] 已保存到模板库');

        return { ...ruleResult, logs };
    }
    logs.push(`[第2层] 规则匹配置信度较低: ${ruleResult?.confidence.toFixed(2) || '0'}`);

    // 第三层：筛选候选 + DeepSeek
    logs.push('[第3层] 准备调用 DeepSeek...');

    // 筛选候选（取前20个可能路径）
    const candidates = getCandidatePaths(title, userCategories, 20);
    logs.push(`[第3层] 筛选出 ${candidates.length} 个候选`);

    const aiResult = await deepseekMatch(title, candidates);
    if (aiResult) {
        logs.push(`[第3层] ✓ DeepSeek 匹配成功!`);
        logs.push(`[第3层] 路径: ${aiResult.categoryPath.join(' > ')}`);

        // 保存到模板库
        await saveToTemplate(titleKey, platform, brand, aiResult);
        logs.push('[第3层] 已保存到模板库');

        return { ...aiResult, logs };
    }

    // 所有方法都失败，返回规则匹配结果（即使置信度低）
    if (ruleResult) {
        logs.push('[最终] 使用规则匹配结果（置信度较低）');
        return { ...ruleResult, logs };
    }

    throw new Error('无法匹配类目');
}

// 获取候选路径
function getCandidatePaths(
    title: string,
    categories: Category[],
    maxCount: number
): string[][] {
    const candidates: Array<{ path: string[], score: number }> = [];
    const titleLower = title.toLowerCase();

    function collect(cats: Category[], path: string[] = [], depth: number = 0) {
        for (const cat of cats) {
            const currentPath = [...path, cat.name];
            let score = 0;

            // 计算相关性分数
            if (titleLower.includes(cat.name.toLowerCase())) {
                score += 10 * (depth + 1);
            }

            const titleWords = title.match(/[\u4e00-\u9fa5]{2,}|[a-zA-Z]{3,}/g) || [];
            for (const word of titleWords) {
                if (cat.name.includes(word)) {
                    score += 3 * (depth + 1);
                }
            }

            if (score > 0 || depth === 0) {
                candidates.push({ path: currentPath, score });
            }

            if (cat.children && depth < 3) {
                collect(cat.children, currentPath, depth + 1);
            }
        }
    }

    collect(categories);

    // 按分数排序，取前N个
    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, maxCount).map(c => c.path);
}

// 保存到模板库
async function saveToTemplate(
    titleKey: string,
    platform: string | undefined,
    brand: string | undefined,
    result: MatchResult
): Promise<void> {
    try {
        const platformValue = platform ?? '';
        const brandValue = brand ?? '';

        await prisma.categoryTemplate.upsert({
            where: {
                titleKey_platform_brand: {
                    titleKey,
                    platform: platformValue,
                    brand: brandValue
                }
            },
            update: {
                categoryPath: JSON.stringify(result.categoryPath),
                confidence: result.confidence,
                source: result.source,
                hitCount: { increment: 1 },
                updatedAt: new Date()
            },
            create: {
                id: crypto.randomUUID(),
                titleKey,
                platform: platformValue,
                brand: brandValue,
                categoryPath: JSON.stringify(result.categoryPath),
                confidence: result.confidence,
                source: result.source,
                hitCount: 1
            }
        });
    } catch (error) {
        console.error('[模板库] 保存失败:', error);
    }
}

// ========== API 路由 ==========

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { licenseKey, title, platform, brand } = body;

        if (!licenseKey || !title) {
            return NextResponse.json({
                error: '缺少必要参数: licenseKey, title'
            }, { status: 400 });
        }

        const result = await matchCategory(title, licenseKey, platform, brand);

        return NextResponse.json({
            success: true,
            data: {
                categoryPath: result.categoryPath,
                confidence: result.confidence,
                source: result.source
            },
            logs: result.logs,
            meta: {
                version: 'v2',
                timestamp: new Date().toISOString()
            }
        });

    } catch (error: any) {
        console.error('[类目匹配v2] 错误:', error);
        return NextResponse.json({
            success: false,
            error: error.message || '匹配失败'
        }, { status: 500 });
    }
}
