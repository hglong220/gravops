const puppeteer = require('puppeteer');
const fs = require('fs');
const axios = require('axios');

async function run() {
    try {
        // 1. Get the WebSocket Debugger URL
        const response = await axios.get('http://127.0.0.1:7217/json/list');
        const pages = response.data;
        // Find the page that looks like the main app (usually type 'page' and has a title or specific URL)
        // Based on previous output, the main page had title "wbf" and url ending in index.html
        const appPage = pages.find(p => p.type === 'page' && p.url.includes('index.html'));

        if (!appPage) {
            console.error('Could not find the application page in /json/list');
            console.log('Available pages:', JSON.stringify(pages, null, 2));
            return;
        }

        const wsEndpoint = appPage.webSocketDebuggerUrl;
        console.log(`Connecting to ${wsEndpoint}`);

        // 2. Connect to the browser
        const browser = await puppeteer.connect({
            browserWSEndpoint: wsEndpoint,
            defaultViewport: null // Preserve existing viewport
        });

        // 3. Get the pages (Puppeteer might see multiple targets)
        const targets = await browser.pages();
        // We need the one matching our target. Since we connected to the browser, 'pages()' returns all open pages.
        // We can filter by URL.
        const page = targets.find(t => t.url().includes('index.html')) || targets[0];

        if (!page) {
            console.error('Could not find the page object in Puppeteer');
            await browser.disconnect();
            return;
        }

        console.log(`Connected to page: ${page.url()}`);
        console.log(`Page Title: ${await page.title()}`);

        // 4. Dump HTML
        const html = await page.content();
        fs.writeFileSync('app_dump.html', html);
        console.log('Saved HTML to app_dump.html');

        // 5. Take Screenshot
        await page.screenshot({ path: 'app_state.png' });
        console.log('Saved screenshot to app_state.png');

        await browser.disconnect();

    } catch (error) {
        console.error('Error:', error);
    }
}

run();
