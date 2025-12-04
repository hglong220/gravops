const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');

function log(msg) {
    try {
        fs.appendFileSync('inspect_log_hybrid.txt', msg + '\n');
    } catch (e) {
        console.error(e);
    }
}

async function run() {
    try {
        log('Fetching json/list...');
        const response = await axios.get('http://127.0.0.1:7217/json/list');
        const pages = response.data;
        const appPage = pages.find(p => p.type === 'page' && p.url.includes('index.html'));

        if (!appPage) {
            log('Could not find the application page');
            return;
        }

        const wsUrl = appPage.webSocketDebuggerUrl;
        log(`Connecting to ${wsUrl}`);

        const browser = await puppeteer.connect({
            browserWSEndpoint: wsUrl,
            defaultViewport: null,
            ignoreHTTPSErrors: true
        });

        log('Connected to browser!');

        // When connecting to a specific page target via WS, the browser object *is* the page context effectively,
        // but Puppeteer still treats it as a Browser. We need to find the pages.
        const targets = await browser.pages();
        log(`Found ${targets.length} pages.`);

        const page = targets[0]; // Usually the first one is the one we connected to
        if (!page) {
            log('No page found in browser context');
            await browser.disconnect();
            return;
        }

        log(`Inspecting page: ${page.url()}`);

        const html = await page.content();
        fs.writeFileSync('app_dump_hybrid.html', html);
        log('Saved HTML');

        await page.screenshot({ path: 'app_state_hybrid.png' });
        log('Saved Screenshot');

        await browser.disconnect();
    } catch (error) {
        log('Error: ' + error);
    }
}

run();
