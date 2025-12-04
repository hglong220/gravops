import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
    matches: ["https://www.zcygov.cn/*"],
    world: "MAIN", // Execute in the Main World to access window objects
    run_at: "document_start"
}

// Intercept XMLHttpRequest
const originalOpen = window.XMLHttpRequest.prototype.open;
const originalSend = window.XMLHttpRequest.prototype.send;

window.XMLHttpRequest.prototype.open = function (method, url) {
    this._url = url;
    return originalOpen.apply(this, arguments as any);
};

window.XMLHttpRequest.prototype.send = function (body) {
    this.addEventListener('load', function () {
        try {
            // Filter for relevant APIs
            // We are looking for APIs that might return "bidId", "protocolId", or "标项"
            if (this._url && (
                this._url.includes('/category/attr/select') ||
                this._url.includes('/agreement/') ||
                this._url.includes('/protocol/') ||
                this._url.includes('getDraft') // Often contains saved data including permissions
            )) {
                const responseText = this.responseText;
                if (responseText && (responseText.includes('bidId') || responseText.includes('标项'))) {
                    console.log('[ZCY Interceptor] Found potential permission data in:', this._url);

                    // Send to Content Script (Isolated World)
                    window.postMessage({
                        type: 'ZCY_PERMISSION_DATA_INTERCEPTED',
                        url: this._url,
                        response: responseText
                    }, '*');
                }
            }
        } catch (e) {
            console.error('[ZCY Interceptor] Error parsing XHR:', e);
        }
    });
    return originalSend.apply(this, arguments as any);
};

// Intercept Fetch
const originalFetch = window.fetch;
window.fetch = async function (input, init) {
    const response = await originalFetch(input, init);

    try {
        const clone = response.clone();
        const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : '');

        if (url && (
            url.includes('/category/attr/select') ||
            url.includes('/agreement/') ||
            url.includes('/protocol/') ||
            url.includes('getDraft')
        )) {
            clone.text().then(text => {
                if (text && (text.includes('bidId') || text.includes('标项'))) {
                    console.log('[ZCY Interceptor] Found potential permission data in fetch:', url);
                    window.postMessage({
                        type: 'ZCY_PERMISSION_DATA_INTERCEPTED',
                        url: url,
                        response: text
                    }, '*');
                }
            }).catch(e => console.error('[ZCY Interceptor] Error reading fetch body:', e));
        }
    } catch (e) {
        console.error('[ZCY Interceptor] Error intercepting fetch:', e);
    }

    return response;
};

console.log('[ZCY Interceptor] Network interception active');
