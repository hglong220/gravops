'use client';

export default function LicensePage() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">授权管理</h1>
                <p className="text-sm text-gray-500 mt-1">查看您的 License Key 并管理订阅套餐。</p>
            </div>

            {/* My License Section */}
            <div className="bg-stone-400 text-gray-900 rounded-2xl p-8 relative overflow-hidden border border-stone-500">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-900 rounded-full mix-blend-overlay filter blur-3xl opacity-20 -translate-y-1/2 translate-x-1/2"></div>

                <div className="relative z-10">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
                        <div>
                            <span className="inline-block px-3 py-1 rounded-full bg-black text-white text-xs font-bold mb-3">
                                专业版 (Professional)
                            </span>
                            <h2 className="text-xl font-bold">杭州政采云科技有限公司</h2>
                            <p className="text-gray-500 text-sm mt-1">统一社会信用代码: 91330106MA27WXXXXX</p>
                        </div>
                        <div className="mt-4 md:mt-0 text-right">
                            <p className="text-xs text-gray-500 mb-1">状态</p>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                <span className="font-bold text-green-400">授权生效中</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">有效期至 2025-12-31</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                        <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">您的 License Key (用于插件激活)</p>
                        <div className="flex items-center gap-4">
                            <code className="flex-1 font-mono text-xl md:text-2xl font-bold tracking-wide text-black">
                                ZCAI-8821-9932-ABX9-2210
                            </code>
                            <button className="px-4 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800 transition-colors flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                </svg>
                                复制
                            </button>
                        </div>
                    </div>

                    <div className="mt-6 flex items-start gap-3 p-4 rounded-lg bg-gray-50 border border-gray-200 text-gray-700 text-xs">
                        <svg className="w-5 h-5 flex-shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <div>
                            <p className="font-bold mb-1">企业信息已锁定</p>
                            <p className="opacity-80">
                                当前处于付费订阅期，为保障授权安全，企业信息（名称、税号等）无法修改。
                                <br />
                                如需变更主体，请联系客服或等待订阅过期后，通过手机+邮箱双重验证进行修改。
                            </p>
                        </div>
                    </div>
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
