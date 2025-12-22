"""
Browser-use + DeepSeek 测试脚本
"""

import asyncio
import os
from dotenv import load_dotenv
from openai import OpenAI

# 加载环境变量
load_dotenv()

async def test_with_browser_use():
    """使用 browser-use 测试"""
    from browser_use import Agent
    from langchain_openai import ChatOpenAI
    
    print("正在初始化...")
    
    api_key = os.getenv("DEEPSEEK_API_KEY")
    
    llm = ChatOpenAI(
        model="deepseek-chat",
        openai_api_key=api_key,
        openai_api_base="https://api.deepseek.com/v1",
        temperature=0,
    )
    
    agent = Agent(
        task="打开百度 https://www.baidu.com 并在搜索框输入'政采云'然后点击搜索按钮",
        llm=llm,
    )
    
    print("开始执行任务（请观察浏览器窗口）...")
    print("这可能需要1-2分钟...")
    
    result = await agent.run()
    print(f"\n任务完成！结果: {result}")

def test_deepseek_api():
    """先测试 DeepSeek API 是否正常"""
    print("测试 DeepSeek API 连接...")
    
    client = OpenAI(
        api_key=os.getenv("DEEPSEEK_API_KEY"),
        base_url="https://api.deepseek.com/v1"
    )
    
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "user", "content": "你好，请用一句话介绍自己"}
        ],
        max_tokens=100
    )
    
    print(f"DeepSeek 回复: {response.choices[0].message.content}")
    print("✓ API 连接正常！\n")
    return True

if __name__ == "__main__":
    print("=" * 50)
    print("Browser-use + DeepSeek 测试")
    print("=" * 50)
    
    # 先测试 API
    if test_deepseek_api():
        print("现在测试浏览器自动化...")
        asyncio.run(test_with_browser_use())
