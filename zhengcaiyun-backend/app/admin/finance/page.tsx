'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FinancePage() {
    const router = useRouter();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchOrders();
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm, statusFilter, dateRange]);

    function fetchOrders() {
        setLoading(true);
        const params = new URLSearchParams();
        if (searchTerm) params.append('search', searchTerm);
        if (statusFilter !== 'all') params.append('status', statusFilter);
        if (dateRange.start) params.append('startDate', dateRange.start);
        if (dateRange.end) params.append('endDate', dateRange.end);

        const token = localStorage.getItem('token');
        if (!token) {
            setLoading(false);
            router.push('/login');
            return;
        }

        fetch(`/api/admin/orders?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then((res) => {
                if (res.status === 401) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    router.push('/login');
                    return null;
                }
                return res.json();
            })
            .then(data => {
                if (!data) return;
                setOrders(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }

    // Calculate Stats from current view
    const totalAmount = orders.reduce((sum, order) => sum + order.amount, 0);
    const paidOrders = orders.filter(o => o.status === 'paid').length;
    const pendingOrders = orders.filter(o => o.status === 'pending').length;

    function handleExport() {
        // Simple CSV Export
        const headers = ['Order ID', 'Company', 'Email', 'Amount (Yuan)', 'Status', 'Payment Method', 'Date'];
        const rows = orders.map(order => [
            order.id,
            order.user?.companyName || '未绑定企业',
            order.user?.email || '',
            (order.amount / 100).toFixed(2),
            order.status === 'paid' ? '已支付' : '待支付',
            '微信支付', // Hardcoded as per user request
            new Date(order.createdAt).toLocaleString()
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `finance_report_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">财务报表</h1>
                    <p className="text-sm text-gray-500 mt-1">查看所有订单流水及支付状态。</p>
                </div>
                <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    导出报表
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                    <p className="text-xs text-gray-500 uppercase font-semibold">总收入 (当前视图)</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">¥{(totalAmount / 100).toFixed(2)}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                    <p className="text-xs text-gray-500 uppercase font-semibold">已支付订单</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">{paidOrders}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                    <p className="text-xs text-gray-500 uppercase font-semibold">待支付订单</p>
                    <p className="text-2xl font-bold text-yellow-600 mt-1">{pendingOrders}</p>
                </div>
            </div>

            {/* Filters Toolbar */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap gap-4 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <input
                        type="text"
                        placeholder="搜索订单号、公司或邮箱..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
                    />
                    <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>

                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 bg-white"
                >
                    <option value="all">所有状态</option>
                    <option value="paid">已支付</option>
                    <option value="pending">待支付</option>
                </select>

                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                        className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5"
                    />
                    <span>至</span>
                    <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                        className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5"
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">订单号</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">客户信息</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">金额</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">支付方式</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">状态</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">时间</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                    加载中...
                                </td>
                            </tr>
                        ) : orders.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                    暂无相关订单
                                </td>
                            </tr>
                        ) : (
                            orders.map((order) => (
                                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="font-mono text-xs text-gray-500">#{order.id.substring(0, 8)}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        <div className="font-bold">{order.user?.companyName || '未绑定企业'}</div>
                                        <div className="text-xs text-gray-500">{order.user?.email}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-sm font-bold text-gray-900">¥{(order.amount / 100).toFixed(2)}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <div className="flex items-center gap-2">
                                            <span className="text-green-600">🟢</span>
                                            微信支付
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${order.status === 'paid'
                                            ? 'bg-green-50 text-green-700 border border-green-100'
                                            : 'bg-yellow-50 text-yellow-700 border border-yellow-100'
                                            }`}>
                                            {order.status === 'paid' ? '已支付' : '待支付'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                                        {new Date(order.createdAt).toLocaleString()}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
