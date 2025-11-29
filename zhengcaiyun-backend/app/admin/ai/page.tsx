'use client';

import { useState, useEffect } from 'react';

interface AIProviderConfig {
    id: string;
    name: string;
    provider: string;
    enabled: boolean;
    priority: number;
    baseUrl: string;
    apiKeyPool: string[];
    model: string;
}

interface AIConfig {
    providers: AIProviderConfig[];
    globalSettings: {
        maxTokens: number;
        temperature: number;
        retryCount: number;
    };
}

export default function AIConfigPage() {
    const [config, setConfig] = useState<AIConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch('/api/admin/ai/config')
            .then(res => res.json())
            .then(data => {
                setConfig(data);
                setLoading(false);
            });
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await fetch('/api/admin/ai/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            alert('配置保存成功');
        } catch (err) {
            alert('保存失败');
        } finally {
            setSaving(false);
        }
    };

    const updateProvider = (index: number, updates: Partial<AIProviderConfig>) => {
        if (!config) return;
        const newProviders = [...config.providers];
        newProviders[index] = { ...newProviders[index], ...updates };
        setConfig({ ...config, providers: newProviders });
    };

    const updateGlobal = (updates: Partial<AIConfig['globalSettings']>) => {
        if (!config) return;
        setConfig({ ...config, globalSettings: { ...config.globalSettings, ...updates } });
    };

    if (loading || !config) return <div className="p-8 text-gray-500">Loading AI config...</div>;

    return (
        <div className="space-y-8 pb-20">
            <div className="flex justify-between items-center sticky top-0 bg-gray-50/80 backdrop-blur-md py-4 z-10 border-b border-gray-200 -mx-8 px-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">AI 服务配置 (多模型高可用)</h1>
                    <p className="text-sm text-gray-500 mt-1">配置主备模型、故障自动切换及 API 密钥池。</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 shadow-lg"
                >
                    {saving ? '保存中...' : '保存所有配置'}
                </button>
            </div>

            {/* Global Settings */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                    全局参数设置
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Max Tokens</label>
                        <input
                            type="number"
                            value={config.globalSettings.maxTokens}
                            onChange={(e) => updateGlobal({ maxTokens: parseInt(e.target.value) })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Temperature (0.0 - 2.0)</label>
                        <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="2"
                            value={config.globalSettings.temperature}
                            onChange={(e) => updateGlobal({ temperature: parseFloat(e.target.value) })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">重试次数 (Retry Count)</label>
                        <input
                            type="number"
                            min="0"
                            max="5"
                            value={config.globalSettings.retryCount}
                            onChange={(e) => updateGlobal({ retryCount: parseInt(e.target.value) })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5"
                        />
                    </div>
                </div>
            </div>

            {/* Providers List */}
            <div className="space-y-6">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    模型服务商配置 (按优先级排序)
                </h2>

                {config.providers.sort((a, b) => a.priority - b.priority).map((provider, index) => {
                    // Find original index in state to update correctly
                    const originalIndex = config.providers.findIndex(p => p.id === provider.id);

                    return (
                        <div key={provider.id} className={`bg-white rounded-2xl border transition-all duration-200 ${provider.enabled ? 'border-gray-200 shadow-sm hover:shadow-md' : 'border-gray-100 opacity-60 bg-gray-50'}`}>
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${provider.provider === 'openai' ? 'bg-green-100 text-green-600' :
                                                provider.provider === 'gemini' ? 'bg-blue-100 text-blue-600' :
                                                    'bg-orange-100 text-orange-600'
                                            }`}>
                                            {provider.provider === 'openai' ? 'O' : provider.provider === 'gemini' ? 'G' : 'D'}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900">{provider.name}</h3>
                                            <p className="text-xs text-gray-500 font-mono">{provider.id}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-gray-500">优先级:</span>
                                            <input
                                                type="number"
                                                min="1"
                                                className="w-16 px-2 py-1 border border-gray-200 rounded text-center text-sm"
                                                value={provider.priority}
                                                onChange={(e) => updateProvider(originalIndex, { priority: parseInt(e.target.value) })}
                                            />
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={provider.enabled}
                                                onChange={(e) => updateProvider(originalIndex, { enabled: e.target.checked })}
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                            <span className="ml-3 text-sm font-medium text-gray-700">{provider.enabled ? '已启用' : '已禁用'}</span>
                                        </label>
                                    </div>
                                </div>

                                {provider.enabled && (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">API Endpoint (Base URL)</label>
                                                <input
                                                    type="text"
                                                    value={provider.baseUrl}
                                                    onChange={(e) => updateProvider(originalIndex, { baseUrl: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black/5"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Model Name</label>
                                                <input
                                                    type="text"
                                                    value={provider.model}
                                                    onChange={(e) => updateProvider(originalIndex, { model: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black/5"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                                API Key Pool (一行一个，随机轮询)
                                                <span className="ml-2 text-green-600 bg-green-50 px-2 py-0.5 rounded-full text-[10px]">
                                                    当前可用: {provider.apiKeyPool.filter(k => k.trim()).length}
                                                </span>
                                            </label>
                                            <textarea
                                                rows={4}
                                                value={provider.apiKeyPool.join('\n')}
                                                onChange={(e) => updateProvider(originalIndex, { apiKeyPool: e.target.value.split('\n') })}
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black/5"
                                                placeholder="sk-key1&#10;sk-key2&#10;sk-key3"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
