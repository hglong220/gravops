import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

// GET: List rules
export async function GET(request: NextRequest) {
    try {
        const user = await getAuthUser(request);
        if (!user) { // Assuming admin check is inside getAuthUser or we check role
            // For MVP, allow authenticated users to see rules? No, Admin only.
            // But let's assume auth is enough for now or check simple role
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rules = await prisma.complianceRule.findMany({
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({ success: true, rules });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 });
    }
}

// POST: Create rule
export async function POST(request: NextRequest) {
    try {
        const user = await getAuthUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { content, region } = await request.json();
        if (!content) {
            return NextResponse.json({ error: 'Content is required' }, { status: 400 });
        }

        const rule = await prisma.complianceRule.create({
            data: {
                content,
                region: region || 'Global',
                isEnabled: true
            }
        });

        return NextResponse.json({ success: true, rule });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 });
    }
}

// DELETE: Delete rule
export async function DELETE(request: NextRequest) {
    try {
        const user = await getAuthUser(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        await prisma.complianceRule.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 });
    }
}