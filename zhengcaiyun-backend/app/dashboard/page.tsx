'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
    const router = useRouter();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showAllActivity, setShowAllActivity] = useState(false);

    useEffect(() => {
        const fetchStats = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                setLoading(false);
                return;
            }

            try {
                const res = await fetch('/api/user/stats', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (res.status === 401) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    router.push('/login');
                    return;
                }

                if (res.ok) {
                    const data = await res.json();
                    setStats(data);
                }
            } catch (error) {
                console.error('Failed to fetch stats', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [router]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500 flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    加载数据中...
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">总览</h1>
                <p className="text-sm text-gray-500 mt-1">欢迎回来，这里是您的自动化控制中心。</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatsCard
                    title="今日上传"
                    value={stats?.todayUploads?.toString() || '0'}
                    trend={stats?.todayUploads > 0 ? "活跃" : "无活动"}
                    trendUp={stats?.todayUploads > 0}
                    icon={
                        <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                    }
                />
                <StatsCard
                    title="成功率"
                    value={`${stats?.successRate || '0.0'}%`}
                    trend={parseFloat(stats?.successRate || '0') > 90 ? "优秀" : "一般"}
                    trendUp={parseFloat(stats?.successRate || '0') > 90}
                    icon={
                        <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    }
                />
                <StatsCard
                    title="在线状态"
                    value={stats?.license?.daysRemaining ? `${stats.license.daysRemaining}天` : '未激活'}
                    valueClassName={stats?.license?.daysRemaining ? undefined : "text-lg font-normal text-gray-500"}
                    subtext={stats?.license?.plan || '免费版'}
                    icon={
                        <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    }
                />
            </div>

            {/* Recent Activity */}
            <div className={`bg-white rounded-2xl border border-gray-200 overflow-hidden transition-all duration-500 ease-in-out flex flex-col ${showAllActivity ? 'h-[600px]' : 'h-auto'}`}>
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center flex-shrink-0 bg-white z-10">
                    <h3 className="font-bold text-gray-900">最近活动</h3>
                    <button
                        onClick={() => setShowAllActivity(!showAllActivity)}
                        className="text-sm text-gray-500 hover:text-black transition-colors"
                    >
                        {showAllActivity ? '收起' : '查看全部'}
                    </button>
                </div>
                <div className="divide-y divide-gray-100 overflow-y-auto flex-1">
                    {stats?.recentActivity?.length > 0 ? (
                        stats.recentActivity.map((item: any) => (
                            <div key={item.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">上传商品：{item.title}</p>
                                        <p className="text-xs text-gray-500">
                                            {new Date(item.createdAt).toLocaleString()} · 自动分类：{item.categoryPath || '未知'}
                                        </p>
                                    </div>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${item.status === 'published' ? 'bg-green-100 text-green-700' :
                                        item.status === 'failed' ? 'bg-red-100 text-red-700' :
                                            'bg-blue-100 text-blue-700'
                                    }`}>
                                    {item.status === 'published' ? '成功' : item.status === 'failed' ? '失败' : '处理中'}
                                </span>
                            </div>
                        ))
                    ) : (
                        <div className="px-6 py-8 text-center text-gray-500 text-sm">
                            暂无活动记录
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatsCard({ title, value, trend, trendUp, subtext, icon, valueClassName }: any) {
    return (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-gray-50 rounded-xl">
                    {icon}
                </div>
                {trend && (
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${trendUp ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {trend}
                    </span>
                )}
            </div>
            <h3 className="text-gray-500 text-sm font-medium">{title}</h3>
            <div className="mt-1 flex items-baseline gap-2">
                <span className={valueClassName || "text-3xl font-bold text-gray-900"}>{value}</span>
                {subtext && <span className="text-sm text-gray-400">{subtext}</span>}
            </div>
        </div>
    );
}
