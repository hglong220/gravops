export interface ApiConfig {
    baseUrl: string;
    token?: string;
}

export async function getApiConfig(): Promise<ApiConfig> {
    return new Promise((resolve) => {
        chrome.storage.local.get(['apiUrl', 'token'], (result) => {
            resolve({
                baseUrl:
                    result.apiUrl ||
                    process.env.PLASMO_PUBLIC_BACKEND_URL ||
                    'http://localhost:3000',
                token: result.token
            });
        });
    });
}

async function refreshPluginToken(baseUrl: string): Promise<string | null> {
    const { licenseKey, licenseInfo, deviceId } = await chrome.storage.local.get([
        'licenseKey',
        'licenseInfo',
        'deviceId'
    ]);

    const companyName = licenseInfo?.companyName;
    if (!licenseKey || !companyName || !deviceId) return null;

    try {
        const res = await fetch(`${baseUrl}/api/plugin/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ licenseKey, companyName, deviceId })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.valid || !data?.token) return null;

        await chrome.storage.local.set({ token: data.token });
        return data.token as string;
    } catch (e) {
        console.error('[API] Failed to refresh plugin token:', e);
        return null;
    }
}

export async function fetchWithAuth(path: string, options: RequestInit = {}) {
    const config = await getApiConfig();
    const url = `${config.baseUrl}${path}`;

    const makeHeaders = (token?: string) => {
        const headers = new Headers(options.headers);
        headers.set('Content-Type', 'application/json');
        if (token) {
            headers.set('Authorization', `Bearer ${token}`);
        }
        return headers;
    };

    const doFetch = (token?: string) =>
        fetch(url, {
            ...options,
            headers: makeHeaders(token)
        });

    let response = await doFetch(config.token);

    if (response.status === 401) {
        // Token expired or invalid: try refresh once (licenseKey -> short-lived token)
        const refreshed = await refreshPluginToken(config.baseUrl);
        if (refreshed) {
            response = await doFetch(refreshed);
        }

        if (response.status === 401) {
            await chrome.storage.local.remove(['token']);
            throw new Error('Unauthorized: Please activate license in extension options');
        }
    }

    return response;
}
