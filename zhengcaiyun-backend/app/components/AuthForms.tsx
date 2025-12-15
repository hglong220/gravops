'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isValidChinaPhone, normalizeChinaPhone } from '@/lib/phone';

type AuthView = 'login' | 'register' | 'forgot';

interface AuthFormsProps {
    initialView?: AuthView;
    onViewChange: (view: AuthView) => void;
}

export default function AuthForms({ initialView = 'login', onViewChange }: AuthFormsProps) {
    const [view, setView] = useState<AuthView>(initialView);

    const switchView = (newView: AuthView) => {
        setView(newView);
        onViewChange(newView);
    };

    return (
        <div className="w-full">
            {view === 'login' && <LoginForm onSwitch={switchView} />}
            {view === 'register' && <RegisterForm onSwitch={switchView} />}
            {view === 'forgot' && <ForgotForm onSwitch={switchView} />}
        </div>
    );
}

function LoginForm({ onSwitch }: { onSwitch: (view: AuthView) => void }) {
    const router = useRouter();

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const formData = new FormData(e.target as HTMLFormElement);
        const identifier = formData.get('identifier');
        const password = formData.get('password');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier, password })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || '登录失败');
            }

            // Store token and user info
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            // Redirect
            router.push('/dashboard');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-fade-in">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900">欢迎回来</h2>
                <p className="text-gray-500 text-sm mt-2">登录您的 Gravops 账号</p>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {error}
                </div>
            )}

            <form className="space-y-4" onSubmit={handleLogin}>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">用户名/手机号</label>
                    <input
                        name="identifier"
                        type="text"
                        required
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                        placeholder="请输入用户名或手机号"
                    />
                </div>
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-medium text-gray-700">密码</label>
                        <button
                            type="button"
                            onClick={() => onSwitch('forgot')}
                            className="text-xs text-gray-500 hover:text-black transition-colors"
                        >
                            忘记密码?
                        </button>
                    </div>
                    <input
                        name="password"
                        type="password"
                        required
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                        placeholder="••••••••"
                    />
                </div>

                <button className="w-full py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
                    登录
                </button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-500">
                还没有账号?{' '}
                <button
                    onClick={() => onSwitch('register')}
                    className="text-black font-medium hover:underline"
                >
                    立即注册
                </button>
            </div>
        </div>
    );
}

function RegisterForm({ onSwitch }: { onSwitch: (view: AuthView) => void }) {
    const router = useRouter();

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [sendingCode, setSendingCode] = useState(false);
    const [countdown, setCountdown] = useState(0);

    const [username, setUsername] = useState('');
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setInterval(() => {
            setCountdown((s) => (s > 0 ? s - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [countdown]);

    const handleSendCode = async () => {
        setError('');
        setSuccess('');

        const phoneTrim = phone.trim();
        const normalizedPhone = normalizeChinaPhone(phoneTrim);
        if (!isValidChinaPhone(normalizedPhone)) {
            setError('手机号格式不正确');
            return;
        }
        if (sendingCode || countdown > 0) return;

        try {
            setSendingCode(true);
            const res = await fetch('/api/auth/send-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: normalizedPhone })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '发送失败');

            setSuccess('验证码已发送');
            setCountdown(60);

            if (data.debugCode) {
                console.log('[Auth] debugCode:', data.debugCode);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSendingCode(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        const payload = {
            username: username.trim(),
            phone: normalizeChinaPhone(phone.trim()),
            code: code.trim(),
            password,
            confirmPassword
        };

        if (!payload.username || !payload.phone || !payload.code || !payload.password || !payload.confirmPassword) {
            setError('请完整填写注册信息');
            setLoading(false);
            return;
        }
        if (payload.password !== payload.confirmPassword) {
            setError('两次密码不一致');
            setLoading(false);
            return;
        }

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || '注册失败');
            }

            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            router.push('/dashboard');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-fade-in">
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">用户注册</h2>
                <p className="text-gray-500 text-sm mt-2">创建您的 Gravops 账号</p>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                </div>
            )}

            {success && (
                <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-lg border border-green-100">
                    {success}
                </div>
            )}

            <form className="space-y-4" onSubmit={handleRegister}>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
                    <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        type="text"
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                        placeholder="请输入用户名"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">手机号</label>
                    <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        type="tel"
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                        placeholder="请输入手机号"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">验证码</label>
                    <div className="flex gap-3">
                        <input
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            type="text"
                            className="flex-1 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                            placeholder="6位数字"
                        />
                        <button
                            type="button"
                            onClick={handleSendCode}
                            disabled={sendingCode || countdown > 0}
                            className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {countdown > 0 ? `${countdown}s` : sendingCode ? '发送中...' : '获取验证码'}
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">设置密码</label>
                    <input
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        type="password"
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                        placeholder="至少 8 位字符"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">确认密码</label>
                    <input
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        type="password"
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                        placeholder="请再次输入密码"
                    />
                </div>

                <button
                    disabled={loading}
                    className="w-full py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? '注册中...' : '立即注册'}
                </button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-500">
                已有账号?{' '}
                <button onClick={() => onSwitch('login')} className="text-black font-medium hover:underline">
                    直接登录
                </button>
            </div>
        </div>
    );
}

function ForgotForm({ onSwitch }: { onSwitch: (view: AuthView) => void }) {
    return (
        <div className="animate-fade-in">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900">重置密码</h2>
                <p className="text-gray-500 text-sm mt-2">我们将向您发送重置链接</p>
            </div>

            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
                    <input
                        type="email"
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                        placeholder="name@example.com"
                    />
                </div>

                <button className="w-full py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
                    发送重置链接
                </button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-500">
                <button
                    onClick={() => onSwitch('login')}
                    className="text-black font-medium hover:underline"
                >
                    返回登录
                </button>
            </div>
        </div>
    );
}
