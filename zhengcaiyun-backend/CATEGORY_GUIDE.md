# 政采云类目系统 - 完整使用指南

## 📊 数据概览

基于你的政采云账号权限，我们已成功提取并整理了 **132个真实类目**：

- ✅ **一级类目**：3个
- ✅ **二级类目**：35个
- ✅ **三级类目**：94个

### 可用的类目

1. **橡胶及塑料制品** (ID: 2136)
   - 6个二级类目
   - 58个三级类目

2. **文化用品** (ID: 4402)
   - 15个二级类目
   - 36个三级类目

3. **文化玩乐** (ID: 4410)
   - 14个二级类目

---

## 🗂️ 文件清单

### 数据库文件
```
zhengcaiyun-backend/database/
├── zcy_categories.sql                    # 表结构创建脚本
└── zcy_categories_full_insert.sql        # 完整数据导入SQL
```

### 前端文件
```
zhengcaiyun-backend/
├── components/CategorySelector.tsx       # React类目选择器组件
├── app/api/categories/route.ts           # Next.js API路由
├── app/example/category-selector/page.tsx # 示例页面
└── public/api/categories.json            # 前端JSON数据
```

---

## 🚀 快速开始

### 1. 导入数据库

```bash
# 进入数据库目录
cd zhengcaiyun-backend/database

# 导入表结构
mysql -u root -p your_database < zcy_categories.sql

# 导入完整数据
mysql -u root -p your_database < zcy_categories_full_insert.sql
```

### 2. 使用React组件

```tsx
import CategorySelector from '@/components/CategorySelector';

function MyPage() {
  const [category, setCategory] = useState(null);

  return (
    <CategorySelector
      onChange={(selected) => {
        console.log('选中:', selected);
        // selected 包含:
        // - categoryId: 类目ID
        // - categoryCode: 商品代码
        // - categoryName: 完整路径
        // - level1, level2, level3: 各级类目对象
        setCategory(selected);
      }}
    />
  );
}
```

### 3. 调用API

```javascript
// 获取所有类目（树形结构）
fetch('/api/categories')
  .then(res => res.json())
  .then(data => console.log(data));

// 获取一级类目
fetch('/api/categories?level=1')
  .then(res => res.json())
  .then(data => console.log(data));

// 获取指定父级的子类目
fetch('/api/categories?parentId=2136')
  .then(res => res.json())
  .then(data => console.log(data));

// 获取指定类目details
fetch('/api/categories?id=5225')
  .then(res => res.json())
  .then(data => console.log(data));
```

---

## 📝 数据结构说明

### 类目对象结构

```typescript
interface Category {
  id: number;                  // 政采云类目ID
  categoryCode: string;        // 商品代码（用于API提交）
  name: string;                // 类目名称
  level: number;               // 层级：1/2/3
  parentId: number | null;     // 父级ID
  hasChildren: boolean;        // 是否有子类
  hasSpu: boolean;             // 是否有SPU（影响发布流程）
  authed: boolean;             // 是否已授权
  children?: Category[];       // 子类目
}
```

### 选择器返回值

```typescript
{
  level1: Category,           // 一级类目对象
  level2: Category,           // 二级类目对象
  level3: Category,           // 三级类目对象（如果有）
  categoryId: string,         // 最终选中的类目ID
  categoryCode: string,       // 最终选中的商品代码
  categoryName: string        // 完整路径（面包屑）
}
```

---

## 🎨 自定义样式

CategorySelector组件使用内联样式，你可以通过以下方式自定义：

```tsx
<CategorySelector
  onChange={handleChange}
  // 自定义类名
  className="my-category-selector"
/>
```

然后在你的CSS中：

```css
.my-category-selector .category-select {
  border-color: #your-brand-color;
  /* 其他自定义样式 */
}
```

---

## 💡 使用场景

### 场景1：商品发布

```tsx
function ProductPublish() {
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    categoryId: '',
    categoryCode: ''
  });

  return (
    <form>
      <input 
        placeholder="商品名称"
        value={formData.name}
        onChange={(e) => setFormData({...formData, name: e.target.value})}
      />
      
      <CategorySelector
        onChange={(selected) => {
          setFormData({
            ...formData,
            categoryId: selected.categoryId,
            categoryCode: selected.categoryCode
          });
        }}
      />
      
      <button onClick={handleSubmit}>发布到政采云</button>
    </form>
  );
}
```

### 场景2：商品筛选

```tsx
function ProductFilter() {
  const [filter, setFilter] = useState({ categoryId: null });

  return (
    <div>
      <CategorySelector
        onChange={(selected) => {
          setFilter({ categoryId: selected.categoryId });
          // 触发商品列表重新加载
          loadProducts({ categoryId: selected.categoryId });
        }}
      />
    </div>
  );
}
```

---

## 🔧 常见问题

### Q: 如何获取更多类目？

A: 目前你的账号有3个一级类目的权限。要获取更多：
1. 向政采云申请更多类目授权
2. 使用Chrome扩展从政采云商品页抓取
3. 联系政采云客服开通新类目

### Q: categoryCode和categoryId有什么区别？

A: 
- `categoryId`: 政采云内部的类目唯一标识
- `categoryCode`: 用于API提交商品的商品代码，通常基于ID生成

### Q: hasSpu字段的作用？

A: 
- `hasSpu=true`: 该类目需要选择SPU（标准产品单元）
- 影响商品发布流程，需要额外的SPU选择步骤

### Q: 如何验证类目ID是否有效？

A: 访问示例页面 `/example/category-selector` 进行测试

---

## 📞 技术支持

如遇到问题：
1. 查看浏览器控制台错误
2. 检查API端点是否正确
3. 确认数据库已正确导入

---

## 🎉 完工！

你现在拥有：
- ✅ 132个真实可用的政采云类目
- ✅ 完整的React组件
- ✅ REST API接口
- ✅ 数据库表结构
- ✅ 示例代码

**立即访问** `/example/category-selector` 查看效果！
