'use client';

import { useState, useEffect } from 'react';

interface ProductDraft {
    id: string;
    title: string;
    originalUrl: string;
    images: string; // JSON string
    status: string;
    createdAt: string;
    shopName: string;
}

export default function DraftsPage() {
    const [drafts, setDrafts] = useState<ProductDraft[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDrafts();
    }, []);

    const fetchDrafts = async () => {
        try {
            const res = await fetch('/api/copy/list?userId=demo-user'); // Implement list API later
            // Mock data for now if API not ready
            if (!res.ok) {
                // Fallback mock
                setDrafts([
                    {
                        id: '1',
                        title: '示例商品：得力(deli)A4打印纸 70g 500张/包',
                        originalUrl: 'https://www.zcygov.cn/product/123',
                        images: '["https://img14.360buyimg.com/n1/jfs/t1/186057/22/34834/146229/64547d8cF4780710e/52198425b5714364.jpg"]',
                        status: 'pending',
                        createdAt: new Date().toISOString(),
                        shopName: '得力官方旗舰店'
                    }
                ]);
            } else {
                const data = await res.json();
                setDrafts(data.drafts);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handlePublish = (id: string) => {
        // Open ZCY publish page with auto-fill params
        // Note: In production, this URL might need to be dynamic based on user's ZCY session or entry point
        // For now, we assume a standard entry URL
        const publishUrl = `https://www.zcygov.cn/publish?zcy_auto_fill=true&draft_id=${id}`;
        window.open(publishUrl, '_blank');
    };

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">周转仓库 (Transfer Warehouse)</h1>
                    <p className="text-gray-500 mt-1">管理从其他店铺复制的商品，编辑后一键发布</p>
                </div>
                <div className="flex gap-3">
                    <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">
                        批量改价
                    </button>
                    <button className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800">
                        批量发布
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-4 font-medium text-gray-700">商品信息</th>
                            <th className="px-6 py-4 font-medium text-gray-700">来源店铺</th>
                            <th className="px-6 py-4 font-medium text-gray-700">采集时间</th>
                            <th className="px-6 py-4 font-medium text-gray-700">状态</th>
                            <th className="px-6 py-4 font-medium text-gray-700 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {drafts.map((draft) => {
                            const images = JSON.parse(draft.images || '[]');
                            const mainImage = images[0] || '';

                            return (
                                <tr key={draft.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            {mainImage && (
                                                <img src={mainImage} alt="" className="w-12 h-12 rounded border border-gray-200 object-cover" />
                                            )}
                                            <div>
                                                <div className="font-medium text-gray-900 truncate max-w-md">{draft.title}</div>
                                                <a href={draft.originalUrl} target="_blank" className="text-xs text-blue-600 hover:underline">查看源商品</a>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">{draft.shopName}</td>
                                    <td className="px-6 py-4 text-gray-500">{new Date(draft.createdAt).toLocaleString()}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${draft.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                            }`}>
                                            {draft.status === 'published' ? '已发布' : '待发布'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handlePublish(draft.id)}
                                            className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                                        >
                                            发布
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}

                        {drafts.length === 0 && !loading && (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                    暂无采集数据，请去政采云商品页点击“复制”按钮
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
