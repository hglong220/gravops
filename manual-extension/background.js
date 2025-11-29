
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'download_category_json') {
        // Create a data URL directly from the JSON string
        const jsonStr = JSON.stringify(request.data, null, 2);
        const dataUrl = 'data:application/json;base64,' + btoa(unescape(encodeURIComponent(jsonStr)));

        chrome.downloads.download({
            url: dataUrl,
            filename: 'zcy_categories_full.json',
            saveAs: true
        });
    }
});
