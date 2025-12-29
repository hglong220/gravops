/**
 * 统一日志管理工具
 */
export const Logger = {
    _logs: [] as string[],

    log(...args: any[]) {
        const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')
        console.log("%c[助手]", "color: #2196F3; font-weight: bold;", ...args)
        this._logs.push(`[LOG] ${new Date().toLocaleTimeString()} ${msg}`)
        if (this._logs.length > 1000) this._logs.shift()
    },

    warn(...args: any[]) {
        const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')
        console.warn("%c[警告]", "color: #FF9800; font-weight: bold;", ...args)
        this._logs.push(`[WARN] ${new Date().toLocaleTimeString()} ${msg}`)
    },

    error(...args: any[]) {
        const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')
        console.error("%c[错误]", "color: #F44336; font-weight: bold;", ...args)
        this._logs.push(`[ERROR] ${new Date().toLocaleTimeString()} ${msg}`)
    },

    section(title: string) {
        console.log(`%c\n--- ${title} ---`, "color: #9C27B0; font-weight: bold; font-size: 1.2em;")
        this._logs.push(`\n[SECTION] ${title}`)
    },

    getHistory() {
        return this._logs.join('\n')
    }
}

// 暴露到 window 方便调试
if (typeof window !== 'undefined') {
    (window as any).ZCY_LOGGER = Logger
}
