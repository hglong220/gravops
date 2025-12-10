/**
 * RPA 指令生成 API (V2 - AI 驱动版)
 * 
 * 功能：
 * 1. 调用 AI 生成 RPA 操作指令序列
 * 2. 查询学习记录，如果已学习则直接返回缓存
 * 3. 记录成功的操作供后续复用
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { RpaCommand } from '@/lib/rpa-protocol';
import { generateCommandsWithAI, generateCommandsFromTemplate } from '@/lib/ai-command-generator';

// 生成路径哈希
function generatePathHash(categoryPath: string[]): string {
    const pathStr = categoryPath.join('|');
    return crypto.createHash('md5').update(pathStr).digest('hex');
}

// POST: 生成 RPA 指令
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { categoryPath, brand, model, productTitle, useAI = true } = body;

        if (!categoryPath || !Array.isArray(categoryPath) || categoryPath.length === 0) {
            return NextResponse.json({
                error: '缺少必要参数: categoryPath'
            }, { status: 400 });
        }

        const pathHash = generatePathHash(categoryPath);

        // 1. 查询学习记录
        let learningRecord = null;
        try {
            learningRecord = await prisma.rpaLearningRecord.findUnique({
                where: { pathHash }
            });
        } catch (e) {
            console.log('[RPA指令] 学习记录表不存在，跳过缓存查询');
        }

        if (learningRecord && learningRecord.successCount >= 3) {
            // 已学习过且成功次数 >= 3，直接返回缓存的操作
            console.log(`[RPA指令] 使用学习记录: ${categoryPath.join(' > ')}, 成功次数: ${learningRecord.successCount}`);

            try {
                await prisma.rpaLearningRecord.update({
                    where: { pathHash },
                    data: { lastUsedAt: new Date() }
                });
            } catch (e) { }

            const cachedCommands = JSON.parse(learningRecord.operations) as RpaCommand[];

            // 替换品牌和型号
            const finalCommands = replaceCommandVariables(cachedCommands, brand, model);

            return NextResponse.json({
                success: true,
                source: 'cache',
                data: {
                    categoryPath,
                    brand,
                    model,
                    commands: finalCommands,
                    learningCount: learningRecord.successCount,
                    pathHash
                }
            });
        }

        // 2. 调用 AI 或模板生成指令
        console.log(`[RPA指令] 生成新指令: ${categoryPath.join(' > ')}`);

        let commands: RpaCommand[];
        let source: 'ai' | 'template';

        if (useAI && productTitle) {
            commands = await generateCommandsWithAI(productTitle, categoryPath, brand, model);
            source = 'ai';
        } else {
            commands = generateCommandsFromTemplate(categoryPath, brand, model);
            source = 'template';
        }

        console.log(`[RPA指令] 生成完成, 来源: ${source}, 指令数: ${commands.length}`);

        return NextResponse.json({
            success: true,
            source,
            data: {
                categoryPath,
                brand,
                model,
                commands,
                pathHash
            }
        });

    } catch (error) {
        console.error('RPA指令生成失败:', error);
        return NextResponse.json({ error: '服务器错误' }, { status: 500 });
    }
}

// 替换变量
function replaceCommandVariables(
    commands: RpaCommand[],
    brand: string | null,
    model: string | null
): RpaCommand[] {
    return commands.map(cmd => {
        const newCmd = { ...cmd };

        if (newCmd.value === '{brand}' && brand) {
            newCmd.value = brand;
        }
        if (newCmd.value === '{model}' && model) {
            newCmd.value = model;
        }

        return newCmd;
    });
}

// PUT: 记录学习结果（RPA 执行成功后调用）
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { pathHash, categoryPath, commands, success } = body;

        if (!pathHash || !categoryPath) {
            return NextResponse.json({
                error: '缺少必要参数'
            }, { status: 400 });
        }

        if (!success) {
            console.log(`[RPA学习] 执行失败，不记录: ${categoryPath.join(' > ')}`);
            return NextResponse.json({ success: true, recorded: false });
        }

        // 将品牌和型号替换为变量占位符（供以后复用）
        const templateCommands = (commands as RpaCommand[]).map(cmd => {
            const newCmd = { ...cmd };
            // 这里可以将具体品牌/型号替换为占位符
            return newCmd;
        });

        // 更新或创建学习记录
        try {
            const existing = await prisma.rpaLearningRecord.findUnique({
                where: { pathHash }
            });

            if (existing) {
                await prisma.rpaLearningRecord.update({
                    where: { pathHash },
                    data: {
                        successCount: existing.successCount + 1,
                        lastUsedAt: new Date()
                    }
                });
                console.log(`[RPA学习] 更新记录: ${categoryPath.join(' > ')}, 成功次数: ${existing.successCount + 1}`);
            } else {
                await prisma.rpaLearningRecord.create({
                    data: {
                        pathHash,
                        categoryPath: JSON.stringify(categoryPath),
                        operations: JSON.stringify(templateCommands),
                        successCount: 1
                    }
                });
                console.log(`[RPA学习] 新建记录: ${categoryPath.join(' > ')}`);
            }
        } catch (e) {
            console.log('[RPA学习] 学习记录表不存在，跳过记录');
        }

        return NextResponse.json({
            success: true,
            recorded: true
        });

    } catch (error) {
        console.error('RPA学习记录失败:', error);
        return NextResponse.json({ error: '服务器错误' }, { status: 500 });
    }
}

// GET: 查询学习统计
export async function GET() {
    try {
        let records: { categoryPath: string; successCount: number; lastUsedAt: Date }[] = [];

        try {
            records = await prisma.rpaLearningRecord.findMany({
                orderBy: { successCount: 'desc' },
                take: 50,
                select: {
                    categoryPath: true,
                    successCount: true,
                    lastUsedAt: true
                }
            });
        } catch (e) {
            console.log('[RPA统计] 学习记录表不存在');
        }

        const stats = {
            totalRecords: records.length,
            totalSuccess: records.reduce((sum: number, r) => sum + r.successCount, 0),
            topPaths: records.slice(0, 10).map(r => ({
                path: JSON.parse(r.categoryPath),
                successCount: r.successCount,
                lastUsed: r.lastUsedAt
            }))
        };

        return NextResponse.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('获取学习统计失败:', error);
        return NextResponse.json({ error: '服务器错误' }, { status: 500 });
    }
}
