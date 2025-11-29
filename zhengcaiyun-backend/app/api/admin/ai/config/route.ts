import { NextResponse } from 'next/server';
import { getAIConfig, saveAIConfig } from '@/lib/ai-config';

export async function GET() {
    try {
        const config = getAIConfig();
        return NextResponse.json(config);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch AI config' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        saveAIConfig(body);
        return NextResponse.json({ success: true, data: body });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to save AI config' }, { status: 500 });
    }
}
