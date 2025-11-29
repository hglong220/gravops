import { create } from 'zustand';

interface AppState {
    // 授权状态
    isActivated: boolean;
    licenseKey: string | null;
    companyName: string | null;
    expiresAt: number | null;

    // 任务状态
    isRunning: boolean;
    currentTask: string | null;
    progress: number;

    // 设置
    apiKey: string | null;

    // Actions
    setActivated: (activated: boolean) => void;
    setLicense: (key: string, company: string, expires: number) => void;
    setRunning: (running: boolean) => void;
    setTask: (task: string | null) => void;
    setProgress: (progress: number) => void;
    setApiKey: (key: string) => void;
    reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
    // 初始状态
    isActivated: false,
    licenseKey: null,
    companyName: null,
    expiresAt: null,
    isRunning: false,
    currentTask: null,
    progress: 0,
    apiKey: null,

    // Actions
    setActivated: (activated) => set({ isActivated: activated }),

    setLicense: (key, company, expires) => set({
        licenseKey: key,
        companyName: company,
        expiresAt: expires,
        isActivated: true
    }),

    setRunning: (running) => set({ isRunning: running }),

    setTask: (task) => set({ currentTask: task }),

    setProgress: (progress) => set({ progress }),

    setApiKey: (key) => set({ apiKey: key }),

    reset: () => set({
        isActivated: false,
        licenseKey: null,
        companyName: null,
        expiresAt: null,
        isRunning: false,
        currentTask: null,
        progress: 0
    })
}));
