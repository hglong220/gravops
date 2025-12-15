import { NextRequest, NextResponse } from 'next/server';
import { getAIConfig, saveAIConfig } from '@/lib/ai-config';
import { getAdminFromRequest } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
    try {
        const admin = getAdminFromRequest(request);
        if (!admin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const config = getAIConfig();
        return NextResponse.json(config);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch AI config' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const admin = getAdminFromRequest(request);
        if (!admin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        saveAIConfig(body);
        return NextResponse.json({ success: true, data: body });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to save AI config' }, { status: 500 });
    }
}
