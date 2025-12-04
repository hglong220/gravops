const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');

function log(msg) {
    try {
        fs.appendFileSync('inspect_log_browser_v2.txt', msg + '\n');
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
            log('Could not find webSocketDebuggerUrl');
            return;
        }

        log(`Connecting to Browser WS: ${wsUrl}`);

        const browser = await puppeteer.connect({
            browserWSEndpoint: wsUrl,
            defaultViewport: null,
            ignoreHTTPSErrors: true
        });

        log('Connected to browser!');

        const pages = await browser.pages();
        log(`Found ${pages.length} pages.`);

        if (pages.length > 0) {
            const page = pages[0];
            log(`Inspecting page: ${page.url()}`);
            const html = await page.content();
            fs.writeFileSync('app_dump_browser_v2.html', html);
            log('Saved HTML');
            await page.screenshot({ path: 'app_state_browser_v2.png' });
            log('Saved Screenshot');
        } else {
            log('No pages found via browser.pages()');

            // Try to force discovery
            const targets = await browser.targets();
            log(`Targets: ${targets.length}`);
            for (const t of targets) {
                log(`Target: ${t.type()} - ${t.url()}`);
                if (t.type() === 'page' || t.type() === 'other') { // NW.js might use 'other'
                    try {
                        const p = await t.page();
                        if (p) {
                            log(`Got page from target ${t.url()}`);
                            const html = await p.content();
                            fs.writeFileSync('app_dump_browser_v2.html', html);
                            log('Saved HTML');
                            break;
                        }
                    } catch (e) {
                        log(`Error getting page from target: ${e.message}`);
                    }
                }
            }
        }

        await browser.disconnect();
    } catch (error) {
        log('Error: ' + error);
    }
}

run();
