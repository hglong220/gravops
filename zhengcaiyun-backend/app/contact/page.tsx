import Link from 'next/link';

export default function ContactPage() {
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200">
                <div className="max-w-4xl mx-auto px-6 py-4">
                    <Link href="/" className="text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        返回首页
                    </Link>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-4xl mx-auto px-6 py-12">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 pb-4 md:p-12 md:pb-6">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">联系我们</h1>
                    <p className="text-sm text-gray-600 mb-8">
                        感谢您对智跃产品的关注与支持。如有任何问题、建议或合作意向，欢迎通过以下方式与我们取得联系。
                    </p>

                    <div className="grid md:grid-cols-2 gap-8 mb-12">
                        {/* 公司信息 */}
                        <div className="bg-gray-100 rounded-2xl p-8">
                            <div className="w-14 h-14 bg-gray-200 rounded-xl flex items-center justify-center mb-6">
                                <svg className="w-7 h-7 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </div>
                            <h2 className="text-base font-bold text-gray-900 mb-3">公司信息</h2>
                            <div className="space-y-2 text-sm text-gray-700">
                                <p className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    <span><strong>公司名称：</strong>青海立乐科技有限公司</span>
                                </p>
                                <p className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span><strong>办公地址：</strong>青海省西宁市城西区西川南路76号1号楼11710室</span>
                                </p>
                            </div>
                        </div>

                        {/* 联系方式 */}
                        <div className="bg-gray-100 rounded-2xl p-8">
                            <div className="w-14 h-14 bg-gray-200 rounded-xl flex items-center justify-center mb-6">
                                <svg className="w-7 h-7 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h2 className="text-base font-bold text-gray-900 mb-3">联系方式</h2>
                            <div className="space-y-2 text-sm text-gray-700">
                                <p className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    <span><strong>商务合作：</strong>business@liletech.cn</span>
                                </p>
                                <p className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                    <span><strong>技术支持：</strong>support@liletech.cn</span>
                                </p>
                                <p className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                    <span><strong>隐私问题：</strong>privacy@liletech.cn</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 服务时间 */}
                    <div className="bg-gray-50 rounded-2xl p-8 mb-12">
                        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            服务时间
                        </h2>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="bg-white rounded-xl p-5 border border-gray-100">
                                <p className="text-sm text-gray-500 mb-1">在线客服</p>
                                <p className="text-base font-semibold text-gray-900">周一至周五 9:00 - 18:00</p>
                            </div>
                            <div className="bg-white rounded-xl p-5 border border-gray-100">
                                <p className="text-sm text-gray-500 mb-1">邮件回复</p>
                                <p className="text-base font-semibold text-gray-900">1-2个工作日内</p>
                            </div>
                        </div>
                    </div>

                    {/* 常见问题提示 */}
                    <div className="border border-gray-200 bg-gray-100 rounded-2xl p-6">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 mb-2">温馨提示</h3>
                                <p className="text-gray-700 text-sm leading-relaxed">
                                    在联系我们之前，建议您先查阅产品内的帮助文档或常见问题解答，许多问题可以在那里找到答案。
                                    如您需要反馈产品问题，请尽量提供详细的问题描述、截图或录屏，以便我们更快地为您解决问题。
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-gray-200 pt-3 mt-6">
                        <p className="text-gray-400 text-xs text-center">
                            © 2025 青海立乐科技有限公司 版权所有
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
