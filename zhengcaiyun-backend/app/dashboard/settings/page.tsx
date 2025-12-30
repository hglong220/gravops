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
        <div className="space-y-5">
            <div>
                <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">账户设置</h1>
                <p className="text-[13px] text-gray-500 mt-0.5">管理您的企业信息和账户安全。</p>
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
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-50 rounded-lg">
                            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">企业信息</h2>
                            <p className="text-[11px] text-gray-400 mt-0.5">用于合同、发票及官方展示的基本资料</p>
                        </div>
                    </div>

                    <div className="relative group">
                        {!isEditing ? (
                            <button
                                onClick={startEdit}
                                className="px-4 py-2 rounded-lg bg-gray-900 text-white text-[13px] font-bold hover:bg-black transition-all transform active:scale-95"
                            >
                                编辑资料
                            </button>
                        ) : (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={cancelEdit}
                                    className="px-4 py-2 rounded-lg bg-gray-50 text-gray-600 text-[13px] font-bold hover:bg-gray-100 transition-all"
                                >
                                    取消
                                </button>
                                <button
                                    type="button"
                                    onClick={saveProfile}
                                    className="px-4 py-2 rounded-lg bg-black text-white text-[13px] font-bold hover:shadow-lg transition-all"
                                >
                                    保存
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">公司全称</label>
                        {isEditing ? (
                            <input
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-transparent focus:bg-white focus:border-gray-200 focus:ring-4 focus:ring-gray-50 outline-none transition-all text-[15px] font-bold text-gray-800"
                                placeholder="请输入公司名称"
                            />
                        ) : (
                            <div className="px-5 py-4 rounded-2xl bg-gray-50/60 border border-transparent hover:border-gray-100 transition-all">
                                <p className="text-[15px] font-bold text-gray-800">{profile?.companyName || '未填写'}</p>
                            </div>
                        )}
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">统一社会信用代码</label>
                        {isEditing ? (
                            <input
                                value={creditCode}
                                onChange={(e) => setCreditCode(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-transparent focus:bg-white focus:border-gray-200 focus:ring-4 focus:ring-gray-50 outline-none transition-all text-[15px] font-bold text-gray-800 font-mono"
                                placeholder="请输入统一社会信用代码"
                            />
                        ) : (
                            <div className="px-5 py-4 rounded-2xl bg-gray-50/60 border border-transparent hover:border-gray-100 transition-all">
                                <p className="text-[15px] font-bold text-gray-800 font-mono tracking-tight">{profile?.creditCode || '未填写'}</p>
                            </div>
                        )}
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">法定代表人</label>
                        {isEditing ? (
                            <input
                                value={legalName}
                                onChange={(e) => setLegalName(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-transparent focus:bg-white focus:border-gray-200 focus:ring-4 focus:ring-gray-50 outline-none transition-all text-[15px] font-bold text-gray-800"
                                placeholder="请输入法人姓名"
                            />
                        ) : (
                            <div className="px-5 py-4 rounded-2xl bg-gray-50/60 border border-transparent hover:border-gray-100 transition-all">
                                <p className="text-[15px] font-bold text-gray-800">{profile?.legalName || '未填写'}</p>
                            </div>
                        )}
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">关联手机号码</label>
                        <div className="px-5 py-4 rounded-2xl bg-gray-50/60 border border-transparent flex items-center justify-between">
                            <p className="text-[15px] font-bold text-gray-800 font-mono italic">{profile?.phone || '未绑定'}</p>
                            <span className="text-[10px] bg-gray-200/50 text-gray-400 px-2 py-0.5 rounded-md font-bold">不可更改</span>
                        </div>
                    </div>
                </div>

                {hasActiveLicense && !isEditing && (
                    <div className="mt-8 p-5 bg-blue-50/50 border border-blue-100 rounded-2xl flex gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="text-[12px]">
                            <p className="font-bold text-blue-900 mb-0.5">提示：关于授权校验</p>
                            <p className="text-blue-700 leading-relaxed opacity-80 italic">授权校验以插件从政采云页面自动提取的公司名称为准；这里的企业信息主要用于您的账号展示、资料沉淀及后续支付开票。</p>
                        </div>
                    </div>
                )}
            </div>


            {/* Account Security */}
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900 mb-5">账户安全</h2>

                <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-gray-50">
                        <div>
                            <p className="text-[14px] font-bold text-gray-800">登录密码</p>
                            <p className="text-[12px] text-gray-400 mt-0.5">建议定期更换密码以保护账户安全</p>
                        </div>
                        <button className="px-4 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-[12px] font-bold hover:bg-gray-100 transition-colors border border-gray-100">
                            修改密码
                        </button>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-gray-50">
                        <div>
                            <p className="text-[14px] font-bold text-gray-800">登录账号</p>
                            <p className="text-[12px] text-gray-400 mt-0.5">当前用户名：{profile?.username || '-'}</p>
                        </div>
                        <button className="px-4 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-[12px] font-bold hover:bg-gray-100 transition-colors border border-gray-100">
                            更换用户名
                        </button>
                    </div>

                    <div className="flex items-center justify-between py-3">
                        <div>
                            <p className="text-[14px] font-bold text-gray-800">两步验证 (2FA)</p>
                            <p className="text-[12px] text-gray-400 mt-0.5">在登录时进行二次身份验证</p>
                        </div>
                        <div className="relative inline-block w-10 h-5 align-middle select-none transition duration-200 ease-in">
                            <input type="checkbox" name="toggle" id="toggle" className="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-2 appearance-none cursor-pointer top-0.5 left-0.5 checked:translate-x-4 transition-transform duration-200" />
                            <label htmlFor="toggle" className="toggle-label block overflow-hidden h-5 rounded-full bg-gray-200 cursor-pointer"></label>
                        </div>
                    </div>
                </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-red-50/40 rounded-2xl border border-red-100 p-8">
                <h2 className="text-base font-bold text-red-700 mb-1">危险区域</h2>
                <p className="text-[12px] text-red-600/80 mb-5">注销账户将永久删除您的所有数据和授权信息，此操作不可恢复。</p>
                <button className="px-5 py-2 bg-white border border-red-200 text-red-600 rounded-xl text-[12px] font-bold hover:bg-red-50 transition-colors shadow-sm">
                    注销账户
                </button>
            </div>
        </div>
    );
}
