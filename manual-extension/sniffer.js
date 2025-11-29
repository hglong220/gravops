// Network Sniffer - Aggressive Mode
(function () {
    console.log('ZCY Sniffer: Aggressive Mode Initialized');

    function isCategoryData(data) {
        if (!data || typeof data !== 'object') return false;
        const str = JSON.stringify(data);
        // Heuristic: Must contain 'name' and 'id', and likely 'children' or 'parentId' or be a large array
        // And specifically look for ZCY terms like 'category', 'catalog' in keys if possible, but structure is key.
        // A large tree usually has 'children'.
        if (str.length < 1000) return false; // Ignore small responses
        if (str.includes('children') && str.includes('name') && str.includes('id')) return true;
        if (Array.isArray(data) && data.length > 20 && data[0].name) return true;
        return false;
    }

    function handleResponse(url, responseText) {
        try {
            const data = JSON.parse(responseText);
            if (isCategoryData(data)) {
                console.log('ZCY Sniffer: Captured potential category data from', url);
                window.postMessage({
                    type: 'ZCY_CATEGORY_DATA_CAPTURED',
                    url: url,
                    data: data
                }, '*');
            }
        } catch (e) {
            // Not JSON
        }
    }

    // Override XHR
    const XHR = XMLHttpRequest.prototype;
    const send = XHR.send;
    const open = XHR.open;

    XHR.open = function (method, url) {
        this._url = url;
        return open.apply(this, arguments);
    };

    XHR.send = function () {
        this.addEventListener('load', function () {
            if (this.responseText) {
                handleResponse(this._url, this.responseText);
            }
        });
        return send.apply(this, arguments);
    };

    // Override Fetch
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const response = await originalFetch(...args);
        const clone = response.clone();
        clone.text().then(text => {
            handleResponse(response.url, text);
        }).catch(() => { });
        return response;
    };
})();
