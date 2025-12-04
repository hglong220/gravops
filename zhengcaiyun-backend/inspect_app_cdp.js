const WebSocket = require('ws');
const axios = require('axios');
const fs = require('fs');

async function run() {
    try {
        // 1. Get the WebSocket Debugger URL
        const response = await axios.get('http://127.0.0.1:7217/json/list');
        const pages = response.data;
        const appPage = pages.find(p => p.type === 'page' && p.url.includes('index.html'));

        if (!appPage) {
            console.error('Could not find the application page');
            return;
        }

        const wsUrl = appPage.webSocketDebuggerUrl;
        console.log(`Connecting to ${wsUrl}`);

        const ws = new WebSocket(wsUrl);

        ws.on('open', function open() {
            console.log('Connected to WebSocket');

            // Enable DOM and Network domains
            ws.send(JSON.stringify({ id: 1, method: 'DOM.enable' }));
            ws.send(JSON.stringify({ id: 2, method: 'Network.enable' }));

            // Request the document
            ws.send(JSON.stringify({ id: 3, method: 'DOM.getDocument', params: { depth: -1, pierce: true } }));

            // Capture screenshot
            ws.send(JSON.stringify({ id: 4, method: 'Page.captureScreenshot' }));
        });

        ws.on('message', function incoming(data) {
            const msg = JSON.parse(data);

            if (msg.id === 3) {
                // DOM result
                fs.writeFileSync('dom_tree.json', JSON.stringify(msg.result.root, null, 2));
                console.log('Saved DOM tree to dom_tree.json');
            }

            if (msg.id === 4) {
                // Screenshot result
                const buffer = Buffer.from(msg.result.data, 'base64');
                fs.writeFileSync('app_state.png', buffer);
                console.log('Saved screenshot to app_state.png');
                process.exit(0);
            }
        });

        ws.on('error', (err) => {
            console.error('WebSocket error:', err);
            process.exit(1);
        });

    } catch (error) {
        console.error('Error:', error);
    }
}

run();
