import CryptoJS from 'crypto-js';

const API_BASE_URL = 'http://localhost:3000'; // 本地开发服务器

export interface LicenseVerifyResult {
    valid: boolean;
    error?: string;
    companyName?: string;
    expiresAt?: number;
}

// 加密存储License信息
export async function storeLicense(licenseKey: string, companyName: string): Promise<void> {
    const encrypted = CryptoJS.AES.encrypt(
        JSON.stringify({ licenseKey, companyName, activatedAt: Date.now() }),
        'your-secret-key'
    ).toString();

    await chrome.storage.local.set({ license: encrypted });
    console.log('[License] 已保存授权信息');
}

// 读取本地License信息
export async function getStoredLicense(): Promise<{ licenseKey: string; companyName: string } | null> {
    const result = await chrome.storage.local.get('license');
    if (!result.license) return null;

    try {
        const decrypted = CryptoJS.AES.decrypt(result.license, 'your-secret-key').toString(CryptoJS.enc.Utf8);
        const data = JSON.parse(decrypted);
        return { licenseKey: data.licenseKey, companyName: data.companyName };
    } catch (error) {
        console.error('[License] 解密失败:', error);
        return null;
    }
}

// 验证License
export async function verifyLicense(
    licenseKey: string,
    currentCompanyName: string
): Promise<LicenseVerifyResult> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/verify-license`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                licenseKey,
                companyName: currentCompanyName
            })
        });

        if (!response.ok) {
            const error = await response.json();
            return { valid: false, error: error.message || '验证失败' };
        }

        const data = await response.json();
        return {
            valid: true,
            companyName: data.companyName,
            expiresAt: data.expiresAt
        };
    } catch (error) {
        console.error('[License] 验证请求失败:', error);
        return { valid: false, error: '网络错误，请检查连接' };
    }
}

// 在线验证（每次使用前调用）
export async function checkAuthorization(currentCompanyName: string): Promise<boolean> {
    const stored = await getStoredLicense();

    if (!stored) {
        console.warn('[Auth] 未找到本地授权信息');
        return false;
    }

    // 验证公司名称是否匹配
    if (stored.companyName !== currentCompanyName) {
        console.error('[Auth] 公司名称不匹配');
        return false;
    }

    // 在线验证License有效性
    const result = await verifyLicense(stored.licenseKey, currentCompanyName);
    return result.valid;
}

// 清除授权信息
export async function clearLicense(): Promise<void> {
    await chrome.storage.local.remove('license');
    console.log('[License] 已清除授权信息');
}
