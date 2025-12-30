import { NextRequest, NextResponse } from 'next/server';
import AIService from '@/lib/ai-service';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    try {
        const { field, productData } = await req.json();
        const specs = productData?.specs || {};
        const specKeys = Object.keys(specs).join(', ');

        const prompt = `
[任务] 为政采云字段 "${field.label}" 确定填充值。
[控件类型] ${field.controlType}
[可选范围] ${field.options?.join(' / ') || '无限制'}

[已有数据源]
标题: ${productData.title}
参数字典:
${Object.entries(specs).slice(0, 100).map(([k, v]) => `${k}: ${v}`).join('\n')}

[规则]
1. 必须优先从参数字典中找映射。
2. 如果是选择题(Radio/Select)，必须从[可选范围]中选一个最接近的。
3. 【死令】payload 必须是真实的数据（如 "120x80" 或 "境内"），严禁返回理由，严禁复读字段名 "${field.label}"。
4. 如果该字段是"产品图片"或"详情图"，payload 返回 "UPLOAD_FLAG"。

返回 JSON:
{
  "semantic": "识别出的核心语义",
  "fillPlan": { "kind": "use_product_data", "key": "匹配到的字典Key" },
  "executePlan": { "action": "type", "payload": "最终确定的具体值" }
}
`;

        const aiResult = await AIService.analyzeFormSection(prompt);
        let decision = typeof aiResult === 'object' ? aiResult : JSON.parse(String(aiResult).replace(/```json|```/g, '').trim());

        decision.signature = field.signature;

        // 如果命中了参数映射，强制提取
        if (decision.fillPlan?.kind === 'use_product_data' && decision.fillPlan.key) {
            const val = specs[decision.fillPlan.key];
            if (val) decision.executePlan.payload = val;
        }

        // 终极拦截：如果 payload 还是在复读字段名，清空它！
        if (decision.executePlan.payload === field.label || decision.executePlan.payload.includes(field.label)) {
            decision.executePlan.payload = "";
        }

        return NextResponse.json(decision);

    } catch (error: any) {
        return NextResponse.json({ error: 'AI_CRASH' }, { status: 500 });
    }
}
