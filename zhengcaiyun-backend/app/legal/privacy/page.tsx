export default function PrivacyPage() {
    return (
        <div className="bg-white py-16 px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-base leading-7 text-gray-700">
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">隐私政策</h1>
                <p className="mt-6 text-xl leading-8">
                    青海立乐科技有限公司（以下简称“我们”）非常重视您的隐私保护。本政策旨在说明我们如何收集、使用和存储您的信息。
                </p>

                <div className="mt-10 max-w-2xl">
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">1. 信息收集</h2>
                    <p className="mt-6">
                        为了提供服务，我们可能会收集您的以下信息：
                        <ul className="list-disc pl-5 mt-2">
                            <li>账号信息（手机号、邮箱）</li>
                            <li>设备信息（用于授权验证）</li>
                            <li>操作日志（用于故障排查）</li>
                        </ul>
                    </p>

                    <h2 className="mt-10 text-2xl font-bold tracking-tight text-gray-900">2. 信息使用</h2>
                    <p className="mt-6">
                        我们收集的信息仅用于：
                        <ul className="list-disc pl-5 mt-2">
                            <li>验证您的身份和授权状态</li>
                            <li>提供客户支持</li>
                            <li>改进产品功能</li>
                        </ul>
                    </p>

                    <h2 className="mt-10 text-2xl font-bold tracking-tight text-gray-900">3. 信息安全</h2>
                    <p className="mt-6">
                        我们采取业界标准的安全措施来保护您的数据，防止未经授权的访问、公开披露、使用、修改、损坏或丢失。
                    </p>

                    <h2 className="mt-10 text-2xl font-bold tracking-tight text-gray-900">4. 第三方共享</h2>
                    <p className="mt-6">
                        除法律法规规定或征得您同意外，我们不会向任何第三方分享您的个人信息。
                    </p>

                    <h2 className="mt-10 text-2xl font-bold tracking-tight text-gray-900">5. 联系我们</h2>
                    <p className="mt-6">
                        如果您对本隐私政策有任何疑问，请通过 support@liletech.com 联系我们。
                    </p>
                </div>
            </div>
        </div>
    );
}
