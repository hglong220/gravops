'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Profile = {
    id: string;
    username: string;
    phone: string | null;
    companyName: string | null;
    creditCode: string | null;
    legalName: string | null;
};

type LicenseInfo = {
    id: string;
    key: string;
    companyName: string;
    plan: string;
    status: string;
    expiresAt: number;
    maxDevices: number;
    currentDevices: number;
};

export default function SettingsPage() {
    const router = useRouter();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [licenses, setLicenses] = useState<LicenseInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    const [companyName, setCompanyName] = useState('');
    const [creditCode, setCreditCode] = useState('');
    const [legalName, setLegalName] = useState('');

    const authedFetch = useCallback(
        async (path: string, init: RequestInit = {}) => {
            const token = localStorage.getItem('token');
            if (!token) {
                router.push('/login');
                throw new Error('Unauthorized');
            }

            const headers = new Headers(init.headers);
            headers.set('Authorization', `Bearer ${token}`);
            if (init.body && !headers.has('Content-Type')) {
                headers.set('Content-Type', 'application/json');
            }

            const res = await fetch(path, { ...init, headers });

            if (res.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                router.push('/login');
                throw new Error('Unauthorized');
            }

            return res;
        },
        [router]
    );

    const hasActiveLicense = useMemo(() => {
        const now = Date.now();
        return licenses.some((l) => l.status === 'active' && l.expiresAt > now);
    }, [licenses]);

    useEffect(() => {
        let mounted = true;

        (async () => {
            try {
                setError(null);
                setSaved(null);

                const [profileRes, licensesRes] = await Promise.all([
                    authedFetch('/api/user/profile'),
                    authedFetch('/api/licenses/my')
                ]);

                const p = (await profileRes.json()) as Profile;
                const l = (await licensesRes.json()) as { licenses: LicenseInfo[] };

                if (!mounted) return;

                setProfile(p);
                setLicenses(Array.isArray(l?.licenses) ? l.licenses : []);

                setCompanyName(p.companyName || '');
                setCreditCode(p.creditCode || '');
                setLegalName(p.legalName || '');
            } catch (e: any) {
                if (!mounted) return;
                setError(e?.message || '加载失败');
            } finally {
                if (mounted) setLoading(false);
            }
        })();

        return () => {
            mounted = false;
        };
    }, [authedFetch]);

    const startEdit = () => {
        if (!profile) return;
        setSaved(null);
        setError(null);
        setCompanyName(profile.companyName || '');
        setCreditCode(profile.creditCode || '');
        setLegalName(profile.legalName || '');
        setIsEditing(true);
    };

    const cancelEdit = () => {
        if (!profile) return;
        setSaved(null);
        setError(null);
        setCompanyName(profile.companyName || '');
        setCreditCode(profile.creditCode || '');
        setLegalName(profile.legalName || '');
        setIsEditing(false);
    };

    const saveProfile = async () => {
        try {
            setError(null);
            setSaved(null);

            const res = await authedFetch('/api/user/profile', {
                method: 'PATCH',
                body: JSON.stringify({ companyName, creditCode, legalName })
            });

            const updated = (await res.json()) as Profile;
            setProfile(updated);
            setIsEditing(false);
            setSaved('保存成功');
        } catch (e: any) {
            setError(e?.message || '保存失败');
        }
    };

    if (loading) return <div className="p-8 text-gray-500">Loading...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">账户设置</h1>
                <p className="text-sm text-gray-500 mt-1">管理您的企业信息和账户安全。</p>
            </div>

            {error && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
                    {error}
                </div>
            )}
            {saved && (
                <div className="p-3 bg-green-50 text-green-700 text-sm rounded-lg border border-green-100">
                    {saved}
                </div>
            )}

            {/* Company Info */}
            <div className="bg-white rounded-2xl border border-gray-200 p-8">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-gray-900">企业信息</h2>

                    <div className="relative group">
                        {!isEditing ? (
                            <button
                                onClick={startEdit}
                                className="text-sm font-medium text-black hover:underline cursor-pointer transition-colors"
                            >
                                编辑信息
                            </button>
                        ) : (
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={cancelEdit}
                                    className="text-sm font-medium text-gray-500 hover:text-black hover:underline"
                                >
                                    取消
                                </button>
                                <button
                                    type="button"
                                    onClick={saveProfile}
                                    className="text-sm font-medium text-black hover:underline"
                                >
                                    保存
                                </button>
                            </div>
                        )}

                        {hasActiveLicense && !isEditing && (
                            <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                                <p>提示：授权校验以插件从政采云页面自动提取的公司名称为准；这里的企业信息用于你的账号资料展示与后续支付开票。</p>
                                <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-900 rotate-45"></div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">公司名称</label>
                        {isEditing ? (
                            <input
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                                placeholder="请输入公司名称"
                            />
                        ) : (
                            <p className="text-gray-900 font-medium">{profile?.companyName || '未填写'}</p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">统一社会信用代码</label>
                        {isEditing ? (
                            <input
                                value={creditCode}
                                onChange={(e) => setCreditCode(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all font-mono"
                                placeholder="请输入统一社会信用代码"
                            />
                        ) : (
                            <p className="text-gray-900 font-medium font-mono">{profile?.creditCode || '未填写'}</p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">法人姓名</label>
                        {isEditing ? (
                            <input
                                value={legalName}
                                onChange={(e) => setLegalName(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                                placeholder="请输入法人姓名"
                            />
                        ) : (
                            <p className="text-gray-900 font-medium">{profile?.legalName || '未填写'}</p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">手机号</label>
                        <p className="text-gray-900 font-medium font-mono">{profile?.phone || '未绑定'}</p>
                    </div>
                </div>
            </div>

            {/* Account Security */}
            <div className="bg-white rounded-2xl border border-gray-200 p-8">
                <h2 className="text-lg font-bold text-gray-900 mb-6">账户安全</h2>

                <div className="space-y-6">
                    <div className="flex items-center justify-between py-4 border-b border-gray-100">
                        <div>
                            <p className="font-medium text-gray-900">登录密码</p>
                            <p className="text-sm text-gray-500 mt-0.5">建议定期更换密码以保护账户安全</p>
                        </div>
                        <button className="px-4 py-2 bg-gray-50 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors">
                            修改密码
                        </button>
                    </div>

                    <div className="flex items-center justify-between py-4 border-b border-gray-100">
                        <div>
                            <p className="font-medium text-gray-900">登录账号</p>
                            <p className="text-sm text-gray-500 mt-0.5">当前用户名：{profile?.username || '-'}</p>
                        </div>
                        <button className="px-4 py-2 bg-gray-50 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors">
                            更换用户名
                        </button>
                    </div>

                    <div className="flex items-center justify-between py-4">
                        <div>
                            <p className="font-medium text-gray-900">两步验证 (2FA)</p>
                            <p className="text-sm text-gray-500 mt-0.5">在登录时进行二次身份验证</p>
                        </div>
                        <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                            <input type="checkbox" name="toggle" id="toggle" className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer" />
                            <label htmlFor="toggle" className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label>
                        </div>
                    </div>
                </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-red-50 rounded-2xl border border-red-100 p-8">
                <h2 className="text-lg font-bold text-red-700 mb-2">危险区域</h2>
                <p className="text-sm text-red-600 mb-6">注销账户将永久删除您的所有数据和授权信息，此操作不可恢复。</p>
                <button className="px-6 py-2 bg-white border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors">
                    注销账户
                </button>
            </div>
        </div>
    );
}
