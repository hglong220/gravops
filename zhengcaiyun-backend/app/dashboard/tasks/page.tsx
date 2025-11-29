'use client';

import { useState, useEffect } from 'react';


interface ProductDraft {
    id: string;
    title: string;
    originalUrl: string;
    shopName: string;
    status: string;
    createdAt: Date;
    copyTaskId?: string;
    skuData?: string;
    detailHtml?: string;
}

interface CopyTask {
    id: string;
    shopName: string;
    shopUrl: string;
    totalCount: number;
    successCount: number;
    failedCount: number;
    status: string;
    createdAt: Date;
}

interface TaskGroup {
    id: string;
    name: string;
    icon: string;
    count: number;
    type: 'single' | 'batch' | 'batch-all';
    status?: string;
    progress?: { current: number; total: number };
}

export default function UnifiedTaskCenter() {
    const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([]);
    const [products, setProducts] = useState<ProductDraft[]>([]);
    const [selectedTask, setSelectedTask] = useState<string>('single');
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, pending: 0, published: 0 });

    // Mock ZCY Categories
    const ZCY_CATEGORIES = [
        {
            name: '计算机设备', children: [
                {
                    name: '便携式计算机', children: [
                        { name: '通用笔记本电脑' },
                        { name: '移动工作站' },
                        { name: '国产笔记本' }
                    ]
                },
                {
                    name: '台式计算机', children: [
                        { name: '台式一体机' },
                        { name: '分体式台式机' },
                        { name: '国产台式机' }
                    ]
                },
                {
                    name: '显示器', children: [
                        { name: 'LED显示器' },
                        { name: '触控显示器' }
                    ]
                }
            ]
        },
        {
            name: '办公设备', children: [
                {
                    name: '打印设备', children: [
                        { name: 'A4黑白激光打印机' },
                        { name: 'A3彩色激光打印机' },
                        { name: '喷墨打印机' }
                    ]
                },
                {
                    name: '复印设备', children: [
                        { name: '高速复印机' },
                        { name: '便携式复印机' }
                    ]
                }
            ]
        }
    ];

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any>(null);
    // Category Selection State
    const [catL1, setCatL1] = useState('');
    const [catL2, setCatL2] = useState('');
    const [catL3, setCatL3] = useState('');

    const fetchData = async () => {
        try {
            // Fetch all drafts
            const draftsRes = await fetch('http://localhost:3000/api/copy/drafts');
            const draftsData = await draftsRes.json();
            const allDrafts = draftsData.drafts || [];

            // Fetch batch tasks
            const tasksRes = await fetch('http://localhost:3000/api/copy/tasks');
            const tasksData = await tasksRes.json();
            const batchTasks = tasksData.tasks || [];

            // Build task groups
            const groups: TaskGroup[] = [];

            // 1. Single Collection (单品采集)
            const singleProducts = allDrafts.filter((d: ProductDraft) => !d.copyTaskId && (d as any).sourceType !== 'smart');
            groups.push({
                id: 'single',
                name: '单品采集',
                icon: '📦',
                count: singleProducts.length,
                type: 'single'
            });

            // 2. Smart Collection (智能采集)
            const smartProducts = allDrafts.filter((d: ProductDraft) => (d as any).sourceType === 'smart');
            groups.push({
                id: 'smart',
                name: '智能采集',
                icon: '🤖',
                count: smartProducts.length,
                type: 'single'
            });

            // 3. Centralized Collection (集中采集)
            const batchTotal = batchTasks.reduce((acc: number, t: CopyTask) => acc + t.totalCount, 0);
            groups.push({
                id: 'batch-all',
                name: '集中采集',
                icon: '🏪',
                count: batchTotal,
                type: 'batch-all'
            });

            setTaskGroups(groups);

            // Calculate stats
            setStats({
                total: allDrafts.length,
                pending: allDrafts.filter((d: ProductDraft) => d.status === 'pending' || d.status === 'scraped').length,
                published: allDrafts.filter((d: ProductDraft) => d.status === 'published').length
            });

        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchProductsForTask = async (taskId: string) => {
        try {
            const res = await fetch('http://localhost:3000/api/copy/drafts');
            const data = await res.json();
            const allDrafts = data.drafts || [];

            let filtered = [];
            if (taskId === 'single') {
                filtered = allDrafts.filter((d: ProductDraft) => !d.copyTaskId && (d as any).sourceType !== 'smart');
            } else if (taskId === 'smart') {
                filtered = allDrafts.filter((d: ProductDraft) => (d as any).sourceType === 'smart');
            } else if (taskId === 'batch-all') {
                filtered = allDrafts.filter((d: ProductDraft) => d.copyTaskId);
            } else {
                filtered = allDrafts.filter((d: ProductDraft) => d.copyTaskId === taskId);
            }

            setProducts(filtered);
        } catch (error) {
            console.error('Failed to fetch products:', error);
        }
    };

    const handlePublish = (draftId: string) => {
        window.open(`https://www.zcygov.cn/publish?draft_id=${draftId}`, '_blank');
    };

    const handleTaskAction = async (taskId: string, action: 'pause' | 'resume' | 'delete') => {
        if (action === 'delete' && !confirm('确定要删除该任务及其所有商品吗？')) return;

        try {
            let url = `http://localhost:3000/api/copy/tasks/${taskId}`;
            let method = 'POST';

            if (action === 'pause') url += '/pause';
            if (action === 'resume') url += '/resume';
            if (action === 'delete') method = 'DELETE';

            const res = await fetch(url, { method });
            if (res.ok) {
                fetchData();
                if (action === 'delete' && selectedTask === taskId) {
                    setSelectedTask('single');
                }
            } else {
                alert('操作失败');
            }
        } catch (error) {
            console.error('Task action failed:', error);
            alert('操作出错');
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        fetchProductsForTask(selectedTask);
    }, [selectedTask]);

    const openEditModal = (product: ProductDraft) => {
        const skuData = JSON.parse(product.skuData || '{}');

        // Mock Category Parsing or Default
        // In real app, product.categoryPath would come from DB
        const currentPath = (product as any).categoryPath || '计算机设备/便携式计算机/通用笔记本电脑';
        const [l1, l2, l3] = currentPath.split('/');

        setCatL1(l1 || '');
        setCatL2(l2 || '');
        setCatL3(l3 || '');

        setEditingProduct({
            id: product.id,
            title: product.title,
            price: skuData.price || '',
            stock: skuData.stock || '',
            detailHtml: product.detailHtml || '',
            categoryPath: currentPath
        });
        setIsEditModalOpen(true);
    };

    const handleCategoryChange = (level: 1 | 2 | 3, value: string) => {
        if (level === 1) {
            setCatL1(value);
            setCatL2('');
            setCatL3('');
        } else if (level === 2) {
            setCatL2(value);
            setCatL3('');
        } else {
            setCatL3(value);
        }

        // Update editingProduct immediately for preview (optional)
        // Final string construction happens on Save or here
    };

    const saveProduct = async () => {
        if (!editingProduct) return;

        const fullCategoryPath = [catL1, catL2, catL3].filter(Boolean).join('/');

        try {
            const res = await fetch(`http://localhost:3000/api/copy/drafts/${editingProduct.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: editingProduct.title,
                    price: editingProduct.price,
                    stock: editingProduct.stock,
                    detailHtml: editingProduct.detailHtml,
                    categoryPath: fullCategoryPath // Save the category
                })
            });

            if (res.ok) {
                setIsEditModalOpen(false);
                fetchProductsForTask(selectedTask); // Refresh list
            } else {
                alert('保存失败');
            }
        } catch (error) {
            console.error('Save failed:', error);
            alert('保存出错');
        }
    };

    const getStatusBadge = (status: string) => {
        const map: Record<string, { text: string; color: string }> = {
            'pending': { text: '待采集', color: 'bg-gray-100 text-gray-600' },
            'scraped': { text: '已采集', color: 'bg-blue-100 text-blue-600' },
            'published': { text: '已发布', color: 'bg-green-100 text-green-600' }
        };
        const badge = map[status] || { text: status, color: 'bg-gray-100 text-gray-600' };
        return <span className={`px-2 py-1 rounded text-xs font-medium ${badge.color}`}>{badge.text}</span>;
    };

    return (
        <div className="h-full flex flex-col relative">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">任务中心</h1>
                <p className="text-gray-500 mt-1">统一管理商品采集和发布任务</p>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                    <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                    <div className="text-sm text-gray-500">总商品数</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">{stats.pending}</div>
                    <div className="text-sm text-gray-500">待发布</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{stats.published}</div>
                    <div className="text-sm text-gray-500">已发布</div>
                </div>
            </div>

            {/* Master-Detail Layout */}
            <div className="flex-1 flex gap-[30px] overflow-hidden">
                {/* Left Panel: Task Groups */}
                <div className="w-80 bg-white rounded-lg border border-gray-200 overflow-y-auto self-stretch">
                    <div className="p-4 border-b border-gray-200">
                        <h2 className="font-semibold text-gray-900">任务列表</h2>
                    </div>
                    <div className="p-2">
                        {taskGroups.map((group, index) => {
                            const isActive = selectedTask === group.id;
                            const showBatchHeader = group.type === 'batch' && (index === 0 || taskGroups[index - 1].type !== 'batch');

                            return (
                                <div key={group.id}>
                                    {showBatchHeader && (
                                        <div className="px-3 py-2 mt-4 mb-1 text-xs font-semibold text-gray-400 uppercase">
                                            集中采集 (整店)
                                        </div>
                                    )}
                                    <div className="mb-1 group relative">
                                        <button
                                            onClick={() => setSelectedTask(group.id)}
                                            className={`w-full text-left p-3 rounded-lg transition-colors ${isActive ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'
                                                }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-medium text-gray-900 truncate max-w-[140px]">{group.name}</span>
                                                        {group.status === 'paused' && (
                                                            <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">暂停</span>
                                                        )}
                                                    </div>
                                                    {group.type === 'batch' && group.progress && (
                                                        <div className="mt-2">
                                                            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                                                <span>{group.progress.current} / {group.progress.total}</span>
                                                                <span>{Math.round((group.progress.current / group.progress.total) * 100)}%</span>
                                                            </div>
                                                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                                                                <div
                                                                    className={`h-1.5 rounded-full ${group.status === 'paused' ? 'bg-yellow-500' : 'bg-blue-600'}`}
                                                                    style={{ width: `${(group.progress.current / group.progress.total) * 100}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="text-sm font-medium text-gray-500 ml-2">{group.count}</span>
                                            </div>
                                        </button>

                                        {/* Task Controls (Hover) */}
                                        {group.type === 'batch' && (
                                            <div className="absolute top-2 right-2 hidden group-hover:flex gap-1 bg-white shadow-sm rounded p-1 border border-gray-100">
                                                {group.status === 'running' ? (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleTaskAction(group.id, 'pause'); }}
                                                        className="p-1 hover:bg-gray-100 rounded text-gray-600"
                                                        title="暂停"
                                                    >
                                                        ⏸️
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleTaskAction(group.id, 'resume'); }}
                                                        className="p-1 hover:bg-gray-100 rounded text-green-600"
                                                        title="恢复"
                                                    >
                                                        ▶️
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleTaskAction(group.id, 'delete'); }}
                                                    className="p-1 hover:bg-gray-100 rounded text-red-600"
                                                    title="删除"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Panel: Product List */}
                <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                        <h2 className="font-semibold text-gray-900">商品列表</h2>
                        <div className="flex gap-2">
                            <button className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
                                批量发布
                            </button>
                            <button className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
                                批量删除
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="text-center py-12">
                                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                            </div>
                        ) : products.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                暂无商品
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">商品</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">来源平台</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">采集时间</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {products.map((product) => (
                                        <tr key={product.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3">
                                                <div className="text-black truncate max-w-md" style={{ fontFamily: 'SimHei, "Microsoft JhengHei", sans-serif' }}>{product.title}</div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-500" title={product.shopName}>
                                                {(() => {
                                                    const url = product.originalUrl || '';
                                                    if (url.includes('jd.com')) return '京东';
                                                    if (url.includes('tmall.com')) return '天猫';
                                                    if (url.includes('suning.com')) return '苏宁';
                                                    if (url.includes('zcygov.cn')) return '政采云';
                                                    if (url.includes('taobao.com')) return '淘宝 (不支持)';
                                                    return '其他';
                                                })()}
                                            </td>
                                            <td className="px-4 py-3">{getStatusBadge(product.status)}</td>
                                            <td className="px-4 py-3 text-sm text-gray-500">
                                                {new Date(product.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handlePublish(product.id)}
                                                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                                                    >
                                                        发布
                                                    </button>
                                                    <button
                                                        onClick={() => openEditModal(product)}
                                                        className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                                                    >
                                                        编辑
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && editingProduct && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-[700px] max-h-[85vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900">编辑商品信息</h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Category Selector (ZCY Standard) */}
                            <div className="bg-blue-50 p-5 rounded-xl border border-blue-100">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-lg">🏷️</span>
                                    <label className="block text-sm font-bold text-blue-900">政采云标准类目</label>
                                    <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">机器核对 + 人工调整</span>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    {/* Level 1 */}
                                    <div>
                                        <label className="block text-xs text-blue-600 mb-1">一级类目</label>
                                        <select
                                            className="w-full border-blue-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                                            value={catL1}
                                            onChange={(e) => handleCategoryChange(1, e.target.value)}
                                        >
                                            <option value="">请选择</option>
                                            {ZCY_CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                        </select>
                                    </div>

                                    {/* Level 2 */}
                                    <div>
                                        <label className="block text-xs text-blue-600 mb-1">二级类目</label>
                                        <select
                                            className="w-full border-blue-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                                            value={catL2}
                                            onChange={(e) => handleCategoryChange(2, e.target.value)}
                                            disabled={!catL1}
                                        >
                                            <option value="">请选择</option>
                                            {catL1 && ZCY_CATEGORIES.find(c => c.name === catL1)?.children.map(c => (
                                                <option key={c.name} value={c.name}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Level 3 */}
                                    <div>
                                        <label className="block text-xs text-blue-600 mb-1">三级类目</label>
                                        <select
                                            className="w-full border-blue-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                                            value={catL3}
                                            onChange={(e) => handleCategoryChange(3, e.target.value)}
                                            disabled={!catL2}
                                        >
                                            <option value="">请选择</option>
                                            {catL1 && catL2 && ZCY_CATEGORIES.find(c => c.name === catL1)?.children.find(c => c.name === catL2)?.children.map((c: any) => (
                                                <option key={c.name} value={c.name}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="mt-3 flex items-start gap-2">
                                    <svg className="w-4 h-4 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <p className="text-xs text-blue-600 leading-relaxed">
                                        当前选择：<span className="font-bold">{[catL1, catL2, catL3].filter(Boolean).join(' > ') || '未选择'}</span>
                                        <br />
                                        <span className="opacity-75">系统已根据商品信息自动匹配最可能的类目，如有误请手动修正。</span>
                                    </p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">商品标题</label>
                                <input
                                    type="text"
                                    className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-black focus:border-black"
                                    value={editingProduct.title}
                                    onChange={e => setEditingProduct({ ...editingProduct, title: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">价格 (元)</label>
                                    <input
                                        type="number"
                                        className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-black focus:border-black"
                                        value={editingProduct.price}
                                        onChange={e => setEditingProduct({ ...editingProduct, price: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">库存</label>
                                    <input
                                        type="number"
                                        className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-black focus:border-black"
                                        value={editingProduct.stock}
                                        onChange={e => setEditingProduct({ ...editingProduct, stock: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">商品详情 (HTML)</label>
                                <textarea
                                    className="w-full border border-gray-300 rounded px-3 py-2 h-40 font-mono text-xs focus:ring-black focus:border-black"
                                    value={editingProduct.detailHtml}
                                    onChange={e => setEditingProduct({ ...editingProduct, detailHtml: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100">
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={saveProduct}
                                className="px-5 py-2.5 bg-black text-white rounded-lg hover:opacity-80 font-medium transition-opacity shadow-lg shadow-gray-200"
                            >
                                保存修改
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
