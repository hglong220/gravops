
import { NextRequest, NextResponse } from 'next/server';
import { visualAgentAction } from '@/lib/ai-service';

/**
 * 视觉智能 Agent 接口
 * 接收截图和任务指令，返回操作建议（坐标或选择器）
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { screenshot, task, context } = body;

        if (!screenshot) {
            return NextResponse.json({ error: '缺少 screenshot 参数' }, { status: 400 });
        }

        const result = await visualAgentAction(screenshot, task, context);
        return NextResponse.json(result);

    } catch (error: any) {
        console.error('[Vision Agent API] Error:', error);
        return NextResponse.json({
            error: '视觉分析请求失败',
            details: error.message
        }, { status: 500 });
    }
}
