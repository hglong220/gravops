import { NextRequest, NextResponse } from 'next/server';
import { solveImageCaptcha, solveSlideCaptcha, solveClickCaptcha } from '@/lib/captcha-service';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { type, licenseKey, ...params } = body;

        if (!licenseKey) {
            return NextResponse.json({ error: '缺少 licenseKey' }, { status: 400 });
        }

        // Verify License
        const license = await prisma.license.findUnique({
            where: { key: licenseKey }
        });

        if (!license || license.status !== 'active' || new Date() > license.expiresAt) {
            return NextResponse.json({ error: '授权无效或已过期' }, { status: 401 });
        }

        let result;

        switch (type) {
            case 'image':
                if (!params.imageBase64) {
                    return NextResponse.json({ error: '缺少 imageBase64' }, { status: 400 });
                }
                result = await solveImageCaptcha(params.imageBase64);
                break;

            case 'slide':
                if (!params.backgroundImage || !params.sliderImage) {
                    return NextResponse.json({ error: '缺少背景图或滑块图' }, { status: 400 });
                }
                result = await solveSlideCaptcha({
                    backgroundImage: params.backgroundImage,
                    sliderImage: params.sliderImage
                });
                break;

            case 'click':
                if (!params.imageBase64 || !params.instruction) {
                    return NextResponse.json({ error: '缺少图片或指令' }, { status: 400 });
                }
                result = await solveClickCaptcha({
                    imageBase64: params.imageBase64,
                    instruction: params.instruction
                });
                break;

            default:
                return NextResponse.json({ error: '不支持的验证码类型' }, { status: 400 });
        }

        return NextResponse.json(result);

    } catch (error) {
        console.error('Captcha API Error:', error);
        return NextResponse.json({ error: '验证码识别服务出错' }, { status: 500 });
    }
}
