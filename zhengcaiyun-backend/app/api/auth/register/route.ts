import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

import { prisma } from '@/lib/prisma'
import { getJwtSecret } from '@/lib/jwt'
import { verifyPhoneCode } from '@/lib/phone-verification'
import { isValidChinaPhone, normalizeChinaPhone } from '@/lib/phone'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}))

        const usernameRaw = typeof body?.username === 'string' ? body.username : body?.email
        const username = typeof usernameRaw === 'string' ? usernameRaw.trim() : ''
        const phoneRaw = typeof body?.phone === 'string' ? body.phone.trim() : ''
        const phone = normalizeChinaPhone(phoneRaw)
        const code = typeof body?.code === 'string' ? body.code.trim() : ''
        const password = typeof body?.password === 'string' ? body.password : ''
        const confirmPassword =
            typeof body?.confirmPassword === 'string' ? body.confirmPassword : password

        if (!username) {
            return NextResponse.json({ error: '用户名必填' }, { status: 400 })
        }
        if (username.length < 2 || username.length > 30 || /\\s/.test(username)) {
            return NextResponse.json({ error: '用户名格式不正确' }, { status: 400 })
        }
        if (isValidChinaPhone(username)) {
            return NextResponse.json({ error: '用户名不能为手机号' }, { status: 400 })
        }
        if (!isValidChinaPhone(phone)) {
            return NextResponse.json({ error: '手机号格式不正确' }, { status: 400 })
        }
        if (!code) {
            return NextResponse.json({ error: '验证码必填' }, { status: 400 })
        }
        if (!password || password.length < 8) {
            return NextResponse.json({ error: '密码至少 8 位' }, { status: 400 })
        }
        if (password !== confirmPassword) {
            return NextResponse.json({ error: '两次密码不一致' }, { status: 400 })
        }

        const ttlMs = process.env.AUTH_CODE_TTL_MS
            ? parseInt(process.env.AUTH_CODE_TTL_MS, 10)
            : 5 * 60 * 1000
        const maxAttempts = process.env.AUTH_CODE_MAX_ATTEMPTS
            ? parseInt(process.env.AUTH_CODE_MAX_ATTEMPTS, 10)
            : 5

        const verified = await verifyPhoneCode({
            phone,
            purpose: 'register',
            code,
            ttlMs,
            maxAttempts
        })
        if (!verified) {
            return NextResponse.json({ error: '验证码错误或已过期' }, { status: 400 })
        }

        const existingUser = await prisma.user.findFirst({
            where: { OR: [{ email: username }, { phone }] }
        })

        if (existingUser) {
            return NextResponse.json({ error: '用户名或手机号已注册' }, { status: 409 })
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        const user = await prisma.user.create({
            data: {
                email: username,
                phone,
                password: hashedPassword
            }
        })

        const token = jwt.sign(
            { typ: 'user', userId: user.id, email: user.email },
            getJwtSecret(),
            { expiresIn: '7d' }
        )

        return NextResponse.json({
            message: '注册成功',
            token,
            user: {
                id: user.id,
                username: user.email,
                phone: user.phone
            }
        })
    } catch (error) {
        console.error('注册错误:', error)
        return NextResponse.json({ error: '注册失败' }, { status: 500 })
    }
}
