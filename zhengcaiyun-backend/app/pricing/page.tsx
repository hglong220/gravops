import Link from 'next/link';

export default function PricingPage() {
    return (
        <div className="bg-white py-24 sm:py-32">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                <div className="mx-auto max-w-4xl text-center">
                    <h2 className="text-base font-semibold leading-7 text-indigo-600">定价方案</h2>
                    <p className="mt-2 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                        选择适合您的方案
                    </p>
                </div>
                <p className="mx-auto mt-6 max-w-2xl text-center text-lg leading-8 text-gray-600">
                    无论您是个人卖家还是大型企业，我们都有合适的解决方案帮助您提升效率。
                </p>

                <div className="isolate mx-auto mt-16 grid max-w-md grid-cols-1 gap-y-8 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-2">
                    {/* Monthly Plan */}
                    <div className="flex flex-col justify-between rounded-3xl bg-white p-8 ring-1 ring-gray-200 xl:p-10 hover:shadow-lg transition-shadow">
                        <div>
                            <div className="flex items-center justify-between gap-x-4">
                                <h3 className="text-lg font-semibold leading-8 text-gray-900">月度会员</h3>
                            </div>
                            <p className="mt-4 text-sm leading-6 text-gray-600">适合短期项目或试用体验。</p>
                            <p className="mt-6 flex items-baseline gap-x-1">
                                <span className="text-4xl font-bold tracking-tight text-gray-900">¥299</span>
                                <span className="text-sm font-semibold leading-6 text-gray-600">/月</span>
                            </p>
                            <ul role="list" className="mt-8 space-y-3 text-sm leading-6 text-gray-600">
                                <li className="flex gap-x-3">✓ 无限次商品复制</li>
                                <li className="flex gap-x-3">✓ 智能AI改写</li>
                                <li className="flex gap-x-3">✓ 7x12小时客服支持</li>
                                <li className="flex gap-x-3">✓ 单设备授权</li>
                            </ul>
                        </div>
                        <a href="#" className="mt-8 block rounded-md bg-indigo-50 px-3 py-2 text-center text-sm font-semibold leading-6 text-indigo-600 hover:bg-indigo-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                            立即购买
                        </a>
                    </div>

                    {/* Yearly Plan */}
                    <div className="flex flex-col justify-between rounded-3xl bg-gray-900 p-8 ring-1 ring-gray-900 xl:p-10 hover:shadow-xl transition-shadow">
                        <div>
                            <div className="flex items-center justify-between gap-x-4">
                                <h3 className="text-lg font-semibold leading-8 text-white">年度会员</h3>
                                <span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold leading-5 text-indigo-400 ring-1 ring-inset ring-indigo-500/20">最受欢迎</span>
                            </div>
                            <p className="mt-4 text-sm leading-6 text-gray-300">适合长期运营，享受最大优惠。</p>
                            <p className="mt-6 flex items-baseline gap-x-1">
                                <span className="text-4xl font-bold tracking-tight text-white">¥2999</span>
                                <span className="text-sm font-semibold leading-6 text-gray-300">/年</span>
                            </p>
                            <ul role="list" className="mt-8 space-y-3 text-sm leading-6 text-gray-300">
                                <li className="flex gap-x-3">✓ 包含月度会员所有权益</li>
                                <li className="flex gap-x-3">✓ 优先客服支持</li>
                                <li className="flex gap-x-3">✓ 专属客户经理</li>
                                <li className="flex gap-x-3">✓ 支持3台设备同时在线</li>
                                <li className="flex gap-x-3">✓ 赠送2个月时长 (立省 ¥589)</li>
                            </ul>
                        </div>
                        <a href="#" className="mt-8 block rounded-md bg-indigo-500 px-3 py-2 text-center text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">
                            立即购买
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
