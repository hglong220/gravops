const testData = {
    licenseKey: "test-key",
    productTitle: "得力A4复印纸"
};

fetch('http://localhost:3000/api/category-match', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(testData)
})
    .then(res => res.json())
    .then(data => {
        console.log('✓ 接口测试成功:');
        console.log(JSON.stringify(data, null, 2));
    })
    .catch(err => {
        console.log('✗ 接口测试失败:', err.message);
    });
