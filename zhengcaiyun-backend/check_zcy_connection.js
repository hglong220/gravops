const axios = require('axios');

async function run() {
    try {
        console.log('Checking for ZCY tab on port 7217...');
        const response = await axios.get('http://127.0.0.1:7217/json/list');
        const pages = response.data;
        const zcyPage = pages.find(p => p.url.includes('zcygov.cn'));

        if (zcyPage) {
            console.log('SUCCESS: Found ZCY tab!');
            console.log('Title:', zcyPage.title);
            console.log('URL:', zcyPage.url);
            console.log('WebSocket Debugger URL:', zcyPage.webSocketDebuggerUrl);
        } else {
            console.log('FAILURE: ZCY tab not found.');
            console.log('Open tabs:', pages.map(p => p.url).join(', '));
        }
    } catch (error) {
        console.error('Error connecting to Chrome on port 7217:', error.message);
        console.log('Make sure Chrome is running with --remote-debugging-port=7217');
    }
}

run();
