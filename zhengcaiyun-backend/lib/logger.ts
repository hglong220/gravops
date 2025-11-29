import { prisma } from './prisma';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
export type LogModule = 'AUTH' | 'TASK' | 'AI' | 'SYSTEM';

export async function log(level: LogLevel, module: LogModule, message: string, meta?: any) {
    try {
        // We use a try-catch to ensure logging never breaks the main application flow
        await prisma.systemLog.create({
            data: {
                level,
                module,
                message,
                meta: meta ? JSON.stringify(meta) : undefined
            }
        });
    } catch (error) {
        console.error('[Logger] Failed to write log:', error);
    }
}

export const logger = {
    info: (module: LogModule, message: string, meta?: any) => log('INFO', module, message, meta),
    warn: (module: LogModule, message: string, meta?: any) => log('WARN', module, message, meta),
    error: (module: LogModule, message: string, meta?: any) => log('ERROR', module, message, meta),
    success: (module: LogModule, message: string, meta?: any) => log('SUCCESS', module, message, meta),
};
