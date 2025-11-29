
import * as fs from 'fs';
import * as path from 'path';

// Manually load .env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
    });
    console.log('Loaded env vars from:', envPath);
    console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? (process.env.OPENAI_API_KEY.substring(0, 10) + '...') : 'UNDEFINED');
} else {
    console.error('❌ .env file not found at:', envPath);
}

async function testCaptchaService() {
    const { solveImageCaptcha, solveSlideCaptcha, solveClickCaptcha } = await import('../lib/captcha-service');

    console.log('🧩 Testing Captcha Service...');
    console.log('--------------------------------');

    // 1. Test Image Captcha (Mock/AI)
    console.log('\n[Test 1] Image Captcha');
    // A simple base64 image (1x1 pixel) just to trigger the function
    const mockImageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

    try {
        const result = await solveImageCaptcha(mockImageBase64);
        console.log('Result:', result);
    } catch (error) {
        console.error('Error:', error);
    }

    // 2. Test Slide Captcha
    console.log('\n[Test 2] Slide Captcha');
    try {
        const result = await solveSlideCaptcha({
            backgroundImage: mockImageBase64,
            sliderImage: mockImageBase64
        });
        console.log('Result:', result);
    } catch (error) {
        console.error('Error:', error);
    }

    // 3. Test Click Captcha
    console.log('\n[Test 3] Click Captcha');
    try {
        const result = await solveClickCaptcha({
            imageBase64: mockImageBase64,
            instruction: "Click the red car"
        });
        console.log('Result:', result);
    } catch (error) {
        console.error('Error:', error);
    }
}

testCaptchaService();
