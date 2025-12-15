import Link from 'next/link';

export default function TermsPage() {
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
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">用户服务协议</h1>
                    <p className="text-gray-500 text-sm mb-6">更新日期：2025年1月1日 | 生效日期：2025年1月1日</p>

                    <div className="prose prose-gray max-w-none">
                        <p className="text-sm text-gray-700 mb-6">
                            欢迎您使用青海立乐科技有限公司（以下简称"本公司"或"我们"）开发运营的"智跃"系列软件产品及相关服务（以下统称"本服务"）。请您在使用本服务前，仔细阅读并充分理解本协议各条款，特别是涉及免除或限制责任的条款、权利许可和信息使用的条款、法律适用和争议解决条款等。
                        </p>

                        <section className="mb-8">
                            <h2 className="text-lg font-bold text-gray-900 mb-3">一、协议的接受与修改</h2>
                            <p className="text-sm text-gray-700 mb-3">
                                1.1 当您通过注册、登录或以其他方式实际使用本服务时，即表示您已充分阅读、理解并同意接受本协议的约束。如您不同意本协议的任何条款，请勿使用本服务。
                            </p>
                            <p className="text-sm text-gray-700 mb-3">
                                1.2 我们有权根据法律法规的更新、产品功能的调整或经营需要，对本协议进行修改。修改后的协议将在本软件或官方网站上公布，公布后即时生效。如您继续使用本服务，则视为您已同意修改后的协议。
                            </p>
                            <p className="text-sm text-gray-700">
                                1.3 如您为未满18周岁的未成年人，请在法定监护人的陪同下阅读本协议，并在取得监护人同意后使用本服务。
                            </p>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-lg font-bold text-gray-900 mb-3">二、服务内容与使用规范</h2>
                            <p className="text-sm text-gray-700 mb-3">
                                2.1 本服务为用户提供政采云等电商平台的智能辅助工具，包括但不限于：商品信息采集、智能内容改写、图片处理、自动表单填写、商品批量上传等功能。
                            </p>
                            <p className="text-sm text-gray-700 mb-3">
                                2.2 您理解并同意，本服务仅作为提升工作效率的辅助工具，不保证能够完全满足您的所有需求，也不保证服务不会中断。对于因网络状况、通讯线路、第三方平台变更等任何原因造成的服务中断或不能满足需求，本公司不承担任何责任。
                            </p>
                            <p className="text-sm text-gray-700 mb-3">
                                2.3 在使用本服务过程中，您应当遵守：
                            </p>
                            <ul className="list-disc pl-5 text-sm text-gray-700 mb-3 space-y-1">
                                <li>中华人民共和国相关法律法规</li>
                                <li>政采云等第三方平台的用户协议和规则</li>
                                <li>商业道德和诚实信用原则</li>
                                <li>不得利用本服务从事任何违法违规活动</li>
                            </ul>
                            <p className="text-sm text-gray-700">
                                2.4 您不得将本服务用于任何非法目的，包括但不限于：发布虚假商品信息、侵犯他人知识产权、扰乱市场秩序、实施不正当竞争等行为。因您违规使用导致的一切法律责任和损失，由您自行承担。
                            </p>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-lg font-bold text-gray-900 mb-3">三、账号管理</h2>
                            <p className="text-sm text-gray-700 mb-3">
                                3.1 您需要注册账号才能使用本服务的完整功能。在注册时，您应当提供真实、准确、完整的个人资料，并在资料发生变化时及时更新。
                            </p>
                            <p className="text-sm text-gray-700 mb-3">
                                3.2 您的账号和密码由您自行设置并保管。您应当妥善保管账号信息，对于因账号密码保管不善或被他人使用所产生的后果，本公司不承担任何责任。
                            </p>
                            <p className="text-sm text-gray-700 mb-3">
                                3.3 您的账号仅限您本人使用，未经本公司书面同意，不得以任何形式赠与、借用、出租、转让或售卖给他人。
                            </p>
                            <p className="text-sm text-gray-700">
                                3.4 如发现任何未经授权使用您账号的情况，您应立即通知我们。本公司有权根据实际情况采取冻结账号、终止服务等措施。
                            </p>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-lg font-bold text-gray-900 mb-3">四、付费服务与退款政策</h2>
                            <p className="text-sm text-gray-700 mb-3">
                                4.1 本服务采用会员订阅制，您需购买相应的会员套餐后方可使用完整功能。各套餐的具体内容、价格及有效期以购买页面展示为准。
                            </p>
                            <p className="text-sm text-gray-700 mb-3">
                                4.2 会员服务为虚拟数字商品，一经购买成功，除以下情形外不予退款：
                            </p>
                            <ul className="list-disc pl-5 text-sm text-gray-700 mb-3 space-y-1">
                                <li>因本公司原因导致服务完全无法使用，且在7个工作日内无法修复的</li>
                                <li>法律法规明确规定应当退款的其他情形</li>
                            </ul>
                            <p className="text-sm text-gray-700">
                                4.3 会员服务到期后，如您未续费，您的账号将自动降级为免费版本，部分功能将受到限制。
                            </p>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-lg font-bold text-gray-900 mb-3">五、知识产权</h2>
                            <p className="text-sm text-gray-700 mb-3">
                                5.1 本服务所涉及的软件、技术、商标、文字、图片、视频等所有内容的知识产权均归本公司或相关权利人所有。未经书面授权，您不得复制、传播、修改、出售或以其他方式使用上述内容。
                            </p>
                            <p className="text-sm text-gray-700">
                                5.2 您使用本服务上传或产生的内容，您保证拥有合法的知识产权或已取得合法授权。因您上传内容引发的知识产权纠纷，由您独立承担全部责任。
                            </p>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-lg font-bold text-gray-900 mb-3">六、免责声明</h2>
                            <p className="text-sm text-gray-700 mb-3">
                                6.1 本服务仅为辅助工具，不对您使用本服务产生的任何商业后果承担责任，包括但不限于：
                            </p>
                            <ul className="list-disc pl-5 text-sm text-gray-700 mb-3 space-y-1">
                                <li>商品审核未通过或被下架</li>
                                <li>第三方平台对您的账号进行处罚</li>
                                <li>因商品信息问题导致的交易纠纷</li>
                                <li>其他与您经营活动相关的损失</li>
                            </ul>
                            <p className="text-sm text-gray-700 mb-3">
                                6.2 对于因不可抗力（包括但不限于自然灾害、政府行为、法律法规变更、网络攻击等）导致的服务中断或数据丢失，本公司不承担责任。
                            </p>
                            <p className="text-sm text-gray-700">
                                6.3 本服务可能包含指向第三方网站的链接。这些第三方网站不受本公司控制，本公司对其内容、隐私政策或做法不承担任何责任。
                            </p>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-lg font-bold text-gray-900 mb-3">七、服务的变更、中断与终止</h2>
                            <p className="text-sm text-gray-700 mb-3">
                                7.1 我们有权根据业务发展需要，变更、中断或终止部分或全部服务。如因此给您造成不便，我们将提前通知您。
                            </p>
                            <p className="text-sm text-gray-700 mb-3">
                                7.2 如您违反本协议的任何条款，我们有权立即暂停或终止向您提供服务，并保留追究您法律责任的权利。
                            </p>
                            <p className="text-sm text-gray-700">
                                7.3 服务终止后，本公司有权删除您的账号信息和相关数据，您应在服务终止前自行备份所需数据。
                            </p>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-lg font-bold text-gray-900 mb-3">八、法律适用与争议解决</h2>
                            <p className="text-sm text-gray-700 mb-3">
                                8.1 本协议的订立、生效、履行、解释及争议的解决均适用中华人民共和国法律（不包括香港、澳门、台湾地区法律）。
                            </p>
                            <p className="text-sm text-gray-700">
                                8.2 因本协议产生的或与本协议有关的任何争议，双方应首先协商解决。协商不成的，任何一方均有权向本公司所在地有管辖权的人民法院提起诉讼。
                            </p>
                        </section>

                        <div className="border-t border-gray-200 pt-3 mt-6">
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
