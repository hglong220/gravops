# Browser-use 测试项目

这是一个独立的测试项目，用于验证 Browser-use + DeepSeek 是否能满足政采云自动填表的需求。

## 安装步骤

```bash
# 1. 进入目录
cd browser-use-test

# 2. 创建虚拟环境（推荐）
python -m venv venv
.\venv\Scripts\activate  # Windows

# 3. 安装依赖
pip install -r requirements.txt

# 4. 安装浏览器
playwright install chromium

# 5. 配置 API Key
copy .env.example .env
# 然后编辑 .env 文件，填入你的 DeepSeek API Key
```

## 运行测试

```bash
python test_browser_use.py
```

## 预期效果

1. 程序会自动打开一个 Chrome 浏览器
2. AI 会自动操作浏览器（打开网页、输入、点击）
3. 你可以观察 AI 的操作过程
4. 完成后会输出结果

## 注意事项

- 这个测试不会影响现有的插件功能
- DeepSeek API Key 可以在 https://platform.deepseek.com/ 获取
- 测试会消耗少量 API 额度（约 ￥0.01-0.05）
