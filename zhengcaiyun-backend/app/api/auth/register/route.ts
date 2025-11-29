import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, password, name, companyName, creditCode, phone } = body;

        if (!email || !password) {
            return NextResponse.json({ error: '邮箱和密码必填' }, { status: 400 });
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            return NextResponse.json({ error: '邮箱已注册' }, { status: 409 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name, // Legal Representative
                companyName,
                creditCode,
                phone
            }
        });

        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );

        return NextResponse.json({
            message: '注册成功',
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                companyName: user.companyName
            }
        });
    } catch (error) {
        console.error('注册错误:', error);
        return NextResponse.json({ error: '注册失败' }, { status: 500 });
    }
}
