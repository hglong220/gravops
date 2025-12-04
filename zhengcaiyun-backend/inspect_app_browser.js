const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');

function log(msg) {
    try {
        fs.appendFileSync('inspect_log_browser.txt', msg + '\n');
    } catch (e) {
        console.error(e);
    }
}

async function run() {
    try {
        log('Fetching json/version...');
        const response = await axios.get('http://127.0.0.1:7217/json/version');
        const wsUrl = response.data.webSocketDebuggerUrl;

        if (!wsUrl) {
            log('Could not find webSocketDebuggerUrl in json/version');
            return;
        }

        log(`Connecting to Browser WS: ${wsUrl}`);

        const browser = await puppeteer.connect({
            browserWSEndpoint: wsUrl,
            defaultViewport: null,
            ignoreHTTPSErrors: true
        });

        log('Connected to browser!');

        const targets = await browser.targets();
        log(`Found ${targets.length} targets.`);

        targets.forEach(t => log(`Target: ${t.type()} - ${t.url()}`));

        const target = targets.find(t => t.url().includes('index.html') && t.type() === 'page');
        if (!target) {
            log('No matching target found');
            await browser.disconnect();
            return;
        }

        log(`Attaching to target: ${target.url()}`);
        const page = await target.page();
        if (!page) {
            log('Could not attach to page');
            await browser.disconnect();
            return;
        }

        log(`Inspecting page: ${page.url()}`);

        const html = await page.content();
        fs.writeFileSync('app_dump_browser.html', html);
        log('Saved HTML');

        await page.screenshot({ path: 'app_state_browser.png' });
        log('Saved Screenshot');

        await browser.disconnect();
    } catch (error) {
        log('Error: ' + error);
    }
}

run();
