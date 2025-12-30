async function checkAI() {
    console.log("--- 正在发起 AI 连通性测试 ---");
    try {
        const response = await fetch("http://localhost:3000/api/autofill/semantic-resolve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                field: { label: "测试字段-请回复'已连接'", signature: "test-123" },
                productData: { title: "测试商品", specs: {} }
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log("✅ 测试成功！AI 已成功返回数据：");
            console.log(JSON.stringify(data, null, 2));
        } else {
            console.error("❌ 测试失败，后端返回了错误码:", response.status);
            const text = await response.text();
            console.error("错误详情:", text);
        }
    } catch (e) {
        console.error("❌ 无法连接到后端服务器，请确保 'npm run dev' 正在运行。");
        console.error(e.message);
    }
}

checkAI();
