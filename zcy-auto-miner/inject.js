// inject.js
(function () {
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const response = await originalFetch(...args);
        const clone = response.clone();
        clone.json().then(data => {
            // 只要数据里有 result 或 data，就广播出去
            window.postMessage({ type: 'ZCY_CAPTURE', payload: data }, '*');
        }).catch(() => { });
        return response;
    };

    const XHR = XMLHttpRequest.prototype;
    const send = XHR.send;
    XHR.send = function () {
        this.addEventListener('load', function () {
            try {
                window.postMessage({ type: 'ZCY_CAPTURE', payload: JSON.parse(this.responseText) }, '*');
            } catch (e) { }
        });
        return send.apply(this, arguments);
    };
})();
