const net = require('net');
const url = require('url');
const fs = require('fs');
const http = require('http');

// Helper to fetch JSON
function fetchJson(u) {
    return new Promise((resolve, reject) => {
        http.get(u, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

// Minimal WebSocket Frame Encoder/Decoder
function encodeFrame(data) {
    const payload = Buffer.from(data);
    const len = payload.length;
    let header;
    if (len < 126) {
        header = Buffer.from([0x81, 0x80 | len, 0, 0, 0, 0]); // Masked
    } else if (len < 65536) {
        header = Buffer.alloc(8);
        header[0] = 0x81;
        header[1] = 0x80 | 126;
        header.writeUInt16BE(len, 2);
    } else {
        header = Buffer.alloc(14);
        header[0] = 0x81;
        header[1] = 0x80 | 127;
        header.writeBigUInt64BE(BigInt(len), 2);
    }
    // Masking is required for client-to-server
    const mask = Buffer.alloc(4); // Zero mask for simplicity (not secure but works for debugging)
    const maskedPayload = Buffer.alloc(len);
    for (let i = 0; i < len; i++) maskedPayload[i] = payload[i] ^ mask[i % 4];

    // Actually, let's use a real mask to be spec compliant just in case
    // But 0 mask is fine if we set the mask bit.
    // Let's just use 0 mask.

    return Buffer.concat([header, maskedPayload]);
}

function decodeFrame(buffer) {
    // Very simple decoder, assumes unmasked server-to-client and single frame
    if (buffer.length < 2) return null;
    const len = buffer[1] & 0x7F;
    let offset = 2;
    let payloadLen = len;
    if (len === 126) {
        payloadLen = buffer.readUInt16BE(2);
        offset = 4;
    } else if (len === 127) {
        // BigInt, assume it fits in number for now
        offset = 10;
    }

    if (buffer.length < offset + payloadLen) return null; // Incomplete
    return buffer.slice(offset, offset + payloadLen);
}

async function run() {
    try {
        console.log('Fetching json/list...');
        const pages = await fetchJson('http://127.0.0.1:7217/json/list');
        const appPage = pages.find(p => p.type === 'page' && p.url.includes('index.html'));

        if (!appPage) {
            console.error('App page not found');
            return;
        }

        const wsUrl = appPage.webSocketDebuggerUrl;
        console.log(`Connecting to ${wsUrl}`);
        const parsed = url.parse(wsUrl);

        const socket = net.connect(parsed.port, parsed.hostname, () => {
            console.log('Socket connected');
            // Handshake
            const key = 'dGhlIHNhbXBsZSBub25jZQ==';
            const req = `GET ${parsed.path} HTTP/1.1\r\n` +
                `Host: ${parsed.host}\r\n` +
                `Upgrade: websocket\r\n` +
                `Connection: Upgrade\r\n` +
                `Sec-WebSocket-Key: ${key}\r\n` +
                `Sec-WebSocket-Version: 13\r\n\r\n`;
            socket.write(req);
        });

        let buffer = Buffer.alloc(0);
        let handshakeDone = false;

        socket.on('data', (chunk) => {
            buffer = Buffer.concat([buffer, chunk]);

            if (!handshakeDone) {
                const idx = buffer.indexOf('\r\n\r\n');
                if (idx !== -1) {
                    console.log('Handshake complete');
                    handshakeDone = true;
                    buffer = buffer.slice(idx + 4);

                    // Send commands
                    const cmds = [
                        { id: 1, method: 'DOM.enable' },
                        { id: 2, method: 'DOM.getDocument', params: { depth: -1, pierce: true } },
                        { id: 3, method: 'Page.captureScreenshot' }
                    ];

                    cmds.forEach(cmd => {
                        socket.write(encodeFrame(JSON.stringify(cmd)));
                    });
                }
            }

            if (handshakeDone) {
                // Try to decode frames
                // This is a stream, so we might have multiple frames or partial frames
                // For simplicity, let's just dump the raw text if it looks like JSON
                // Real decoding is hard without a proper parser state machine.
                // But we can try to find JSON patterns.

                // Actually, let's just save the raw buffer to a file and parse it offline/later?
                // No, I need to know when to stop.

                // Let's try to decode one frame at a time.
                while (true) {
                    const payload = decodeFrame(buffer);
                    if (!payload) break;

                    const msgStr = payload.toString();
                    try {
                        const msg = JSON.parse(msgStr);
                        if (msg.id === 2) {
                            fs.writeFileSync('dom_dump_net.json', JSON.stringify(msg.result.root, null, 2));
                            console.log('Saved DOM dump');
                        }
                        if (msg.id === 3) {
                            const imgBuf = Buffer.from(msg.result.data, 'base64');
                            fs.writeFileSync('app_state_net.png', imgBuf);
                            console.log('Saved Screenshot');
                            process.exit(0);
                        }
                    } catch (e) {
                        // Ignore parse errors (maybe partial JSON or control frames)
                    }

                    // Advance buffer (hacky, assumes we consumed exactly one frame)
                    // We need to know frame length to advance correctly.
                    // Re-calculate length
                    const len = buffer[1] & 0x7F;
                    let offset = 2;
                    let payloadLen = len;
                    if (len === 126) { payloadLen = buffer.readUInt16BE(2); offset = 4; }
                    else if (len === 127) { offset = 10; } // Ignore huge frames for now logic

                    buffer = buffer.slice(offset + payloadLen);
                }
            }
        });

    } catch (error) {
        console.error(error);
    }
}

run();
