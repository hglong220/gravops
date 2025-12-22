/**
 * 智能填表测试脚本
 * 在浏览器控制台运行，测试方案一和方案二
 */

// 测试商品数据
const testProduct = {
    title: "HP LaserJet Pro M1136 黑白激光打印机",
    brand: "HP/惠普",
    model: "M1136",
    price: 1599,
    marketPrice: 1899,
    stock: 99,
    category: "办公设备/打印设备/激光打印机",
    specs: {
        "打印速度": "22页/分钟",
        "打印分辨率": "600×600dpi",
        "纸张尺寸": "A4",
        "接口类型": "USB 2.0",
        "硒鼓型号": "CC388A"
    }
};

// 提取表单字段
function extractFields() {
    const results = [];
    const inputs = document.querySelectorAll('input, select, textarea');

    inputs.forEach((el, index) => {
        const input = el;
        let label = '';

        if (input.id) {
            const labelEl = document.querySelector(`label[for="${input.id}"]`);
            if (labelEl) label = labelEl.textContent?.trim() || '';
        }

        if (!label) {
            let parent = input.parentElement;
            for (let i = 0; i < 5 && parent; i++) {
                const labelEl = parent.querySelector('label, .label, .ant-form-item-label, [class*="label"]');
                if (labelEl) {
                    label = labelEl.textContent?.trim() || '';
                    break;
                }
                parent = parent.parentElement;
            }
        }

        if (!label && input.placeholder) label = input.placeholder;
        if (!label && input.name) label = input.name;

        let selector = '';
        if (input.id) selector = '#' + input.id;
        else if (input.name) selector = `${input.tagName.toLowerCase()}[name="${input.name}"]`;

        let required = input.required;
        if (!required) {
            let parent = input.parentElement;
            for (let i = 0; i < 5 && parent; i++) {
                if (parent.querySelector('.ant-form-item-required, [class*="required"]') ||
                    parent.textContent?.includes('*')) {
                    required = true;
                    break;
                }
                parent = parent.parentElement;
            }
        }

        if ((label || input.name) && selector) {
            results.push({
                label: label.replace(/[*：:]/g, '').trim(),
                selector,
                type: input.tagName.toLowerCase(),
                inputType: input.type || '',
                name: input.name || '',
                required
            });
        }
    });

    return results;
}

// 测试方案二：提取字段并发送给 AI
async function testPlan2() {
    console.log('=== 测试方案二：AI 学习 ===');

    const fields = extractFields();
    console.log(`找到 ${fields.length} 个表单字段:`);
    fields.slice(0, 15).forEach((f, i) => {
        console.log(`  ${i + 1}. ${f.label} ${f.required ? '*' : ''} → ${f.selector}`);
    });

    // 调用后端 AI 分析
    console.log('\n调用 AI 分析...');
    try {
        const response = await fetch('http://localhost:3000/api/ai-form-analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields, productData: testProduct })
        });
        const data = await response.json();

        console.log('AI 分析结果:');
        if (data.mapping) {
            data.mapping.slice(0, 10).forEach(m => {
                console.log(`  ${m.label} → ${m.dataKey || '(未匹配)'}`);
            });
        }

        return data;
    } catch (error) {
        console.error('AI 分析失败:', error);
    }
}

// 测试填写
async function testFill() {
    console.log('=== 测试智能填表 ===');

    const fields = extractFields();
    console.log(`提取到 ${fields.length} 个字段`);

    // 简单的规则匹配
    const rules = {
        '商品名称': testProduct.title,
        '货物名称': testProduct.title,
        '品牌': testProduct.brand,
        '型号': testProduct.model,
        '规格型号': testProduct.model,
        '单价': testProduct.price,
        '销售价': testProduct.price,
        '市场价': testProduct.marketPrice,
        '库存': testProduct.stock,
    };

    let filled = 0;
    for (const field of fields) {
        for (const [keyword, value] of Object.entries(rules)) {
            if (field.label.includes(keyword)) {
                const el = document.querySelector(field.selector);
                if (el) {
                    el.value = String(value);
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log(`✓ ${field.label}: ${value}`);
                    filled++;
                }
                break;
            }
        }
    }

    console.log(`\n填写完成: ${filled} 个字段`);
}

// 运行测试
console.log('智能填表测试脚本已加载');
console.log('可用命令:');
console.log('  extractFields()  - 提取表单字段');
console.log('  testPlan2()      - 测试 AI 分析');
console.log('  testFill()       - 测试填表');
