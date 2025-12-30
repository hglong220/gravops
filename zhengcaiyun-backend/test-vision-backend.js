
const axios = require('axios');

async function testVision() {
    const url = 'http://localhost:3000/api/vision/agent';
    const screenshot = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='; // 1x1 white pixel
    const task = '找到页面中心并点击';

    try {
        console.log('Sending request to Vision Agent API...');
        const response = await axios.post(url, {
            screenshot,
            task,
            context: '测试运行'
        });
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

testVision();
