const WebSocket = require('ws');
const axios = require('axios');
const fs = require('fs');

async function run() {
    try {
        console.log('Fetching json/list...');
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

            // Enable DOM
            ws.send(JSON.stringify({ id: 1, method: 'DOM.enable' }));

            // Request the document
            ws.send(JSON.stringify({ id: 2, method: 'DOM.getDocument', params: { depth: -1, pierce: true } }));
        });

        ws.on('message', function incoming(data) {
            const msg = JSON.parse(data);

            if (msg.id === 2) {
                // DOM result
                fs.writeFileSync('dom_dump.json', JSON.stringify(msg.result.root, null, 2));
                console.log('Saved DOM dump to dom_dump.json');

                // Capture screenshot
                ws.send(JSON.stringify({ id: 3, method: 'Page.captureScreenshot' }));
            }

            if (msg.id === 3) {
                const buffer = Buffer.from(msg.result.data, 'base64');
                fs.writeFileSync('app_state_ws.png', buffer);
                console.log('Saved screenshot to app_state_ws.png');
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
