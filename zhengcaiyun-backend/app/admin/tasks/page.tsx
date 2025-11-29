'use client';

import { useState, useEffect } from 'react';

export default function AdminTasksPage() {
    const [companies, setCompanies] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Details View State
    const [selectedCompany, setSelectedCompany] = useState<any>(null);
    const [details, setDetails] = useState<any[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    useEffect(() => {
        fetchCompanies();
    }, []);

    const fetchCompanies = () => {
        setLoading(true);
        fetch('/api/admin/tasks?mode=grouped')
            .then(res => res.json())
            .then(data => {
                setCompanies(data.companies || []);
                setLoading(false);
            });
    };

    const handleShowDetails = async (company: any) => {
        setSelectedCompany(company);
        setLoadingDetails(true);
        try {
            const res = await fetch(`/api/admin/tasks?mode=details&userId=${company.userId}`);
            const data = await res.json();
            setDetails(data.drafts || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingDetails(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">任务监控</h1>
                    <p className="text-sm text-gray-500 mt-1">按公司维度监控采集与上架任务状态。</p>
                </div>
                <button
                    onClick={fetchCompanies}
                    className="p-2 text-gray-500 hover:text-black hover:hover:bg-gray-100 rounded-xl transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {loading ? (
                    <div className="text-center py-12 text-gray-500">Loading...</div>
                ) : companies.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">暂无活跃公司</div>
                ) : (
                    companies.map((company) => (
                        <div key={company.userId} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
                            {/* Main Summary Row */}
                            <div className="p-4 flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="text-sm font-bold text-gray-900 whitespace-nowrap">{company.companyName}</div>
                                    <div className="text-xs text-gray-500 truncate">{company.email}</div>
                                </div>

                                <div className="flex items-center gap-6 flex-1 justify-end">
                                    {company.runningTasks > 0 ? (
                                        <span className="px-2.5 py-0.5 inline-flex text-xs font-medium rounded-full bg-blue-50 text-blue-700 items-center whitespace-nowrap">
                                            <svg className="animate-spin -ml-0.5 mr-1.5 h-3 w-3 text-blue-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                            {company.runningTasks} 个任务进行中
                                        </span>
                                    ) : (
                                        <span className="text-sm text-gray-500 whitespace-nowrap">无运行任务</span>
                                    )}

                                    <div className="flex items-center gap-3">
                                        <div className="w-20 bg-gray-100 rounded-full h-1.5 overflow-hidden hidden sm:block">
                                            <div
                                                className="h-full rounded-full bg-green-500"
                                                style={{ width: `${company.totalLinks ? (company.successLinks / company.totalLinks) * 100 : 0}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-xs text-gray-500 whitespace-nowrap">
                                            {company.successLinks} / {company.totalLinks}
                                        </span>
                                        <span className="text-xs text-gray-400 whitespace-nowrap">
                                            成功率: {company.totalLinks ? Math.round((company.successLinks / company.totalLinks) * 100) : 0}%
                                        </span>
                                    </div>

                                    <div className="text-sm text-gray-500 whitespace-nowrap">
                                        {new Date(company.lastActive).toLocaleString()}
                                    </div>
                                </div>
                            </div>

                            {/* Details Section (Collapsible) */}
                            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${selectedCompany?.userId === company.userId ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                <div className="px-6 pb-6 pt-0">
                                    {loadingDetails && selectedCompany?.userId === company.userId ? (
                                        <div className="flex justify-center py-4">
                                            <svg className="animate-spin h-6 w-6 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        </div>
                                    ) : details.length === 0 ? (
                                        <div className="text-center text-gray-500 py-4">暂无详细记录</div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-2">
                                            {details.map((draft) => (
                                                <div key={draft.id} className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex items-center justify-between">
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${draft.status === 'published' ? 'bg-green-500' :
                                                            draft.status === 'failed' ? 'bg-red-500' :
                                                                'bg-blue-500 animate-pulse'
                                                            }`}></span>
                                                        <div className="truncate">
                                                            <div className="text-sm font-medium text-gray-900 truncate">{draft.title || '正在获取标题...'}</div>
                                                            <div className="text-xs text-gray-400 truncate font-mono">{draft.originalUrl}</div>
                                                        </div>
                                                    </div>
                                                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-md flex-shrink-0 ${draft.status === 'published' ? 'bg-green-50 text-green-600' :
                                                        draft.status === 'failed' ? 'bg-red-50 text-red-600' :
                                                            'bg-blue-50 text-blue-600'
                                                        }`}>
                                                        {draft.status}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Expand Button (Bottom) */}
                            <button
                                onClick={() => {
                                    if (selectedCompany?.userId === company.userId) {
                                        setSelectedCompany(null);
                                    } else {
                                        handleShowDetails(company);
                                    }
                                }}
                                className="w-full py-1 bg-white hover:bg-gray-50 border-t border-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors gap-1 text-xs font-medium uppercase tracking-wider"
                            >

                                <svg
                                    className={`w-4 h-4 transition-transform duration-300 ${selectedCompany?.userId === company.userId ? 'rotate-180' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

