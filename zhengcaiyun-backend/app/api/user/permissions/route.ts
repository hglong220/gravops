import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { permissions } = body;

        console.log('[API] Received permissions sync:', permissions?.length);

        if (permissions && Array.isArray(permissions)) {
            // Save to a local file for now (simple persistence)
            const filePath = path.join(process.cwd(), 'user-permissions.json');
            fs.writeFileSync(filePath, JSON.stringify(permissions, null, 2));
            console.log('[API] Permissions saved to:', filePath);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[API] Error syncing permissions:', error);
        return NextResponse.json({ success: false, error: 'Failed to sync permissions' }, { status: 500 });
    }
}

export async function GET() {
    try {
        const filePath = path.join(process.cwd(), 'user-permissions.json');
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf-8');
            return NextResponse.json({ success: true, permissions: JSON.parse(data) });
        }
        return NextResponse.json({ success: true, permissions: [] });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to fetch permissions' }, { status: 500 });
    }
}
