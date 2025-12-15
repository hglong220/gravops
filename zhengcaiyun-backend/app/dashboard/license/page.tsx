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

function formatDate(epochMs: number): string {
    const d = new Date(epochMs);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function planLabel(plan: string): string {
    const p = String(plan || '').toLowerCase();
    if (p.includes('pro')) return '专业版 (Professional)';
    if (p.includes('year')) return '年度套餐';
    if (p.includes('month')) return '月度套餐';
    return plan || '授权';
}

export default function LicensePage() {
    const router = useRouter();

    const [profile, setProfile] = useState<Profile | null>(null);
    const [licenses, setLicenses] = useState<LicenseInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);

    const [inputKey, setInputKey] = useState('');
    const [claiming, setClaiming] = useState(false);
    const [resettingDevices, setResettingDevices] = useState(false);

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

    const currentLicense = useMemo(() => {
        if (!licenses.length) return null;
        return licenses[0];
    }, [licenses]);

    const refresh = useCallback(async () => {
        const [profileRes, licensesRes] = await Promise.all([
            authedFetch('/api/user/profile'),
            authedFetch('/api/licenses/my')
        ]);

        const p = (await profileRes.json()) as Profile;
        const l = (await licensesRes.json()) as { licenses: LicenseInfo[] };

        setProfile(p);
        setLicenses(Array.isArray(l?.licenses) ? l.licenses : []);
    }, [authedFetch]);

    useEffect(() => {
        let mounted = true;

        (async () => {
            try {
                setError(null);
                setInfo(null);
                await refresh();
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
    }, [refresh]);

    const handleCopy = async () => {
        if (!currentLicense?.key) return;
        try {
            await navigator.clipboard.writeText(currentLicense.key);
            setInfo('已复制');
        } catch {
            setError('复制失败，请手动复制');
        }
    };

    const handleClaim = async () => {
        const licenseKey = inputKey.trim();
        if (!licenseKey) {
            setError('请输入授权码');
            return;
        }

        setClaiming(true);
        setError(null);
        setInfo(null);

        try {
            const res = await authedFetch('/api/licenses/claim', {
                method: 'POST',
                body: JSON.stringify({ licenseKey })
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || '绑定失败');
            }

            setInfo('绑定成功');
            setInputKey('');
            await refresh();
        } catch (e: any) {
            setError(e?.message || '绑定失败');
        } finally {
            setClaiming(false);
        }
    };

    const handleResetDevices = async () => {
        if (!currentLicense?.id) return;

        const ok = confirm(
            `Are you sure you want to reset device bindings for this license?\n\nDevices: ${currentLicense.currentDevices}/${currentLicense.maxDevices}\n\nYou will need to re-activate the extension afterwards.`
        );
        if (!ok) return;

        setResettingDevices(true);
        setError(null);
        setInfo(null);

        try {
            const res = await authedFetch('/api/licenses/reset-devices', {
                method: 'POST',
                body: JSON.stringify({ licenseId: currentLicense.id })
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || 'Reset failed');
            }

            setInfo('Device bindings reset. Please re-activate in the extension.');
            await refresh();
        } catch (e: any) {
            setError(e?.message || 'Reset failed');
        } finally {
            setResettingDevices(false);
        }
    };

    if (loading) return <div className="p-8 text-gray-500">Loading...</div>;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">授权管理</h1>
                <p className="text-sm text-gray-500 mt-1">查看您的 License Key 并管理订阅套餐。</p>
            </div>

            {error && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
                    {error}
                </div>
            )}
            {info && (
                <div className="p-3 bg-green-50 text-green-700 text-sm rounded-lg border border-green-100">
                    {info}
                </div>
            )}

            {/* My License Section */}
            <div className="bg-stone-400 text-gray-900 rounded-2xl p-8 relative overflow-hidden border border-stone-500">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-900 rounded-full mix-blend-overlay filter blur-3xl opacity-20 -translate-y-1/2 translate-x-1/2"></div>

                <div className="relative z-10">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
                        <div>
                            <span className="inline-block px-3 py-1 rounded-full bg-black text-white text-xs font-bold mb-3">
                                {currentLicense ? planLabel(currentLicense.plan) : '未绑定授权'}
                            </span>
                            <h2 className="text-xl font-bold">
                                {currentLicense?.companyName || profile?.companyName || '未填写公司名称'}
                            </h2>
                            <p className="text-gray-500 text-sm mt-1">
                                统一社会信用代码: {profile?.creditCode || '-'}
                            </p>
                        </div>
                        <div className="mt-4 md:mt-0 text-right">
                            <p className="text-xs text-gray-500 mb-1">状态</p>
                            {currentLicense ? (
                                <div className="flex items-center gap-2 justify-end">
                                    <span
                                        className={`w-2 h-2 rounded-full ${currentLicense.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`}
                                    ></span>
                                    <span
                                        className={`font-bold ${currentLicense.status === 'active' ? 'text-green-400' : 'text-gray-600'}`}
                                    >
                                        {currentLicense.status === 'active' ? '授权生效中' : currentLicense.status}
                                    </span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 justify-end">
                                    <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                                    <span className="font-bold text-gray-600">未绑定</span>
                                </div>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                                {currentLicense ? `有效期至 ${formatDate(currentLicense.expiresAt)}` : '绑定后可用'}
                            </p>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                        <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">
                            {currentLicense ? '您的 License Key (用于插件激活)' : '绑定授权码 (用于插件激活与数据归属)'}
                        </p>

                        {currentLicense ? (
                            <>
                            <div className="flex items-center gap-4">
                                <code className="flex-1 font-mono text-xl md:text-2xl font-bold tracking-wide text-black">
                                    {currentLicense.key}
                                </code>
                                <button
                                    onClick={handleCopy}
                                    className="px-4 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800 transition-colors flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                    </svg>
                                    复制
                                </button>
                            </div>
                            <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                                <span>
                                    设备数：{currentLicense.currentDevices}/{currentLicense.maxDevices}
                                </span>
                                <button
                                    onClick={handleResetDevices}
                                    disabled={resettingDevices}
                                    className="px-3 py-1 rounded-md border border-gray-200 hover:bg-gray-50 text-black font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {resettingDevices ? '重置中...' : '重置设备'}
                                </button>
                            </div>
                            </>
                        ) : (
                            <div className="flex flex-col md:flex-row gap-3">
                                <input
                                    value={inputKey}
                                    onChange={(e) => setInputKey(e.target.value)}
                                    className="flex-1 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all font-mono"
                                    placeholder="粘贴授权码，例如：ZCAI-XXXX-XXXX-XXXX-XXXX"
                                />
                                <button
                                    disabled={claiming}
                                    onClick={handleClaim}
                                    className="px-6 py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {claiming ? '绑定中...' : '绑定授权码'}
                                </button>
                            </div>
                        )}
                    </div>

                    {currentLicense && (
                        <div className="mt-6 flex items-start gap-3 p-4 rounded-lg bg-gray-50 border border-gray-200 text-gray-700 text-xs">
                            <svg className="w-5 h-5 flex-shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            <div>
                                <p className="font-bold mb-1">提示</p>
                                <p className="opacity-80">
                                    插件激活时会从政采云页面自动提取公司名称用于授权校验。请确保登录的政采云主体与授权绑定公司一致。
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Pricing Plans */}
            <div>
                <h3 className="text-xl font-bold text-gray-900 mb-6">订阅套餐</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Basic Plan */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-300 flex flex-col">
                        <div className="mb-4">
                            <h4 className="text-lg font-bold text-gray-900">基础版</h4>
                            <p className="text-sm text-gray-500">适合个人或小型团队试用</p>
                        </div>
                        <div className="mb-6">
                            <span className="text-3xl font-bold text-gray-900">¥399</span>
                            <span className="text-gray-500">/月</span>
                        </div>
                        <ul className="space-y-3 mb-8 flex-1">
                            <li className="flex items-center gap-2 text-sm text-gray-600">
                                <CheckIcon /> 智能商品上架 (单品)
                            </li>
                            <li className="flex items-center gap-2 text-sm text-gray-600">
                                <CheckIcon /> 基础 AI 类目识别
                            </li>
                            <li className="flex items-center gap-2 text-sm text-gray-600">
                                <CheckIcon /> 每月 1,000 次上传配额
                            </li>
                            <li className="flex items-center gap-2 text-sm text-gray-600">
                                <CheckIcon /> 京东/天猫图片自动匹配
                            </li>
                            <li className="flex items-center gap-2 text-sm text-gray-600">
                                <CheckIcon /> 基础数据统计看板
                            </li>
                            <li className="flex items-center gap-2 text-sm text-gray-600">
                                <CheckIcon /> Chrome 浏览器插件支持
                            </li>
                            <li className="flex items-center gap-2 text-sm text-gray-400 line-through">
                                批量清单导入
                            </li>
                        </ul>
                        <button className="w-full py-3 rounded-xl border border-gray-200 font-bold text-gray-900 hover:bg-gray-50 transition-colors">
                            订阅
                        </button>
                    </div>

                    {/* Professional Plan */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-300 flex flex-col relative overflow-hidden">
                        <div className="absolute top-0 right-0 bg-gradient-to-l from-blue-600 to-purple-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">
                            RECOMMENDED
                        </div>
                        <div className="mb-4">
                            <h4 className="text-lg font-bold text-gray-900">专业版</h4>
                            <p className="text-sm text-gray-500">全功能解锁，极致效率</p>
                        </div>
                        <div className="mb-6">
                            <span className="text-3xl font-bold text-gray-900">¥3000</span>
                            <span className="text-gray-500">/年</span>
                        </div>
                        <ul className="space-y-3 mb-8 flex-1">
                            <li className="flex items-center gap-2 text-sm text-gray-600">
                                <CheckIcon /> 全自动批量上架 (Excel/Word)
                            </li>
                            <li className="flex items-center gap-2 text-sm text-gray-600">
                                <CheckIcon /> 顶级 AI 引擎 (GPT-4o)
                            </li>
                            <li className="flex items-center gap-2 text-sm text-gray-600">
                                <CheckIcon /> 无限上传配额
                            </li>
                            <li className="flex items-center gap-2 text-sm text-gray-600">
                                <CheckIcon /> 全网以图搜图 & 智能去水印
                            </li>
                            <li className="flex items-center gap-2 text-sm text-gray-600">
                                <CheckIcon /> 验证码自动识别 (0人工干预)
                            </li>
                            <li className="flex items-center gap-2 text-sm text-gray-600">
                                <CheckIcon /> 智能定价与库存管理
                            </li>
                            <li className="flex items-center gap-2 text-sm text-gray-600">
                                <CheckIcon /> 专属客户经理 & 优先支持
                            </li>
                        </ul>
                        <button className="w-full py-3 rounded-xl border border-gray-200 font-bold text-gray-900 hover:bg-gray-50 transition-colors">
                            订阅
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function CheckIcon({ color = "text-green-500" }: { color?: string }) {
    return (
        <svg className={`w-5 h-5 ${color} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
    );
}
