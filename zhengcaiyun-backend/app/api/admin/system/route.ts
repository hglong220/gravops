import { NextResponse } from 'next/server';
import os from 'os';

import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const cpus = os.cpus();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;

        const cpuUsage = cpus.length > 0 ?
            cpus.reduce((acc, cpu) => {
                const total = Object.values(cpu.times).reduce((a, b) => a + b);
                const idle = cpu.times.idle;
                return acc + ((total - idle) / total);
            }, 0) / cpus.length : 0;

        let logs = [];
        try {
            logs = await prisma.systemLog.findMany({
                orderBy: { createdAt: 'desc' },
                take: 50
            });
        } catch (e) {
            console.warn('Failed to fetch system logs (schema might be out of sync):', e);
            // Fallback to empty logs so the page doesn't crash
        }

        return NextResponse.json({
            cpu: {
                model: cpus[0]?.model || 'Unknown',
                cores: cpus.length,
                usage: (cpuUsage * 100).toFixed(1)
            },
            memory: {
                total: (totalMem / 1024 / 1024 / 1024).toFixed(2) + ' GB',
                used: (usedMem / 1024 / 1024 / 1024).toFixed(2) + ' GB',
                usage: ((usedMem / totalMem) * 100).toFixed(1)
            },
            uptime: (os.uptime() / 3600).toFixed(2) + ' Hours',
            platform: os.platform() + ' ' + os.release(),
            logs
        });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch system metrics' }, { status: 500 });
    }
}
