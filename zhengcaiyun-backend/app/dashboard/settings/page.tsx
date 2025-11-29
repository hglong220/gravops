'use client';

export default function SettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">账户设置</h1>
                <p className="text-sm text-gray-500 mt-1">管理您的企业信息和账户安全。</p>
            </div>

            {/* Company Info */}
            <div className="bg-white rounded-2xl border border-gray-200 p-8">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-gray-900">企业信息</h2>
                    {/* Mock Subscription Status: Change to 'inactive' to test editable state */}
                    {(() => {
                        const subscriptionStatus = 'active'; // 'active' | 'inactive' | 'expired'
                        const isEditable = subscriptionStatus !== 'active';

                        return (
                            <div className="relative group">
                                <button
                                    disabled={!isEditable}
                                    className={`text-sm font-medium transition-colors ${isEditable
                                            ? 'text-black hover:underline cursor-pointer'
                                            : 'text-gray-400 cursor-not-allowed'
                                        }`}
                                >
                                    编辑信息
                                </button>
                                {!isEditable && (
                                    <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                                        <p>当前处于付费订阅期，为保障授权安全，企业信息无法修改。如需变更请联系客服。</p>
                                        <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-900 rotate-45"></div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">公司名称</label>
                        <p className="text-gray-900 font-medium">杭州政采云科技有限公司</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">统一社会信用代码</label>
                        <p className="text-gray-900 font-medium font-mono">91330106MA27WXXXXX</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">法人姓名</label>
                        <p className="text-gray-900 font-medium">张三</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">联系电话</label>
                        <p className="text-gray-900 font-medium font-mono">138****8888</p>
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
                            <p className="font-medium text-gray-900">绑定邮箱</p>
                            <p className="text-sm text-gray-500 mt-0.5">已绑定：ad***@zhengcaiyun.cn</p>
                        </div>
                        <button className="px-4 py-2 bg-gray-50 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors">
                            更换邮箱
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
                <p className="text-sm text-red-600 mb-6">
                    注销账户将永久删除您的所有数据和授权信息，此操作不可恢复。
                </p>
                <button className="px-6 py-2 bg-white border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors">
                    注销账户
                </button>
            </div>
        </div>
    );
}
