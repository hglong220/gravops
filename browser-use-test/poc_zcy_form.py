"""
政采云表单提取 POC v3 - 反检测版本
"""

import asyncio
import os
import json
from dotenv import load_dotenv
from openai import OpenAI
from playwright.async_api import async_playwright

load_dotenv()

client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com/v1"
)

async def extract_form_fields(page):
    """提取表单字段"""
    fields = await page.evaluate('''() => {
        const results = [];
        const inputs = document.querySelectorAll('input, select, textarea');
        
        inputs.forEach((el, index) => {
            let label = '';
            
            if (el.id) {
                const labelEl = document.querySelector(`label[for="${el.id}"]`);
                if (labelEl) label = labelEl.textContent.trim();
            }
            
            if (!label) {
                let parent = el.parentElement;
                for (let i = 0; i < 5 && parent; i++) {
                    const labelEl = parent.querySelector('label, .label, .ant-form-item-label');
                    if (labelEl) {
                        label = labelEl.textContent.trim();
                        break;
                    }
                    parent = parent.parentElement;
                }
            }
            
            if (!label && el.placeholder) label = el.placeholder;
            if (!label && el.name) label = el.name;
            
            let required = el.required;
            if (!required) {
                let parent = el.parentElement;
                for (let i = 0; i < 5 && parent; i++) {
                    if (parent.querySelector('.ant-form-item-required') || 
                        parent.textContent.includes('*')) {
                        required = true;
                        break;
                    }
                    parent = parent.parentElement;
                }
            }
            
            let selector = '';
            if (el.id) selector = '#' + el.id;
            else if (el.name) selector = `${el.tagName.toLowerCase()}[name="${el.name}"]`;
            
            if ((label || el.name) && selector) {
                results.push({
                    label: label.replace(/[*：:]/g, '').trim(),
                    selector: selector,
                    type: el.tagName.toLowerCase(),
                    name: el.name || '',
                    id: el.id || '',
                    required: required
                });
            }
        });
        
        return results;
    }''')
    return fields

async def run_poc():
    print("=" * 60)
    print("政采云表单提取 POC v3 - 反检测版")
    print("=" * 60)
    
    async with async_playwright() as p:
        # 使用更真实的浏览器配置
        browser = await p.chromium.launch(
            headless=False,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--no-sandbox',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process'
            ]
        )
        
        context = await browser.new_context(
            viewport={'width': 1400, 'height': 900},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        
        # 注入反检测脚本
        await context.add_init_script('''
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = { runtime: {} };
        ''')
        
        page = await context.new_page()
        
        # 打开政采云主页（不是登录页）
        print("\n1. 打开政采云主页...")
        await page.goto("https://www.zcygov.cn/")
        
        print("\n" + "=" * 60)
        print("请操作：")
        print("  1. 点击登录，手动登录")
        print("  2. 进入【商品发布】页面")
        print("  3. 选好类目，到填写基本信息的页面")
        print("  4. 完成后在此处按回车...")
        print("=" * 60)
        
        input("\n按回车继续分析...")
        
        await asyncio.sleep(1)
        
        print("\n2. 分析表单...")
        url = page.url
        print(f"   当前: {url}")
        
        fields = await extract_form_fields(page)
        
        print(f"\n   找到 {len(fields)} 个字段:")
        for i, f in enumerate(fields[:20]):
            mark = " *必填" if f['required'] else ""
            print(f"   {i+1}. {f['label']}{mark} → {f['selector']}")
        
        # 保存
        with open("zcy_fields.json", "w", encoding="utf-8") as file:
            json.dump({"url": url, "fields": fields}, file, ensure_ascii=False, indent=2)
        print(f"\n   ✓ 保存到 zcy_fields.json")
        
        # AI 分析
        print("\n3. AI 分析映射...")
        field_str = "\n".join([f"{f['label']}: {f['selector']}" for f in fields[:15]])
        
        resp = client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "user", "content": f"这是政采云表单字段，请给每个字段匹配商品数据(title/brand/model/price等):\n{field_str}"}],
            max_tokens=400
        )
        print(f"\n{resp.choices[0].message.content}")
        
        print("\n按回车关闭...")
        input()
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_poc())
