import { useState, useEffect } from "react";
import { useAppStore } from "~src/store/app-store";
import { clearLicense, getStoredLicense, verifyLicense, storeLicense } from "~src/utils/license";
import { isHighRiskProduct } from "~src/utils/trojan-strategy";
import logo from "data-base64:../assets/logo.png";

import "./style.css";

function IndexPopup() {
    const {
        isActivated,
        companyName,
        setLicense,
        reset
    } = useAppStore();

    const [inputLicense, setInputLicense] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [productName, setProductName] = useState("");
    const [currentUrl, setCurrentUrl] = useState("");

    const normalizeApiUrl = (input: string) => input.trim().replace(/\/+$/, "");

    const isLocalHostname = (hostname: string) =>
        hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

    const ensureHostPermission = async (baseUrl: string) => {
        const normalized = normalizeApiUrl(baseUrl);
        const origin = new URL(normalized).origin;
        const pattern = `${origin}/*`;

        const alreadyGranted = await new Promise<boolean>((resolve) => {
            chrome.permissions.contains({ origins: [pattern] }, resolve);
        });

        if (alreadyGranted) return true;

        return new Promise<boolean>((resolve) => {
            chrome.permissions.request({ origins: [pattern] }, (granted) => resolve(!!granted));
        });
    };

    useEffect(() => {
        checkLocalLicense();
        checkCurrentTab();
    }, []);

    const checkCurrentTab = async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.url) {
            setCurrentUrl(tab.url);
        }
    };

    const checkLocalLicense = async () => {
        const stored = await getStoredLicense();
        if (stored) {
            setLicense(stored.licenseKey, stored.companyName, 0);
        }
    };

    const handleActivate = async () => {
        if (!inputLicense.trim()) {
            setError("请输入授权码");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const storedConfig = await chrome.storage.local.get(["apiUrl"]);
            const baseUrl = normalizeApiUrl(
                storedConfig.apiUrl ||
                process.env.PLASMO_PUBLIC_BACKEND_URL ||
                "http://localhost:3000"
            );

            const urlObj = new URL(baseUrl);
            if (urlObj.protocol !== "https:" && !isLocalHostname(urlObj.hostname)) {
                setError("生产环境必须使用 HTTPS（本地 localhost 可用 http）");
                setLoading(false);
                return;
            }

            if (!isLocalHostname(urlObj.hostname)) {
                const granted = await ensureHostPermission(baseUrl);
                if (!granted) {
                    setError("未授权访问该后端域名，请在弹窗中点击允许");
                    setLoading(false);
                    return;
                }
            }

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab.url?.includes('zcygov.cn')) {
                setError("请先打开政采云网站并登录");
                setLoading(false);
                return;
            }

            const result = await chrome.scripting.executeScript({
                target: { tabId: tab.id! },
                func: () => {
                    // 用正则表达式提取公司名称
                    const extractCompanyName = (text: string): string | null => {
                        if (!text) return null;
                        // 公司名称通常以省市名、方位词开头，以"有限公司"结尾
                        // 排除常见的非公司名前缀
                        const patterns = [
                            // 以省市县/地名开头的公司名
                            /((?:青海|北京|上海|广东|浙江|江苏|四川|山东|河南|湖北|湖南|安徽|陕西|福建|云南|贵州|甘肃|新疆|西藏|内蒙古|广西|宁夏|海南|黑龙江|吉林|辽宁|河北|山西|江西|天津|重庆)[\u4e00-\u9fa5]{1,20}(?:有限责任公司|有限公司|股份有限公司|股份公司))/,
                            // 通用匹配：查找"省/市/县"后面跟着的公司名
                            /([\u4e00-\u9fa5]{2,4}(?:省|市|县|区)[\u4e00-\u9fa5]{2,15}(?:有限责任公司|有限公司|股份有限公司))/,
                            // 从"有限公司"往前找
                            /([\u4e00-\u9fa5]{4,20}(?:有限责任公司|有限公司|股份有限公司))/
                        ];
                        for (const pattern of patterns) {
                            const match = text.match(pattern);
                            if (match) {
                                let name = match[1];
                                // 去掉常见的非公司名前缀
                                const prefixes = ['管理', '经理', '负责', '联系', '采购', '供应', 'CA', '登录', '退出'];
                                for (const prefix of prefixes) {
                                    if (name.startsWith(prefix)) {
                                        name = name.slice(prefix.length);
                                    }
                                }
                                // 去掉人名（两个或三个字的连续汉字紧接公司名前）
                                const nameMatch = name.match(/^[\u4e00-\u9fa5]{2,3}([\u4e00-\u9fa5]{2,}(?:省|市|县|区)[\u4e00-\u9fa5]+(?:有限|公司))/);
                                if (nameMatch) {
                                    name = nameMatch[1];
                                }
                                if (name.length > 6) return name;
                            }
                        }
                        return null;
                    };

                    // 方法1: 从localStorage/sessionStorage提取（最准确）
                    const keys = ['userInfo', 'companyInfo', 'user', 'loginInfo'];
                    for (const key of keys) {
                        const data = localStorage.getItem(key) || sessionStorage.getItem(key);
                        if (data) {
                            try {
                                const parsed = JSON.parse(data);
                                const name = parsed.companyName || parsed.company || parsed.corpName || parsed.enterpriseName;
                                if (name) return name;
                            } catch (e) { }
                        }
                    }

                    // 方法2: 从页面文本中提取公司名称
                    const allElements = document.querySelectorAll('span, div, a, p, td');
                    for (const el of allElements) {
                        const text = el.textContent?.trim();
                        if (text) {
                            const companyName = extractCompanyName(text);
                            if (companyName && companyName.length > 4 && companyName.length < 30) {
                                return companyName;
                            }
                        }
                    }

                    return null;
                }
            });

            const zcyCompanyName = result[0]?.result;

            if (!zcyCompanyName) {
                setError("无法从政采云提取公司名称，请确保已登录");
                setLoading(false);
                return;
            }

            const verifyResult = await verifyLicense(inputLicense, zcyCompanyName);

            if (!verifyResult.valid) {
                if (verifyResult.code === 'LICENSE_NOT_LINKED') {
                    setError('该授权码未绑定到任何网站账号。请先登录网站，在「授权管理」绑定 KEY 后再回来激活。');
                    if (verifyResult.bindUrl) {
                        try {
                            const url = new URL(verifyResult.bindUrl, baseUrl).toString();
                            const go = confirm('是否现在打开授权绑定页面？');
                            if (go) {
                                chrome.tabs.create({ url });
                            }
                        } catch {
                            // ignore
                        }
                    }
                } else if (verifyResult.code === 'DEVICE_LIMIT') {
                    const cur = verifyResult.currentDevices ?? 0;
                    const max = verifyResult.maxDevices ?? 0;
                    setError(`超过最大设备数限制（${cur}/${max}）。请联系管理员重置设备或提高上限。`);
                } else {
                    setError(verifyResult.error || "授权验证失败");
                }
                setLoading(false);
                return;
            }

            await storeLicense(inputLicense, zcyCompanyName);
            setLicense(inputLicense, zcyCompanyName, verifyResult.expiresAt || 0);

            setInputLicense("");
        } catch (err) {
            console.error(err);
            setError("激活失败: " + (err instanceof Error ? err.message : "未知错误"));
        } finally {
            setLoading(false);
        }
    };

    const handleDeactivate = async () => {
        reset();
        await clearLicense();
    };

    const handleUpload = async () => {
        if (!productName.trim()) {
            alert("请输入商品名称");
            return;
        }

        setLoading(true);
        try {
            const stored = await getStoredLicense();
            if (!stored) {
                throw new Error("License not found");
            }

            // 1. Check Risk
            const { isRisk, safeName } = await isHighRiskProduct(productName, stored.licenseKey);

            let useTrojan = false;
            if (isRisk) {
                useTrojan = confirm(`⚠️ 检测到"${productName}"属于高风险敏感商品。\n\n建议使用“木马策略”：\n1. 先上传安全替代品 (${safeName || '办公配件'})\n2. 等待审核通过\n3. 自动替换为真实商品\n\n是否启用安全策略？`);
            }

            // 2. Create Task
            const task = {
                id: Date.now().toString(),
                step: useTrojan ? 'init' : 'replacing', // replacing step uploads original product
                safeName: safeName,
                originalProduct: {
                    name: productName,
                    description: '自动生成的商品描述...', // Should be generated by AI in real app
                    category: '', // Auto-detect
                    images: [], // Auto-search
                    price: '0',
                    stock: '100'
                },
                startTime: Date.now()
            };

            await chrome.storage.local.set({ 'trojan_task': task });

            // 3. Trigger Worker
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab.id) {
                // Navigate to publish page to start the worker
                await chrome.tabs.update(tab.id, { url: 'https://www.zcygov.cn/publish' });
                window.close(); // Close popup
            }

        } catch (err) {
            console.error(err);
            alert("启动失败: " + (err instanceof Error ? err.message : "未知错误"));
            setLoading(false);
        }
    };

    const handleOneClickCopy = async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
            // Send message to content script (zcy-scraper.tsx)
            // Or inject script to click the button we injected
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    const btn = document.getElementById('zcy-copy-btn');
                    if (btn) {
                        btn.click();
                    } else {
                        alert('请等待页面加载完成或刷新重试');
                    }
                }
            });
            window.close();
        }
    };

    if (!isActivated) {
        return (
            <div className="popup-container">
                <div className="header">
                    <div className="logo-container">
                        <img src={logo} alt="Logo" className="logo" />
                        <h1>政采云智能助手</h1>
                        <p className="subtitle">AI-Powered Automation</p>
                    </div>
                </div>

                <div className="content">
                    <div className="activation-form">
                        <input
                            type="text"
                            placeholder="请输入授权码"
                            value={inputLicense}
                            onChange={(e) => setInputLicense(e.target.value)}
                            disabled={loading}
                        />

                        {error && <div className="error">{error}</div>}

                        <button
                            onClick={handleActivate}
                            disabled={loading}
                            className="btn-primary"
                        >
                            {loading ? "验证中..." : "激活"}
                        </button>

                        <div className="hint">
                            💡 提示：请先登录政采云网站，然后返回此处激活
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="popup-container">
            <div className="header">
                <div className="logo-container">
                    <img src={logo} alt="Logo" className="logo" />
                    <h1>政采云智能助手</h1>
                </div>
            </div>

            <div className="content">
                <div className="license-info" style={{ textAlign: 'center', padding: '12px 0' }}>
                    <div style={{ fontSize: '16px', color: '#1a1a2e', marginBottom: '10px' }}>
                        {companyName}
                    </div>
                    <div className="activated-badge">✓ 已激活</div>
                </div>
            </div>
        </div>
    );
}

export default IndexPopup;
