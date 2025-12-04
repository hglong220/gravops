const fs = require('fs');
const axios = require('axios');
const ck = JSON.parse(fs.readFileSync('G:\\gravops\\zcy-publisher\\cookies\\zcy-cookies.json', 'utf8'))
    .map(c => `${c.name}=${c.value}`).join('; ');
(async () => {
    const ts = Date.now();
    const url = `https://www.zcygov.cn/front/detail/item/2624573065929730?timestamp=${ts}&zjxwcFlag=true`;
    const res = await axios.get(url, {
        headers: {
            Cookie: ck,
            Referer: 'https://www.zcygov.cn/',
            Origin: 'https://www.zcygov.cn',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9'
        }
    });
    console.log('status', res.status, typeof res.data);
    console.log((typeof res.data === 'string'
        ? res.data.slice(0, 400)
        : JSON.stringify(res.data).slice(0, 400)));
})();
