'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
        const email = formData.get('email');
        const password = formData.get('password');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
                    <input
                        name="email"
                        type="email"
                        required
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                        placeholder="name@example.com"
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
    return (
        <div className="animate-fade-in">
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">企业注册</h2>
                <p className="text-gray-500 text-sm mt-2">请填写企业认证信息</p>
            </div>

            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">公司名称</label>
                    <input
                        type="text"
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                        placeholder="请输入完整公司名称"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">统一社会信用代码</label>
                    <input
                        type="text"
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                        placeholder="18位信用代码"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">法人姓名</label>
                    <input
                        type="text"
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                        placeholder="请输入法人真实姓名"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">电子邮箱</label>
                    <input
                        type="email"
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                        placeholder="name@company.com"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">邮箱验证码</label>
                    <div className="flex gap-3">
                        <input
                            type="text"
                            className="flex-1 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                            placeholder="6位数字"
                        />
                        <button
                            type="button"
                            className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors whitespace-nowrap"
                        >
                            获取验证码
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">手机号码</label>
                    <input
                        type="tel"
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                        placeholder="用于接收通知"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">手机验证码</label>
                    <div className="flex gap-3">
                        <input
                            type="text"
                            className="flex-1 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                            placeholder="6位数字"
                        />
                        <button
                            type="button"
                            className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors whitespace-nowrap"
                        >
                            获取验证码
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">设置密码</label>
                    <input
                        type="password"
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                        placeholder="至少 8 位字符"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">确认密码</label>
                    <input
                        type="password"
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                        placeholder="请再次输入密码"
                    />
                </div>

                <button className="w-full py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 mt-2">
                    立即注册
                </button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-500">
                已有账号?{' '}
                <button
                    onClick={() => onSwitch('login')}
                    className="text-black font-medium hover:underline"
                >
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
