import Link from 'next/link';

export default function PrivacyPage() {
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
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">隐私政策</h1>
                    <p className="text-gray-500 text-sm mb-6">更新日期：2025年1月1日 | 生效日期：2025年1月1日</p>

                    <div className="prose prose-gray max-w-none">
                        <p className="text-sm text-gray-700 mb-6">
                            青海立乐科技有限公司（以下简称"本公司"或"我们"）深知个人信息对您的重要性，并将全力保护您的个人信息及隐私安全。我们制定本《隐私政策》旨在向您清晰地介绍我们如何收集、使用、存储、共享和保护您的个人信息，以及您如何管理您的个人信息。请您在使用我们的产品和服务前，仔细阅读并充分理解本政策。
                        </p>

                        <section className="mb-8">
                            <h2 className="text-lg font-bold text-gray-900 mb-3">一、我们收集的信息</h2>
                            <p className="text-sm text-gray-700 mb-3">
                                为了向您提供服务，我们需要收集以下类型的信息：
                            </p>

                            <h3 className="text-base font-semibold text-gray-800 mb-2 mt-4">1.1 您主动提供的信息</h3>
                            <ul className="list-disc pl-5 text-sm text-gray-700 mb-3 space-y-1">
                                <li><strong>账号信息：</strong>当您注册账号时，我们会收集您的手机号码、电子邮箱地址、设置的密码等</li>
                                <li><strong>身份信息：</strong>当您进行实名认证时，我们可能收集您的真实姓名、身份证号码等</li>
                                <li><strong>支付信息：</strong>当您购买会员服务时，我们会收集订单信息、支付账号等</li>
                                <li><strong>反馈信息：</strong>当您联系客服或提交反馈时，我们会收集您的联系方式和问题描述</li>
                            </ul>

                            <h3 className="text-base font-semibold text-gray-800 mb-2 mt-4">1.2 我们自动收集的信息</h3>
                            <ul className="list-disc pl-5 text-sm text-gray-700 mb-3 space-y-1">
                                <li><strong>设备信息：</strong>设备型号、操作系统版本、唯一设备标识符（用于授权验证和防止账号盗用）</li>
                                <li><strong>日志信息：</strong>服务使用记录、操作日志、IP地址、访问时间等</li>
                                <li><strong>使用数据：</strong>功能使用频率、操作习惯等（用于优化产品体验）</li>
                            </ul>

                            <h3 className="text-base font-semibold text-gray-800 mb-2 mt-4">1.3 我们不会收集的信息</h3>
                            <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                                <li>您在第三方平台（如政采云）的账号密码</li>
                                <li>您的银行卡号、信用卡信息等金融账户信息</li>
                                <li>与服务无关的个人隐私信息</li>
                            </ul>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-lg font-bold text-gray-900 mb-3">二、我们如何使用信息</h2>
                            <p className="text-sm text-gray-700 mb-3">
                                我们收集的信息将用于以下目的：
                            </p>
                            <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                                <li><strong>提供核心服务：</strong>验证您的身份、处理您的订单、提供会员功能</li>
                                <li><strong>账号安全保障：</strong>检测异常登录、防止账号被盗、保护账号安全</li>
                                <li><strong>客户服务：</strong>响应您的咨询、处理您的投诉和建议</li>
                                <li><strong>产品优化：</strong>分析使用数据、发现并修复问题、改进产品功能</li>
                                <li><strong>消息通知：</strong>向您发送服务通知、安全提醒、版本更新等重要信息</li>
                                <li><strong>法律合规：</strong>遵守法律法规的要求，配合政府部门的依法调查</li>
                            </ul>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-lg font-bold text-gray-900 mb-3">三、信息的存储与保护</h2>

                            <h3 className="text-base font-semibold text-gray-800 mb-2 mt-4">3.1 存储地点</h3>
                            <p className="text-sm text-gray-700 mb-3">
                                您的个人信息存储于中华人民共和国境内的服务器。如需跨境传输，我们将严格遵守法律法规的要求，并确保您的信息得到同等保护。
                            </p>

                            <h3 className="text-base font-semibold text-gray-800 mb-2 mt-4">3.2 存储期限</h3>
                            <p className="text-sm text-gray-700 mb-3">
                                我们仅在实现本政策所述目的所必需的期限内保留您的个人信息，但法律法规另有规定的除外。在超出保留期限后，我们会对您的个人信息进行删除或匿名化处理。
                            </p>

                            <h3 className="text-base font-semibold text-gray-800 mb-2 mt-4">3.3 安全措施</h3>
                            <p className="text-sm text-gray-700 mb-3">
                                我们采取了业界标准的安全技术手段保护您的信息，包括但不限于：
                            </p>
                            <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                                <li>数据传输加密（SSL/TLS协议）</li>
                                <li>敏感信息加密存储</li>
                                <li>严格的数据访问权限控制</li>
                                <li>定期安全审计和漏洞扫描</li>
                                <li>安全事件应急响应机制</li>
                            </ul>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-lg font-bold text-gray-900 mb-3">四、信息的共享与披露</h2>
                            <p className="text-sm text-gray-700 mb-3">
                                我们承诺对您的信息予以保密，不会向任何第三方出售您的个人信息。仅在以下情况下，我们可能会共享或披露您的信息：
                            </p>
                            <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                                <li><strong>经您授权同意：</strong>在获得您明确同意的情况下共享</li>
                                <li><strong>法律要求：</strong>根据法律法规的规定，或响应政府部门的依法要求</li>
                                <li><strong>保护权益：</strong>为保护本公司、用户或公众的合法权益所必需</li>
                                <li><strong>商业合作：</strong>与授权合作伙伴共享，以提供服务或完成交易（如支付服务商）</li>
                            </ul>
                            <p className="text-sm text-gray-700 mt-3">
                                在与第三方共享信息时，我们会要求其遵守保密义务，并采取适当的安全措施保护您的信息。
                            </p>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-lg font-bold text-gray-900 mb-3">五、您的权利</h2>
                            <p className="text-sm text-gray-700 mb-3">
                                根据相关法律法规，您对您的个人信息享有以下权利：
                            </p>
                            <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                                <li><strong>访问权：</strong>您有权访问我们持有的关于您的个人信息</li>
                                <li><strong>更正权：</strong>当您发现我们处理的信息有错误时，有权要求更正</li>
                                <li><strong>删除权：</strong>在满足一定条件下，您有权要求删除您的个人信息</li>
                                <li><strong>撤回同意：</strong>您可以撤回之前给予的同意，但不影响撤回前的处理</li>
                                <li><strong>注销账号：</strong>您可以申请注销账号，我们将删除或匿名化您的信息</li>
                            </ul>
                            <p className="text-sm text-gray-700 mt-3">
                                如需行使上述权利，请通过本政策载明的联系方式与我们联系，我们将在15个工作日内处理您的请求。
                            </p>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-lg font-bold text-gray-900 mb-3">六、Cookie和类似技术</h2>
                            <p className="text-sm text-gray-700 mb-3">
                                为确保网站正常运转、提供更好的用户体验，我们可能会在您的设备上存储Cookie或类似技术文件。这些文件有助于：
                            </p>
                            <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                                <li>记住您的登录状态，避免重复登录</li>
                                <li>记住您的偏好设置</li>
                                <li>分析您的使用习惯，优化产品功能</li>
                            </ul>
                            <p className="text-sm text-gray-700 mt-3">
                                您可以通过浏览器设置拒绝或管理Cookie，但这可能影响您使用我们的部分功能。
                            </p>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-lg font-bold text-gray-900 mb-3">七、未成年人保护</h2>
                            <p className="text-sm text-gray-700 mb-3">
                                本服务主要面向成年人提供。我们不会故意收集未满14周岁的未成年人的个人信息。如您为未成年人的监护人，发现我们可能在未经您同意的情况下收集了未成年人的信息，请及时联系我们，我们将按照法律法规的要求进行处理。
                            </p>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-lg font-bold text-gray-900 mb-3">八、隐私政策的修订</h2>
                            <p className="text-sm text-gray-700 mb-3">
                                我们可能会适时修订本隐私政策。当政策发生重大变更时，我们会在产品内以弹窗、公告或其他适当方式通知您。如您不同意修订后的政策，您可以选择停止使用我们的服务。
                            </p>
                        </section>

                        <div className="border-t border-gray-200 pt-5 mt-6">
                            <p className="text-gray-400 text-xs text-center">
                                © 2025 青海立乐科技有限公司 版权所有
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
