import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

import { prisma } from '@/lib/prisma'
import { getJwtSecret } from '@/lib/jwt'
import { isValidChinaPhone, normalizeChinaPhone } from '@/lib/phone'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}))
        const identifierRaw =
            typeof body?.identifier === 'string' ? body.identifier : body?.email
        const identifier = typeof identifierRaw === 'string' ? identifierRaw.trim() : ''
        const password = typeof body?.password === 'string' ? body.password : ''

        if (!identifier || !password) {
            return NextResponse.json({ error: '用户名/手机号和密码必填' }, { status: 400 })
        }

        const normalizedPhone = normalizeChinaPhone(identifier)
        const isPhone = isValidChinaPhone(normalizedPhone)
        let user = await prisma.user.findFirst({
            where: isPhone ? { phone: normalizedPhone } : { email: identifier }
        })
        if (!user && isPhone) {
            user = await prisma.user.findFirst({ where: { email: identifier } })
        }

        if (!user) {
            return NextResponse.json({ error: '用户不存在' }, { status: 404 })
        }

        const validPassword = await bcrypt.compare(password, user.password)

        if (!validPassword) {
            return NextResponse.json({ error: '密码错误' }, { status: 401 })
        }

        const token = jwt.sign(
            { typ: 'user', userId: user.id, email: user.email },
            getJwtSecret(),
            { expiresIn: '7d' }
        )

        const activeLicense = await prisma.license.findFirst({
            where: {
                userId: user.id,
                status: 'active',
                expiresAt: { gt: new Date() }
            },
            orderBy: { expiresAt: 'desc' },
            select: {
                id: true,
                key: true,
                companyName: true,
                plan: true,
                expiresAt: true
            }
        })

        return NextResponse.json({
            message: '登录成功',
            token,
            user: {
                id: user.id,
                username: user.email,
                phone: user.phone,
                email: user.email,
                name: user.name,
                companyName: user.companyName,
                licenseKey: activeLicense?.key || null,
                license: activeLicense
                    ? {
                        id: activeLicense.id,
                        key: activeLicense.key,
                        companyName: activeLicense.companyName,
                        plan: activeLicense.plan,
                        expiresAt: activeLicense.expiresAt.getTime()
                    }
                    : null
            }
        })
    } catch (error) {
        console.error('登录错误:', error)
        return NextResponse.json({ error: '登录失败' }, { status: 500 })
    }
}
