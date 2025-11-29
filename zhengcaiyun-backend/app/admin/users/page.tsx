'use client';

import { useState, useEffect } from 'react';

export default function UsersPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<any>({});
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchUsers();
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        if (selectedUser) {
            setEditForm({
                email: selectedUser.email || '',
                companyName: selectedUser.companyName || '',
                creditCode: selectedUser.creditCode || '',
                name: selectedUser.name || '',
                phone: selectedUser.phone || ''
            });
            setIsEditing(false);
        }
    }, [selectedUser]);

    const fetchUsers = () => {
        setLoading(true);
        fetch(`/api/admin/users?search=${encodeURIComponent(searchTerm)}`)
            .then(res => res.json())
            .then(data => {
                setUsers(data);
                setLoading(false);
            });
    };

    async function toggleBan(userId: string, currentStatus: boolean) {
        if (!confirm(`确定要${currentStatus ? '解封' : '封禁'}该用户吗？`)) return;

        const res = await fetch('/api/admin/users', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, action: currentStatus ? 'unban' : 'ban' })
        });

        if (res.ok) {
            setUsers(users.map(u => u.id === userId ? { ...u, isBanned: !currentStatus } : u));
            if (selectedUser && selectedUser.id === userId) {
                setSelectedUser({ ...selectedUser, isBanned: !currentStatus });
            }
        }
    }

    async function handleSaveProfile() {
        const res = await fetch('/api/admin/users', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: selectedUser.id,
                action: 'update',
                data: editForm
            })
        });

        if (res.ok) {
            const updatedUser = await res.json();
            setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u));
            setSelectedUser(updatedUser);
            setIsEditing(false);
            alert('用户信息更新成功');
        } else {
            alert('更新失败');
        }
    }

    if (loading && !users.length) return <div className="p-8 text-gray-500">Loading users...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">用户管理</h1>
                    <p className="text-sm text-gray-500 mt-1">管理注册用户及其账号状态。</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="搜索公司、邮箱或姓名..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-64 pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
                        />
                        <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <div className="text-sm text-gray-500">
                        共 {users.length} 位用户
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">公司信息</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">用户邮箱</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">账号状态</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">License / 订单</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">操作</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {users.map((user) => (
                            <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className={`text-sm font-bold ${user.companyName ? 'text-gray-900' : 'text-gray-400 italic'}`}>
                                        {user.companyName || '未设置公司名称'}
                                    </div>
                                    <div className="text-xs text-gray-500">{user.name ? `联系人: ${user.name}` : '未设置联系人'}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{user.email}</div>
                                    <div className="text-xs text-gray-500">{new Date(user.createdAt).toLocaleDateString()} 注册</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${user.isBanned
                                        ? 'bg-red-50 text-red-700 border border-red-100'
                                        : 'bg-green-50 text-green-700 border border-green-100'
                                        }`}>
                                        {user.isBanned ? '已封禁' : '正常'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <div className="flex gap-4">
                                        <span title="Licenses">🔑 {user.licenses?.length || 0}</span>
                                        <span title="Orders">📦 {user._count?.orders || 0}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                    <button
                                        onClick={() => setSelectedUser(user)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                                    >
                                        查看详情
                                    </button>
                                    <button
                                        onClick={() => toggleBan(user.id, user.isBanned)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${user.isBanned
                                            ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                            : 'bg-red-50 text-red-700 hover:bg-red-100'
                                            }`}
                                    >
                                        {user.isBanned ? '解封' : '封禁'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* User Details Modal */}
            {selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="text-lg font-bold text-gray-900">用户档案</h3>
                            <div className="flex items-center gap-2">
                                {!isEditing && (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="text-sm text-blue-600 hover:text-blue-700 font-medium px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                                    >
                                        编辑资料
                                    </button>
                                )}
                                <button
                                    onClick={() => setSelectedUser(null)}
                                    className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Basic Info */}
                            <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">基本信息</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-50 p-3 rounded-xl">
                                        <p className="text-xs text-gray-500 mb-1">用户邮箱</p>
                                        {isEditing ? (
                                            <input
                                                type="email"
                                                value={editForm.email}
                                                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                                className="w-full text-sm font-medium text-gray-900 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-500 bg-white"
                                            />
                                        ) : (
                                            <p className="text-sm font-medium text-gray-900 break-all">{selectedUser.email}</p>
                                        )}
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-xl">
                                        <p className="text-xs text-gray-500 mb-1">注册时间</p>
                                        <p className="text-sm font-medium text-gray-900">{new Date(selectedUser.createdAt).toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Contact & Company */}
                            <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">企业与联系人</h4>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center py-2 border-b border-gray-50">
                                        <span className="text-sm text-gray-500 w-24">公司名称</span>
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={editForm.companyName}
                                                onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
                                                className="flex-1 text-sm font-medium text-gray-900 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
                                            />
                                        ) : (
                                            <span className="text-sm font-medium text-gray-900 flex-1 text-right">{selectedUser.companyName || '-'}</span>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-gray-50">
                                        <span className="text-sm text-gray-500 w-24">统一社会信用代码</span>
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={editForm.creditCode}
                                                onChange={(e) => setEditForm({ ...editForm, creditCode: e.target.value })}
                                                className="flex-1 text-sm font-medium text-gray-900 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-500 font-mono"
                                            />
                                        ) : (
                                            <span className="text-sm font-medium text-gray-900 font-mono flex-1 text-right">{selectedUser.creditCode || '-'}</span>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-gray-50">
                                        <span className="text-sm text-gray-500 w-24">法人/联系人</span>
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={editForm.name}
                                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                                className="flex-1 text-sm font-medium text-gray-900 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
                                            />
                                        ) : (
                                            <span className="text-sm font-medium text-gray-900 flex-1 text-right">{selectedUser.name || '-'}</span>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-gray-50">
                                        <span className="text-sm text-gray-500 w-24">联系电话</span>
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={editForm.phone}
                                                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                                className="flex-1 text-sm font-medium text-gray-900 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
                                            />
                                        ) : (
                                            <span className="text-sm font-medium text-gray-900 flex-1 text-right">{selectedUser.phone || '-'}</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* System Info */}
                            <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">系统数据</h4>
                                <div className="bg-gray-900 text-white p-4 rounded-xl font-mono text-xs space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">User ID:</span>
                                        <span>{selectedUser.id}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Status:</span>
                                        <span className={selectedUser.isBanned ? 'text-red-400' : 'text-green-400'}>
                                            {selectedUser.isBanned ? 'BANNED' : 'ACTIVE'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Last Updated:</span>
                                        <span>{new Date(selectedUser.updatedAt).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                            {isEditing ? (
                                <>
                                    <button
                                        onClick={() => setIsEditing(false)}
                                        className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        取消
                                    </button>
                                    <button
                                        onClick={handleSaveProfile}
                                        className="px-4 py-2 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
                                    >
                                        保存更改
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => setSelectedUser(null)}
                                    className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    关闭
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
