'use client';

import { useEffect, useState } from 'react';

interface FieldRule {
    id: string;
    label: string;
    controlType: string;
    action: 'input' | 'select' | 'skip';
    value: string;
    alternatives?: string[];
    priority: number;
    source: 'manual' | 'ai';
    category?: string;
    note?: string;
    createdAt: string;
    usageCount: number;
}

interface RulesData {
    version: string;
    updatedAt: string;
    rules: FieldRule[];
}

export default function FieldRulesPage() {
    const [rulesData, setRulesData] = useState<RulesData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingRule, setEditingRule] = useState<FieldRule | null>(null);
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [filterSource, setFilterSource] = useState<string>('all');

    // 加载规则
    const loadRules = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/field-rules');
            if (!response.ok) throw new Error('加载失败');
            const data = await response.json();
            setRulesData(data);
            setError(null);
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRules();
    }, []);

    // 保存规则
    const saveRule = async (rule: Partial<FieldRule>) => {
        try {
            const isNew = !rule.id || rule.id.startsWith('new_');
            const response = await fetch('/api/field-rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rule)
            });

            if (!response.ok) throw new Error('保存失败');

            await loadRules();
            setEditingRule(null);
            setIsAddingNew(false);
        } catch (err) {
            alert('保存失败: ' + String(err));
        }
    };

    // 删除规则
    const deleteRule = async (id: string) => {
        if (!confirm('确定要删除这条规则吗？')) return;

        try {
            const response = await fetch(`/api/field-rules/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('删除失败');

            await loadRules();
        } catch (err) {
            alert('删除失败: ' + String(err));
        }
    };

    // 获取所有类别
    const categories = rulesData
        ? [...new Set(rulesData.rules.map(r => r.category || '未分类'))]
        : [];

    // 过滤规则
    const filteredRules = rulesData?.rules.filter(r => {
        if (filterCategory !== 'all' && (r.category || '未分类') !== filterCategory) return false;
        if (filterSource !== 'all' && r.source !== filterSource) return false;
        return true;
    }) || [];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600">
                加载失败: {error}
                <button onClick={loadRules} className="ml-4 text-blue-600 underline">重试</button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 头部 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">字段规则管理</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        管理政采云商品发布页面的自动填写规则 · 共 {rulesData?.rules.length || 0} 条规则
                    </p>
                </div>
                <button
                    onClick={() => {
                        setIsAddingNew(true);
                        setEditingRule({
                            id: 'new_' + Date.now(),
                            label: '',
                            controlType: 'input',
                            action: 'input',
                            value: '',
                            priority: 50,
                            source: 'manual',
                            category: '未分类',
                            createdAt: new Date().toISOString().split('T')[0],
                            usageCount: 0
                        });
                    }}
                    className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                    + 新增规则
                </button>
            </div>

            {/* 统计卡片 */}
            <div className="grid grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="text-2xl font-bold text-gray-900">{rulesData?.rules.length || 0}</div>
                    <div className="text-sm text-gray-500">总规则数</div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="text-2xl font-bold text-blue-600">
                        {rulesData?.rules.filter(r => r.source === 'manual').length || 0}
                    </div>
                    <div className="text-sm text-gray-500">手动添加</div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="text-2xl font-bold text-green-600">
                        {rulesData?.rules.filter(r => r.source === 'ai').length || 0}
                    </div>
                    <div className="text-sm text-gray-500">AI 收录</div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="text-2xl font-bold text-purple-600">
                        {rulesData?.rules.reduce((sum, r) => sum + (r.usageCount || 0), 0) || 0}
                    </div>
                    <div className="text-sm text-gray-500">总使用次数</div>
                </div>
            </div>

            {/* 过滤器 */}
            <div className="flex gap-4 items-center">
                <div>
                    <label className="text-sm text-gray-600 mr-2">类别:</label>
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                    >
                        <option value="all">全部</option>
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-sm text-gray-600 mr-2">来源:</label>
                    <select
                        value={filterSource}
                        onChange={(e) => setFilterSource(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                    >
                        <option value="all">全部</option>
                        <option value="manual">手动添加</option>
                        <option value="ai">AI 收录</option>
                    </select>
                </div>
                <div className="text-sm text-gray-500">
                    显示 {filteredRules.length} 条规则
                </div>
            </div>

            {/* 规则列表 - 固定高度可滚动 */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col" style={{ height: '800px' }}>
                {/* 固定表头 */}
                <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200">
                    <table className="w-full table-fixed">
                        <thead>
                            <tr>
                                <th className="w-[18%] px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">字段标签</th>
                                <th className="w-[10%] px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">控件类型</th>
                                <th className="w-[10%] px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">填写方式</th>
                                <th className="w-[28%] px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">默认值</th>
                                <th className="w-[10%]"></th>
                                <th className="w-[10%] px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">类别</th>
                                <th className="w-[8%] px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">来源</th>

                                <th className="w-[16%] px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                            </tr>
                        </thead>
                    </table>
                </div>
                {/* 可滚动的表格内容 */}
                <div className="flex-1 overflow-y-auto">
                    <table className="w-full table-fixed">
                        <tbody className="divide-y divide-gray-200">
                            {filteredRules.map((rule) => (
                                <tr key={rule.id} className="hover:bg-gray-50">
                                    <td className="w-[18%] px-3 py-2">
                                        <span className="text-sm text-gray-900">{rule.label}</span>
                                    </td>
                                    <td className="w-[10%] px-3 py-2 text-sm text-gray-600">{rule.controlType}</td>
                                    <td className="w-[10%] px-3 py-2">
                                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${rule.action === 'input' ? 'bg-blue-100 text-blue-700' :
                                            rule.action === 'select' ? 'bg-green-100 text-green-700' :
                                                'bg-gray-100 text-gray-700'
                                            }`}>
                                            {rule.action}
                                        </span>
                                    </td>
                                    <td className="w-[28%] px-3 py-2">
                                        <span className="text-sm text-gray-900" title={rule.value}>
                                            {rule.value ? (rule.value.length > 8 ? rule.value.substring(0, 8) + '...' : rule.value) : '-'}
                                        </span>
                                    </td>
                                    <td className="w-[10%]"></td>
                                    <td className="w-[10%] px-3 py-2 text-sm text-gray-600">{rule.category || '未分类'}</td>
                                    <td className="w-[8%] px-3 py-2">
                                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${rule.source === 'manual' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                            }`}>
                                            {rule.source === 'manual' ? '手动' : 'AI'}
                                        </span>
                                    </td>

                                    <td className="w-[16%] px-3 py-2">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setEditingRule(rule)}
                                                className="text-blue-600 hover:text-blue-800 text-xs"
                                            >
                                                编辑
                                            </button>
                                            <button
                                                onClick={() => deleteRule(rule.id)}
                                                className="text-red-600 hover:text-red-800 text-xs"
                                            >
                                                删除
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>




            {/* 编辑弹窗 */}
            {editingRule && (
                <EditRuleModal
                    rule={editingRule}
                    isNew={isAddingNew}
                    onSave={saveRule}
                    onCancel={() => {
                        setEditingRule(null);
                        setIsAddingNew(false);
                    }}
                />
            )}
        </div>
    );
}

// 编辑规则弹窗组件
function EditRuleModal({
    rule,
    isNew,
    onSave,
    onCancel
}: {
    rule: FieldRule;
    isNew: boolean;
    onSave: (rule: Partial<FieldRule>) => void;
    onCancel: () => void;
}) {
    const [formData, setFormData] = useState<Partial<FieldRule>>(rule);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                    {isNew ? '新增规则' : '编辑规则'}
                </h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">字段标签 *</label>
                        <input
                            type="text"
                            value={formData.label || ''}
                            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            placeholder="如：是否需要安装"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">控件类型</label>
                            <select
                                value={formData.controlType || 'input'}
                                onChange={(e) => setFormData({ ...formData, controlType: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            >
                                <option value="input">input (输入框)</option>
                                <option value="select">select (下拉框)</option>
                                <option value="radio">radio (单选)</option>
                                <option value="textarea">textarea (文本域)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">填写方式</label>
                            <select
                                value={formData.action || 'input'}
                                onChange={(e) => setFormData({ ...formData, action: e.target.value as FieldRule['action'] })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            >
                                <option value="input">input (填写)</option>
                                <option value="select">select (选择)</option>
                                <option value="skip">skip (跳过)</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">默认值</label>
                        <input
                            type="text"
                            value={formData.value || ''}
                            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            placeholder="如：不需要"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">类别</label>
                            <input
                                type="text"
                                value={formData.category || ''}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                placeholder="如：常规属性"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">优先级</label>
                            <input
                                type="number"
                                value={formData.priority || 50}
                                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                min={1}
                                max={100}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                        <input
                            type="text"
                            value={formData.note || ''}
                            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            placeholder="可选备注"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                        取消
                    </button>
                    <button
                        onClick={() => onSave(formData)}
                        className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
                    >
                        保存
                    </button>
                </div>
            </div>
        </div>
    );
}
