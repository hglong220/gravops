"""
Playwright + DeepSeek 测试脚本 v3
使用 Bing 测试（更简单）
"""

import asyncio
import os
from dotenv import load_dotenv
from openai import OpenAI
from playwright.async_api import async_playwright

load_dotenv()

client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com/v1"
)

async def run_bing_search():
    """使用 Bing 搜索测试"""
    
    print("启动浏览器...")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        # 1. 直接用 Bing 搜索 URL
        print("打开 Bing 搜索政采云...")
        await page.goto("https://www.bing.com/search?q=政采云")
        await page.wait_for_load_state("networkidle")
        print("✓ 搜索完成！")
        
        # 2. 用 AI 分析搜索结果
        print("\n让 AI 分析搜索结果...")
        
        # 获取搜索结果
        results = await page.locator("li.b_algo h2").all_text_contents()
        
        if results:
            response = client.chat.completions.create(
                model="deepseek-chat",
                messages=[{
                    "role": "user", 
                    "content": f"这是搜索'政采云'的结果:\n{results[:5]}\n\n请简要总结政采云是什么平台。"
                }],
                max_tokens=200
            )
            print(f"\nAI 总结: {response.choices[0].message.content}")
        else:
            print("未获取到搜索结果")
        
        # 保持浏览器打开
        print("\n浏览器保持打开 5 秒...")
        await asyncio.sleep(5)
        
        await browser.close()
        print("✓ 测试完成！")

async def test_form_filling():
    """测试表单填写能力 - 使用 httpbin 测试表单"""
    
    print("\n" + "=" * 50)
    print("测试表单填写能力")
    print("=" * 50)
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        # 打开一个简单的测试表单
        print("打开测试表单页面...")
        await page.goto("https://www.w3schools.com/html/tryit.asp?filename=tryhtml_form_submit")
        await asyncio.sleep(2)
        
        # 切换到 iframe
        frame = page.frame_locator("iframe#iframeResult")
        
        # 填写表单
        print("填写表单...")
        await frame.locator("input[name='fname']").fill("张三")
        await frame.locator("input[name='lname']").fill("测试")
        
        print("✓ 表单填写完成！")
        
        # 让 AI 检查
        print("\n让 AI 确认填写结果...")
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[{
                "role": "user", 
                "content": "我刚才在一个表单中填写了 fname='张三', lname='测试'。这个测试说明了什么能力？"
            }],
            max_tokens=100
        )
        print(f"AI: {response.choices[0].message.content}")
        
        await asyncio.sleep(3)
        await browser.close()

def test_api():
    print("测试 DeepSeek API...")
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[{"role": "user", "content": "你好"}],
        max_tokens=50
    )
    print(f"DeepSeek: {response.choices[0].message.content}\n")

if __name__ == "__main__":
    print("=" * 50)
    print("Playwright + DeepSeek 测试 v3")
    print("=" * 50 + "\n")
    
    test_api()
    asyncio.run(run_bing_search())
    asyncio.run(test_form_filling())
