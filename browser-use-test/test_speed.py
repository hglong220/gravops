"""
政采云表单填写速度测试
模拟真实场景，测量每一步的耗时
"""

import asyncio
import os
import time
import json
from dotenv import load_dotenv
from openai import OpenAI
from playwright.async_api import async_playwright

load_dotenv()

client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com/v1"
)

# 模拟商品数据
PRODUCT_DATA = {
    "title": "HP LaserJet Pro M1136 黑白激光打印机",
    "brand": "HP/惠普",
    "model": "M1136",
    "price": 1599,
    "marketPrice": 1899,
    "category": "办公设备/打印设备/激光打印机",
    "specs": {
        "打印速度": "22页/分钟",
        "打印分辨率": "600×600dpi",
        "纸张尺寸": "A4",
        "接口类型": "USB 2.0"
    }
}

# 模拟政采云表单字段
ZCY_FORM_FIELDS = """
表单字段列表：
1. 商品名称（必填）- 输入框
2. 品牌（必填）- 下拉选择
3. 型号（必填）- 输入框
4. 销售价（必填）- 数字输入
5. 市场价（选填）- 数字输入
6. 类目（必填）- 三级级联选择
7. 打印速度 - 输入框
8. 打印分辨率 - 输入框
9. 纸张尺寸 - 下拉选择
10. 接口类型 - 输入框
"""

def ai_match_fields(product_data: dict, form_fields: str) -> dict:
    """让 AI 匹配商品数据到表单字段"""
    
    start = time.time()
    
    prompt = f"""你是一个表单填写助手。

我有以下商品数据：
{json.dumps(product_data, ensure_ascii=False, indent=2)}

目标表单有以下字段：
{form_fields}

请为每个表单字段匹配对应的商品数据值。返回 JSON 格式：
{{
    "商品名称": "填入的值",
    "品牌": "填入的值",
    ...
}}
只返回 JSON，不要其他内容。
"""
    
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=500,
        temperature=0
    )
    
    elapsed = time.time() - start
    content = response.choices[0].message.content
    
    # 解析 JSON
    try:
        start_idx = content.find('{')
        end_idx = content.rfind('}') + 1
        result = json.loads(content[start_idx:end_idx])
    except:
        result = {"error": "解析失败"}
    
    return result, elapsed

def ai_analyze_required_fields(html_snippet: str) -> list:
    """让 AI 识别必填字段"""
    
    start = time.time()
    
    prompt = f"""分析以下表单 HTML，找出所有必填字段（带星号*或 required 属性的）。

HTML 片段：
{html_snippet[:2000]}

返回必填字段名称列表，JSON 格式：["字段1", "字段2", ...]
"""
    
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=200,
        temperature=0
    )
    
    elapsed = time.time() - start
    return response.choices[0].message.content, elapsed

async def simulate_form_filling():
    """模拟完整的表单填写流程"""
    
    print("=" * 60)
    print("政采云表单填写速度测试")
    print("=" * 60)
    print(f"\n商品: {PRODUCT_DATA['title']}")
    print("-" * 60)
    
    total_start = time.time()
    
    # 步骤1: AI 匹配字段
    print("\n[步骤1] AI 匹配商品数据到表单字段...")
    step1_start = time.time()
    mapping, ai_time = ai_match_fields(PRODUCT_DATA, ZCY_FORM_FIELDS)
    step1_time = time.time() - step1_start
    
    print(f"  → AI 响应耗时: {ai_time:.2f} 秒")
    print(f"  → 匹配结果: {json.dumps(mapping, ensure_ascii=False, indent=4)}")
    
    # 步骤2: 模拟填表（用 Playwright）
    print("\n[步骤2] 使用 Playwright 模拟填表...")
    step2_start = time.time()
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)  # 无头模式更快
        page = await browser.new_page()
        
        # 打开一个测试表单页面
        await page.goto("https://www.w3schools.com/html/tryit.asp?filename=tryhtml_form_submit")
        await asyncio.sleep(1)
        
        # 模拟填写多个字段
        frame = page.frame_locator("iframe#iframeResult")
        await frame.locator("input[name='fname']").fill(PRODUCT_DATA["brand"])
        await frame.locator("input[name='lname']").fill(PRODUCT_DATA["model"])
        
        await browser.close()
    
    step2_time = time.time() - step2_start
    print(f"  → 填表耗时: {step2_time:.2f} 秒")
    
    # 步骤3: 模拟验证
    print("\n[步骤3] 验证必填字段...")
    step3_start = time.time()
    
    # 假设我们检查 5 个必填项
    missing = []
    for field in ["商品名称", "品牌", "型号", "销售价", "类目"]:
        if field in mapping and mapping[field]:
            pass  # 已填写
        else:
            missing.append(field)
    
    step3_time = time.time() - step3_start
    print(f"  → 验证耗时: {step3_time:.2f} 秒")
    print(f"  → 缺失字段: {missing if missing else '无'}")
    
    # 总结
    total_time = time.time() - total_start
    
    print("\n" + "=" * 60)
    print("速度测试结果")
    print("=" * 60)
    print(f"  AI 字段匹配:  {ai_time:.2f} 秒")
    print(f"  Playwright填表: {step2_time:.2f} 秒")
    print(f"  字段验证:     {step3_time:.2f} 秒")
    print(f"  ─────────────────────────")
    print(f"  总耗时:       {total_time:.2f} 秒")
    print("=" * 60)
    
    # 对比传统方式
    print("\n📊 对比分析:")
    print(f"  • AI 方式: ~{total_time:.0f} 秒/商品")
    print(f"  • 传统代码填表: ~0.5 秒/商品")
    print(f"  • 人工填表: ~60-120 秒/商品")
    
    if total_time < 10:
        print("\n✅ AI 填表速度可接受，比人工快 6-12 倍！")
    else:
        print("\n⚠️ AI 填表较慢，但仍比人工快很多")

if __name__ == "__main__":
    asyncio.run(simulate_form_filling())
