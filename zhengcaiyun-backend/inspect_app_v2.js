const puppeteer = require('puppeteer');
const fs = require('fs');

function log(msg) {
    try {
        fs.appendFileSync('inspect_log.txt', msg + '\n');
    } catch (e) {
        console.error(e);
    }
}

async function run() {
    try {
        log('Connecting to browser via browserURL...');
        const browser = await puppeteer.connect({
            browserURL: 'http://127.0.0.1:7217',
            defaultViewport: null,
            ignoreHTTPSErrors: true
        });

        log('Connected!');
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
        fs.writeFileSync('app_dump_v2.html', html);
        log('Saved HTML');

        await page.screenshot({ path: 'app_state_v2.png' });
        log('Saved Screenshot');

        await browser.disconnect();
    } catch (error) {
        log('Error: ' + error);
    }
}

run();
