'use client';

import { useState, useEffect } from 'react';

export default function LicensesPage() {
    const [licenses, setLicenses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchLicenses();
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    function fetchLicenses() {
        setLoading(true);
        fetch(`/api/admin/licenses?search=${encodeURIComponent(searchTerm)}`)
            .then(res => res.json())
            .then(data => {
                setLicenses(data);
                setLoading(false);
            });
    }

    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [genForm, setGenForm] = useState({ companyName: '', duration: 30 });

    async function handleGenerate() {
        const res = await fetch('/api/admin/licenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                plan: 'pro',
                durationDays: Number(genForm.duration),
                companyName: genForm.companyName || undefined
            })
        });
        if (res.ok) {
            setShowGenerateModal(false);
            fetchLicenses();
            setGenForm({ companyName: '', duration: 30 }); // Reset
        }
    }

    async function updateLicense(id: string, action: 'extend' | 'revoke') {
        if (!confirm(action === 'extend' ? '确认延期30天？' : '确认吊销此授权？')) return;

        const res = await fetch(`/api/admin/licenses/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
        });

        if (res.ok) {
            fetchLicenses();
        }
    }

    if (loading && !licenses.length) return <div className="p-8 text-gray-500">Loading licenses...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">授权管理</h1>
                    <p className="text-sm text-gray-500 mt-1">管理软件授权码及有效期。</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="搜索密钥、公司或邮箱..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-64 pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
                        />
                        <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <button
                        onClick={() => setShowGenerateModal(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 shadow-sm hover:shadow transition-all text-sm font-medium flex items-center"
                    >
                        <span className="mr-2">+</span> 生成测试 License
                    </button>
                </div>
            </div>

            {/* Generate Modal */}
            {showGenerateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="text-lg font-bold text-gray-900">生成测试 License</h3>
                            <button
                                onClick={() => setShowGenerateModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">企业名称 (可选)</label>
                                <input
                                    type="text"
                                    placeholder="输入企业名称以生成专属 Key"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    value={genForm.companyName}
                                    onChange={e => setGenForm({ ...genForm, companyName: e.target.value })}
                                />
                                <p className="text-xs text-gray-500 mt-1">若填写，Key 将包含该企业的专属特征码。</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">有效期 (天)</label>
                                <input
                                    type="number"
                                    min="1"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    value={genForm.duration}
                                    onChange={e => setGenForm({ ...genForm, duration: Number(e.target.value) })}
                                />
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end space-x-3">
                            <button
                                onClick={() => setShowGenerateModal(false)}
                                className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleGenerate}
                                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                            >
                                确认生成
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">密钥</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">归属用户</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">状态</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">有效期至</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">操作</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {licenses.map((license) => (
                            <tr key={license.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <code className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-700 select-all">
                                        {license.key}
                                    </code>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-bold text-gray-900">
                                        {license.user?.companyName || license.companyName || '未绑定企业'}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${license.status === 'active'
                                        ? 'bg-green-50 text-green-700 border border-green-100'
                                        : 'bg-red-50 text-red-700 border border-red-100'
                                        }`}>
                                        {license.status === 'active' ? '生效中' : '已失效'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {new Date(license.expiresAt).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                    <button
                                        onClick={() => updateLicense(license.id, 'extend')}
                                        className="text-blue-600 hover:text-blue-900 bg-blue-50 px-3 py-1 rounded-lg hover:bg-blue-100 transition-colors"
                                    >
                                        延期
                                    </button>
                                    {license.status === 'active' && (
                                        <button
                                            onClick={() => updateLicense(license.id, 'revoke')}
                                            className="text-red-600 hover:text-red-900 bg-red-50 px-3 py-1 rounded-lg hover:bg-red-100 transition-colors"
                                        >
                                            吊销
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
