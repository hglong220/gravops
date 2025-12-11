/**
 * API 代理工具
 * 
 * 由于 Content Script 运行在 HTTPS 页面上，浏览器会阻止向 HTTP localhost 发送请求（Mixed Content）。
 * 这个工具通过 Background Script 代理请求，绕过这个限制。
 */

export interface ProxyResponse<T = any> {
    ok: boolean;
    status: number;
    data?: T;
    error?: string;
}

/**
 * 通过 Background Script 代理发送 API 请求
 * 
 * @param url - 完整的 API URL
 * @param options - fetch 选项（method, headers, body）
 * @returns Promise<ProxyResponse<T>>
 */
export async function apiProxy<T = any>(
    url: string,
    options: {
        method?: string;
        headers?: Record<string, string>;
        body?: any;
    } = {}
): Promise<ProxyResponse<T>> {
    try {
        // 检查是否在扩展环境中
        if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
            // 不在扩展环境中，直接发送请求
            const response = await fetch(url, {
                method: options.method || 'GET',
                headers: options.headers || {},
                body: options.body ? JSON.stringify(options.body) : undefined
            });

            const contentType = response.headers.get('content-type');
            let data;
            if (contentType?.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            return {
                ok: response.ok,
                status: response.status,
                data
            };
        }

        // 通过 Background Script 代理请求
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(
                {
                    type: 'API_PROXY',
                    url,
                    method: options.method || 'GET',
                    headers: options.headers || {},
                    body: options.body
                },
                (response: ProxyResponse<T>) => {
                    if (chrome.runtime.lastError) {
                        console.error('[API Proxy] Runtime error:', chrome.runtime.lastError);
                        resolve({
                            ok: false,
                            status: 0,
                            error: chrome.runtime.lastError.message || 'Extension runtime error'
                        });
                    } else {
                        resolve(response);
                    }
                }
            );
        });
    } catch (error: any) {
        console.error('[API Proxy] Error:', error);
        return {
            ok: false,
            status: 0,
            error: error.message || 'Unknown error'
        };
    }
}

/**
 * 通过代理发送 GET 请求
 */
export async function proxyGet<T = any>(
    url: string,
    headers?: Record<string, string>
): Promise<ProxyResponse<T>> {
    return apiProxy<T>(url, { method: 'GET', headers });
}

/**
 * 通过代理发送 POST 请求
 */
export async function proxyPost<T = any>(
    url: string,
    body: any,
    headers?: Record<string, string>
): Promise<ProxyResponse<T>> {
    return apiProxy<T>(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body
    });
}
