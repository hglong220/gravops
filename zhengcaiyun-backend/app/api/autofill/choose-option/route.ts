import { NextRequest, NextResponse } from 'next/server';
import AIService from '@/lib/ai-service';

export const runtime = 'nodejs';

/**
 * V2 专用 API：让 AI 从真实选项中选择一个
 * 
 * 输入：
 * - fieldLabel: 字段名（如 "是否需要安装"）
 * - options: 真实选项列表（如 ["需要", "不需要"]）
 * - productTitle: 商品标题
 * - productBrand: 商品品牌
 * 
 * 输出：
 * - choice: AI 选择的选项（必须是 options 中的一个）
 */
export async function POST(req: NextRequest) {
    try {
        const { fieldLabel, options, productTitle, productBrand, productModel, manufacturer } = await req.json();

        if (!options || options.length === 0) {
            return NextResponse.json({ error: 'No options provided' }, { status: 400 });
        }

        // 简单规则快速选择（不调 AI）
        const quickChoice = quickSelect(fieldLabel, options, productTitle, productBrand);
        if (quickChoice) {
            console.log(`[Choose Option] 快速规则: ${fieldLabel} -> ${quickChoice}`);
            return NextResponse.json({ choice: quickChoice, source: 'rule' });
        }

        // 调用 AI（传递完整产品信息）
        const prompt = `
你是一个政采云商品发布助手。

商品信息：
- 标题: ${productTitle || '未知'}
- 品牌: ${productBrand || '未知'}
- 型号: ${productModel || '未知'}
- 生产厂商: ${manufacturer || productBrand || '未知'}

现在需要填写字段 "${fieldLabel}"，可选项有：
${options.map((o: string, i: number) => `${i + 1}. ${o}`).join('\n')}

请根据商品信息选择最合适的一个选项。

规则：
1. 必须从上面的选项中选择一个，不能自己编造
2. "是否需要安装"：打印机、传真机等小型设备选"不需要"
3. "质保时间"：根据品牌判断，惠普/HP 等大品牌通常是 12 个月
4. "产地"：根据品牌判断，惠普/HP、佳能/Canon 等国际品牌选"境外"，国产品牌选"境内"
5. "生产厂商"：根据品牌填写公司全称，如惠普->惠普(中国)有限公司

只返回 JSON 格式：
{ "choice": "你选择的选项文本" }
`;

        try {
            const result = await AIService.analyzeFormSection(prompt);
            const choice = result?.choice;

            // 验证 AI 返回的确实在选项中
            if (choice && options.includes(choice)) {
                console.log(`[Choose Option] AI 选择: ${fieldLabel} -> ${choice}`);
                return NextResponse.json({ choice, source: 'ai' });
            }

            // AI 返回的不在选项中，尝试模糊匹配
            if (choice) {
                const fuzzyMatch = options.find((o: string) =>
                    o.includes(choice) || choice.includes(o)
                );
                if (fuzzyMatch) {
                    console.log(`[Choose Option] AI 模糊匹配: ${fieldLabel} -> ${fuzzyMatch}`);
                    return NextResponse.json({ choice: fuzzyMatch, source: 'ai_fuzzy' });
                }
            }
        } catch (aiError) {
            console.warn(`[Choose Option] AI 调用失败:`, aiError);
        }

        // 兜底：返回第一个选项
        console.log(`[Choose Option] 兜底: ${fieldLabel} -> ${options[0]}`);
        return NextResponse.json({ choice: options[0], source: 'fallback' });

    } catch (error: any) {
        console.error('[Choose Option] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
/**
 * 快速规则选择（模式识别，不调 AI）
 */
function quickSelect(fieldLabel: string, options: string[], productTitle: string, productBrand?: string): string | null {
    const label = fieldLabel.toLowerCase();
    const brand = (productBrand || '').toLowerCase();

    // 模式1："是否xxx" / "有无xxx" → 优先选"否/不/无"
    if (label.includes('是否') || label.includes('有无')) {
        const noOptions = options.filter(o =>
            o.includes('否') || o.includes('不') || o.includes('无')
        );
        if (noOptions.length > 0) return noOptions[0];
    }

    // 模式2："单位" / "计量" → 设备选"台"，否则选"件"
    if (label.includes('单位') || label.includes('计量')) {
        const title = (productTitle || '').toLowerCase();
        if (title.match(/机|设备|仪|器/)) {
            if (options.includes('台')) return '台';
        }
        if (options.includes('件')) return '件';
        if (options.includes('个')) return '个';
    }

    // 模式3："产地" → 根据品牌判断
    if (label === '产地' || label.includes('产地')) {
        // 国际品牌 → 境外
        const internationalBrands = ['hp', '惠普', 'canon', '佳能', 'epson', '爱普生', 'brother', '兄弟', 'dell', '戴尔', 'lenovo'];
        const isInternational = internationalBrands.some(b => brand.includes(b));

        if (isInternational) {
            const foreignOption = options.find(o => o.includes('境外'));
            if (foreignOption) return foreignOption;
        }

        // 默认境内
        const domesticOption = options.find(o => o.includes('境内'));
        if (domesticOption) return domesticOption;
    }

    // 模式4："安装" → 不需要安装
    if (label.includes('安装')) {
        const noInstall = options.filter(o =>
            o.includes('不需要') || o.includes('否') || o.includes('不')
        );
        if (noInstall.length > 0) return noInstall[0];
    }

    // 模式5："能效等级" → 选二级或一级
    if (label.includes('能效') || label.includes('等级')) {
        if (options.includes('二级')) return '二级';
        if (options.includes('一级')) return '一级';
    }

    // 模式6："质保时间" → 大品牌12个月
    if (label.includes('质保') || label.includes('保修')) {
        const majorBrands = ['hp', '惠普', 'canon', '佳能', 'epson', '爱普生', 'lenovo', '联想'];
        const isMajor = majorBrands.some(b => brand.includes(b));

        if (isMajor) {
            // 找12个月的选项
            const month12 = options.find(o => o.includes('12'));
            if (month12) return month12;
        }
    }

    return null;
}
