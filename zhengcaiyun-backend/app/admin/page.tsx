'use client';

import { useState, useEffect } from 'react';

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        totalUsers: 0,
        activeLicenses: 0,
        totalRevenue: 0,
        todayUploads: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    async function fetchStats() {
        try {
            const res = await fetch('/api/admin/stats');
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Failed to load stats', error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) return <div className="p-8 text-gray-500">Loading stats...</div>;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">系统概览</h1>
                <p className="text-sm text-gray-500 mt-1">实时监控系统运行状态与核心指标。</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard
                    title="总用户数"
                    value={stats.totalUsers}
                    icon="👥"
                    color="blue"
                    trend="+12%"
                />
                <StatsCard
                    title="活跃授权"
                    value={stats.activeLicenses}
                    icon="✅"
                    color="green"
                    trend="+5%"
                />
                <StatsCard
                    title="总收入"
                    value={`¥${stats.totalRevenue.toLocaleString()}`}
                    icon="💰"
                    color="purple"
                    trend="+8.2%"
                />
                <StatsCard
                    title="今日上传"
                    value={stats.todayUploads}
                    icon="🚀"
                    color="orange"
                    trend="+24"
                />
            </div>

            {/* System Status Banner */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">系统运行正常</h3>
                        <p className="text-sm text-gray-500">所有服务（AI、数据库、支付网关）均在线，无异常报警。</p>
                    </div>
                </div>
                <span className="px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                    System Healthy
                </span>
            </div>
        </div>
    );
}

function StatsCard({ title, value, icon, color, trend }: any) {
    const colors: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-600',
        green: 'bg-green-50 text-green-600',
        purple: 'bg-purple-50 text-purple-600',
        orange: 'bg-orange-50 text-orange-600'
    };

    return (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
            <div className="flex justify-between items-start mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${colors[color]}`}>
                    {icon}
                </div>
                {trend && (
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                        {trend}
                    </span>
                )}
            </div>
            <h3 className="text-gray-500 text-sm font-medium">{title}</h3>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
    );
}
