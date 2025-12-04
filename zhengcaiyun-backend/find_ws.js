const fs = require('fs');
const path = require('path');

function check(p) {
    try {
        require.resolve(p);
        console.log(`Found: ${p}`);
        return true;
    } catch (e) {
        return false;
    }
}

if (!check('ws')) {
    // Try to find it in node_modules
    const possiblePaths = [
        './node_modules/ws',
        './node_modules/puppeteer/node_modules/ws',
        '../node_modules/ws'
    ];

    possiblePaths.forEach(p => {
        if (fs.existsSync(p)) {
            console.log(`Found path: ${p}`);
        }
    });
}
