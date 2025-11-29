import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'versions.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(process.cwd(), 'data'))) {
    fs.mkdirSync(path.join(process.cwd(), 'data'));
}

const DEFAULT_VERSIONS = {
    chrome: {
        version: 'v1.2.0',
        date: '2025-11-20',
        size: '2.5 MB',
        link: '#'
    },
    windows: {
        version: 'v1.0.5',
        date: '2025-11-15',
        size: '45.2 MB',
        link: '#'
    }
};

export async function GET() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf-8');
            return NextResponse.json(JSON.parse(data));
        }
        return NextResponse.json(DEFAULT_VERSIONS);
    } catch (error) {
        return NextResponse.json(DEFAULT_VERSIONS);
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        fs.writeFileSync(DATA_FILE, JSON.stringify(body, null, 2));
        return NextResponse.json({ success: true, data: body });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to save versions' }, { status: 500 });
    }
}
