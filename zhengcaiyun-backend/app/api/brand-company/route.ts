import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/brand-company?brand=xxx
 * 查询品牌对应的企业信息
 * 
 * 数据来源：
 * 1. 本地 JSON 配置文件
 * 2. TODO: 可接入天眼查/企查查 API
 */

// 加载本地品牌库
let brandData: any = null;

function loadBrandData() {
    if (brandData) return brandData;

    try {
        const filePath = path.join(process.cwd(), 'public/api/brand-companies.json');
        const content = fs.readFileSync(filePath, 'utf-8');
        brandData = JSON.parse(content);
        console.log('[Brand API] 加载品牌库成功，共', Object.keys(brandData.brands || {}).length, '个品牌');
    } catch (e) {
        console.error('[Brand API] 加载品牌库失败:', e);
        brandData = { brands: {} };
    }

    return brandData;
}

export async function GET(request: NextRequest) {
    const brand = request.nextUrl.searchParams.get('brand');

    if (!brand) {
        return NextResponse.json(
            { error: '缺少 brand 参数' },
            { status: 400, headers: corsHeaders() }
        );
    }

    console.log('[Brand API] 查询品牌:', brand);

    const data = loadBrandData();
    const brands = data.brands || {};

    // 精确匹配
    if (brands[brand]) {
        const info = brands[brand];
        return NextResponse.json({
            found: true,
            brand,
            company: info.company,
            province: info.province,
            city: info.city,
            district: info.district,
            scale: info.scale
        }, { headers: corsHeaders() });
    }

    // 模糊匹配（检查别名）
    for (const [key, info] of Object.entries(brands) as any) {
        // 检查别名
        if (info.aliases && info.aliases.some((alias: string) =>
            alias.toLowerCase() === brand.toLowerCase() ||
            brand.toLowerCase().includes(alias.toLowerCase()) ||
            alias.toLowerCase().includes(brand.toLowerCase())
        )) {
            return NextResponse.json({
                found: true,
                brand: key,
                company: info.company,
                province: info.province,
                city: info.city,
                district: info.district,
                scale: info.scale
            }, { headers: corsHeaders() });
        }

        // 检查品牌名包含
        if (brand.toLowerCase().includes(key.toLowerCase()) ||
            key.toLowerCase().includes(brand.toLowerCase())) {
            return NextResponse.json({
                found: true,
                brand: key,
                company: info.company,
                province: info.province,
                city: info.city,
                district: info.district,
                scale: info.scale
            }, { headers: corsHeaders() });
        }
    }

    // TODO: 如果本地找不到，可以调用天眼查 API
    // const tianyanResult = await queryTianyan(brand);
    // if (tianyanResult) return NextResponse.json(tianyanResult);

    // 使用默认值
    const defaultInfo = data['默认企业'] || {
        company: `${brand}科技有限公司`,
        province: "浙江省",
        city: "宁波市",
        district: "镇海区",
        scale: "中型企业"
    };

    return NextResponse.json({
        found: false,
        brand,
        company: `${brand}科技有限公司`,
        province: defaultInfo.province,
        city: defaultInfo.city,
        district: defaultInfo.district,
        scale: defaultInfo.scale
    }, { headers: corsHeaders() });
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: corsHeaders()
    });
}

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };
}
