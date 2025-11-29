export interface ApiConfig {
    baseUrl: string;
    token?: string;
}

export async function getApiConfig(): Promise<ApiConfig> {
    return new Promise((resolve) => {
        chrome.storage.local.get(['apiUrl', 'token'], (result) => {
            resolve({
                baseUrl: result.apiUrl || 'http://localhost:3000',
                token: result.token
            });
        });
    });
}

export async function fetchWithAuth(path: string, options: RequestInit = {}) {
    const config = await getApiConfig();
    const url = `${config.baseUrl}${path}`;

    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    if (config.token) {
        headers.set('Authorization', `Bearer ${config.token}`);
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    if (response.status === 401) {
        // Token expired or invalid
        chrome.storage.local.remove(['token']);
        throw new Error('Unauthorized: Please login in extension options');
    }

    return response;
}
