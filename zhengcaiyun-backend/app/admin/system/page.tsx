'use client';

import { useState, useEffect } from 'react';

export default function SystemPage() {
    const [metrics, setMetrics] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMetrics = () => {
            fetch('/api/admin/system')
                .then(res => res.json())
                .then(data => {
                    setMetrics(data);
                    setLoading(false);
                });
        };

        fetchMetrics();
        const interval = setInterval(fetchMetrics, 5000); // Refresh every 5s
        return () => clearInterval(interval);
    }, []);

    if (loading) return <div className="p-8 text-gray-500">Loading system metrics...</div>;
    if (!metrics || metrics.error) return <div className="p-8 text-red-500">Error loading metrics: {metrics?.error || 'Unknown error'}</div>;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">系统监控</h1>
                <p className="text-sm text-gray-500 mt-1">服务器实时资源与日志审计。</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* CPU Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-gray-500 text-sm font-medium">CPU 使用率</h3>
                        <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
                        </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-gray-900">{metrics.cpu.usage}%</span>
                        <span className="text-sm text-gray-500">{metrics.cpu.cores} Cores</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 mt-4 overflow-hidden">
                        <div className="bg-blue-600 h-full rounded-full transition-all duration-500" style={{ width: `${metrics.cpu.usage}%` }}></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-3 truncate">{metrics.cpu.model}</p>
                </div>

                {/* Memory Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-gray-500 text-sm font-medium">内存使用率</h3>
                        <span className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                        </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-gray-900">{metrics.memory.usage}%</span>
                        <span className="text-sm text-gray-500">{metrics.memory.used} / {metrics.memory.total}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 mt-4 overflow-hidden">
                        <div className="bg-purple-600 h-full rounded-full transition-all duration-500" style={{ width: `${metrics.memory.usage}%` }}></div>
                    </div>
                </div>

                {/* Uptime Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-gray-500 text-sm font-medium">系统运行时间</h3>
                        <span className="p-2 bg-green-50 text-green-600 rounded-lg">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-gray-900">{metrics.uptime}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-4">Platform: {metrics.platform}</p>
                </div>
            </div>

            {/* Logs Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">System Logs</h3>
                </div>
                <div className="p-6 bg-gray-900 font-mono text-sm text-gray-300 h-64 overflow-y-auto space-y-2">
                    {metrics.logs && metrics.logs.length > 0 ? (
                        metrics.logs.map((log: any) => (
                            <p key={log.id}>
                                <span className="text-gray-500">[{new Date(log.createdAt).toLocaleString()}]</span>{' '}
                                <span className={`${log.level === 'INFO' ? 'text-blue-400' :
                                    log.level === 'WARN' ? 'text-yellow-400' :
                                        log.level === 'ERROR' ? 'text-red-400' :
                                            'text-green-400'
                                    }`}>[{log.level}]</span>{' '}
                                <span className="text-purple-400">[{log.module}]</span>{' '}
                                {log.message}
                            </p>
                        ))
                    ) : (
                        <p className="text-gray-500">暂无日志...</p>
                    )}
                </div>
            </div>
        </div>
    );
}
