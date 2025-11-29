'use client';

import { useState } from 'react';
import AuthModal from './components/AuthModal';
import AuthForms from './components/AuthForms';
import TechBackground from './components/TechBackground';

export default function Home() {
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [authView, setAuthView] = useState<'login' | 'register' | 'forgot'>('login');


    const openAuth = (view: 'login' | 'register') => {
        setAuthView(view);
        setIsAuthOpen(true);
    };

    return (
        <main className="relative min-h-screen flex flex-col overflow-x-hidden" style={{ backgroundColor: '#FFFFFF' }}>
            <TechBackground />

            <nav className="relative z-10 px-8 py-4 animate-fade-in">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="text-2xl font-bold text-gray-900">
                        <a href="https://www.gravops.com" className="hover:text-gray-700 transition"></a>
                    </div>
                    <div style={{ position: 'relative', top: '20px', left: '450px' }}>
                        <button
                            onClick={() => openAuth('login')}
                            className="px-5 py-2 bg-black text-white rounded-full hover:bg-gray-800 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 font-medium text-sm"
                        >
                            登录/注册
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section - Compacted */}
            <div className="relative z-10 pt-20 pb-16 flex flex-col items-center justify-center px-4">
                <div className="text-center max-w-5xl mx-auto pt-[100px]">
                    <div className="flex justify-center w-full">
                        <p className="text-7xl md:text-8xl text-gray-700 mb-6 font-light tracking-[0.2em] animate-slide-up delay-100 whitespace-nowrap relative -top-[60px]">基于视觉神经感知的全自动上架引擎</p>
                    </div>
                    <h1 className="text-5xl md:text-6xl font-light mb-10 text-transparent bg-clip-text bg-gradient-to-b from-gray-900 to-gray-600 tracking-[0.2em] leading-none animate-slide-up relative -top-[10px]">体验智跃</h1>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-slide-up delay-200">
                        <button
                            onClick={() => {
                                const token = localStorage.getItem('token');
                                if (token) {
                                    window.location.href = '/dashboard';
                                } else {
                                    openAuth('login');
                                }
                            }}
                            className="px-8 py-3 bg-black text-white rounded-full font-medium text-lg hover:scale-105 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                        >
                            <span className="flex items-center gap-2">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                </svg>
                                下载 Windows 版本
                            </span>
                        </button>

                    </div>
                    <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto animate-slide-up delay-300">
                        <FeatureItem number="10x" label="效率提升" />
                        <FeatureItem number="99%" label="识别准确率" />
                        <FeatureItem number="AI" label="智能决策" />
                        <FeatureItem number="24/7" label="全天候" />
                    </div>
                </div>
            </div>

            {/* Core Tech Section - Compacted */}
            <div className="relative z-10 py-12 -mt-[10px]">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-10">
                        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">核心技术引擎</h2>
                        <p className="text-gray-500 max-w-2xl mx-auto text-sm">基于新一代深度学习架构，重构政采云自动化流程</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <TechCard
                            icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
                            title="视觉神经感知"
                            desc="搭载自主研发的 DeepVision 视觉引擎，能够毫秒级精准识别商品图片中的品牌、型号及违规元素。通过像素级语义分割技术，像人类专家一样'看懂'每一张商品图，确保信息提取准确率高达 99.9%。"
                        />
                        <TechCard
                            icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>}
                            title="智能决策中枢"
                            desc="内置千万级政采行业知识图谱，实时关联最新法规与类目规则。BrainCore 决策中枢能自动研判商品合规性，智能生成最优上架策略，自动规避价格、参数等潜在风险，让每一次上架都安全无忧。"
                        />
                        <TechCard
                            icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                            title="自动化执行臂"
                            desc="基于 RPA (Robotic Process Automation) 技术构建的虚拟执行臂，完美模拟人类操作行为。全自动完成跨平台数据填单、图片上传、参数勾选及点击提交，支持 7x24 小时无人值守运行，效率提升百倍以上。"
                        />
                    </div>
                </div>
            </div>



            <div className="relative z-10 py-6 text-center animate-fade-in delay-300 bg-gray-50 mt-auto w-full">
                <p className="text-xs text-gray-400">© 2025 www.gravops.com · 让技术驱动效率</p>
            </div>

            {/* Auth Modal */}
            <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)}>
                <AuthForms initialView={authView} onViewChange={setAuthView} />
            </AuthModal>
        </main >
    );
}

function FeatureItem({ number, label }: { number: string; label: string }) {
    return (
        <div className="text-center p-6 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-default">
            <div className="text-3xl font-bold text-gray-900 mb-1">{number}</div>
            <div className="text-sm text-gray-600">{label}</div>
        </div>
    );
}

function TechCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
    return (
        <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl border border-gray-100 text-center hover:shadow-xl hover:border-gray-200 transition-all duration-300 hover:-translate-y-1">
            <div className="w-16 h-16 mx-auto bg-gray-50 rounded-2xl flex items-center justify-center text-gray-900 mb-6 group-hover:bg-black group-hover:text-white transition-colors duration-300">
                {icon}
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">{title}</h3>
            <p className="text-gray-500 leading-relaxed text-sm">
                {desc}
            </p>
        </div>
    );
}
