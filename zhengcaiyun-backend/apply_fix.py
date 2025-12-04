import re

# 读取文件
with open(r'g:\gravops\zhengcaiyun-backend\app\dashboard\tasks\page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 定义要替换的旧代码（精确匹配）
old_code = """    const handlePublish = (draftId: string) => {
        window.open(`https://www.zcygov.cn/publish?draft_id=${draftId}`, '_blank');
    };"""

# 定义新代码
new_code = """    const handlePublish = async (draftId: string) => {
        const product = products.find(p => p.id === draftId);
        if (!product) {
            alert('商品信息未找到');
            return;
        }

        try {
            const skuData = product.skuData ? JSON.parse(product.skuData) : {};
            const images = (product as any).images ? JSON.parse((product as any).images) : [];
            const attributes = (product as any).attributes ? JSON.parse((product as any).attributes) : {};

            const productData = {
                title: product.title,
                images,
                attributes,
                detailHtml: product.detailHtml ?? '',
                itemCode: skuData.itemCode || '',
                batchMarketPrice: skuData.price || '',
                batchSalePrice: skuData.salePrice || skuData.price || '',
                batchStockQuantity: skuData.stock || '100'
            };

            window.postMessage({ type: 'TRIGGER_ZCY_PUBLISH', data: productData }, '*');
            alert(`已发起自动发布！\\n商品：${product.title}\\n图片数：${images.length}`);
        } catch (error) {
            alert('发布失败: ' + (error as Error).message);
        }
    };"""

# 检查旧代码是否存在
if old_code in content:
    # 替换
    new_content = content.replace(old_code, new_code)
    
    # 写回文件
    with open(r'g:\gravops\zhengcaiyun-backend\app\dashboard\tasks\page.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print("✅ 成功替换 handlePublish 函数")
else:
    print("❌ 未找到要替换的代码，请检查文件是否已被修改")
