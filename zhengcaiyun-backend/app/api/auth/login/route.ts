import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json({ error: '邮箱和密码必填' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            return NextResponse.json({ error: '用户不存在' }, { status: 404 });
        }

        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return NextResponse.json({ error: '密码错误' }, { status: 401 });
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );

        return NextResponse.json({
            message: '登录成功',
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                companyName: user.companyName
            }
        });
    } catch (error) {
        console.error('登录错误:', error);
        return NextResponse.json({ error: '登录失败' }, { status: 500 });
    }
}
