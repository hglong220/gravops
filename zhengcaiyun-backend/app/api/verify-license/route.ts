import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { licenseKey, companyName } = body;

        if (!licenseKey || !companyName) {
            return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
        }

        // 1. 查找 License
        const license = await prisma.license.findUnique({
            where: { key: licenseKey }
        });

        if (!license) {
            // 为了演示方便，如果 License 不存在，我们自动创建一个并绑定（模拟购买后首次激活）
            // 在生产环境中，这里应该返回 "无效的授权码"
            console.log(`[License] Key not found, auto-creating for demo: ${licenseKey}`);
            const newLicense = await prisma.license.create({
                data: {
                    key: licenseKey,
                    companyName: companyName, // 首次绑定
                    plan: 'enterprise',
                    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                    status: 'active'
                }
            });

            return NextResponse.json({
                valid: true,
                companyName: newLicense.companyName,
                expiresAt: newLicense.expiresAt.getTime(),
                plan: newLicense.plan,
                message: '激活成功 (已绑定此公司)'
            });
        }

        // 2. 验证有效期
        if (new Date() > license.expiresAt || license.status !== 'active') {
            return NextResponse.json({ error: '授权已过期或被禁用' }, { status: 401 });
        }

        // 3. 验证公司绑定 (关键逻辑)
        if (!license.companyName) {
            // 如果 License 尚未绑定公司 (老数据或新生成的空License)，则绑定当前公司
            await prisma.license.update({
                where: { id: license.id },
                data: { companyName: companyName }
            });
            console.log(`[License] Bound ${licenseKey} to ${companyName}`);
        } else if (license.companyName !== companyName) {
            // 如果已绑定其他公司，则拒绝
            console.warn(`[License] Mismatch: Key bound to "${license.companyName}", but request from "${companyName}"`);
            return NextResponse.json({
                error: `授权验证失败: 此激活码已绑定到 "${license.companyName}"，无法在 "${companyName}" 使用。`
            }, { status: 403 });
        }

        // 4. 验证通过
        return NextResponse.json({
            valid: true,
            companyName: license.companyName || companyName,
            expiresAt: license.expiresAt.getTime(),
            plan: license.plan
        });
    } catch (error) {
        console.error('License验证错误:', error);
        return NextResponse.json({ error: '服务器错误' }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const companyName = searchParams.get('company');
    const plan = searchParams.get('plan') as 'monthly' | 'yearly' || 'monthly';

    if (!companyName) {
        return NextResponse.json({ error: '缺少公司名称' }, { status: 400 });
    }

    const licenseKey = `ZCAI-${nanoid(4)}-${nanoid(4)}-${nanoid(4)}-${nanoid(4)}`.toUpperCase();

    const duration = plan === 'yearly' ? 365 : 30;
    const expiresAt = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);

    try {
        const license = await prisma.license.create({
            data: {
                key: licenseKey,
                companyName,
                plan,
                expiresAt,
                status: 'active'
            }
        });

        return NextResponse.json({
            licenseKey: license.key,
            companyName: license.companyName,
            expiresAt: license.expiresAt.getTime(),
            plan: license.plan
        });
    } catch (error) {
        console.error('生成License错误:', error);
        return NextResponse.json({ error: '生成失败' }, { status: 500 });
    }
}
