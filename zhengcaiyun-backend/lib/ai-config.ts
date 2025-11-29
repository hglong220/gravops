import fs from 'fs';
import path from 'path';

export interface AIProviderConfig {
    id: string;
    name: string;
    provider: 'openai' | 'gemini' | 'deepseek' | 'qwen';
    enabled: boolean;
    priority: number; // 1 = Highest
    baseUrl: string;
    apiKeyPool: string[];
    model: string;
}

export interface AIConfig {
    providers: AIProviderConfig[];
    globalSettings: {
        maxTokens: number;
        temperature: number;
        retryCount: number;
    };
}

const CONFIG_FILE = path.join(process.cwd(), 'data', 'ai-config.json');

export const DEFAULT_CONFIG: AIConfig = {
    globalSettings: {
        maxTokens: 2000,
        temperature: 0.7,
        retryCount: 3
    },
    providers: [
        {
            id: 'openai-primary',
            name: 'OpenAI (GPT-4o)',
            provider: 'openai',
            enabled: true,
            priority: 1,
            baseUrl: 'https://api.openai.com/v1',
            apiKeyPool: [process.env.OPENAI_API_KEY || ''],
            model: 'gpt-4o'
        },
        {
            id: 'gemini-backup',
            name: 'Google Gemini',
            provider: 'gemini',
            enabled: true,
            priority: 2,
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
            apiKeyPool: [],
            model: 'gemini-pro'
        },
        {
            id: 'deepseek-domestic',
            name: 'DeepSeek (Domestic)',
            provider: 'deepseek',
            enabled: true,
            priority: 3,
            baseUrl: 'https://api.deepseek.com/v1',
            apiKeyPool: [],
            model: 'deepseek-chat'
        },
        {
            id: 'qwen-domestic',
            name: 'Qwen (Aliyun)',
            provider: 'qwen',
            enabled: true,
            priority: 4,
            baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
            apiKeyPool: [],
            model: 'qwen-turbo'
        }
    ]
};

export function getAIConfig(): AIConfig {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
            const config = JSON.parse(raw);
            // Merge with default to ensure structure
            return { ...DEFAULT_CONFIG, ...config };
        }
    } catch (e) {
        console.error('Failed to read AI config', e);
    }
    return DEFAULT_CONFIG;
}

export function saveAIConfig(config: AIConfig) {
    try {
        const dir = path.dirname(CONFIG_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    } catch (e) {
        console.error('Failed to save AI config', e);
        throw e;
    }
}
