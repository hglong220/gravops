import React, { useState, useEffect } from 'react';
import type { FC } from 'react';

/**
 * 政采云类目选择器组件
 * 支持三级联动选择
 * 基于真实的132个政采云类目
 */

interface Category {
    id: number | string;
    categoryCode: string;
    name: string;
    level: number;
    parentId?: number | string | null;
    hasChildren?: boolean;
    hasSpu?: boolean;
    authed?: boolean;
    children?: Category[];
}

interface CategorySelectorProps {
    value?: {
        level1?: string;
        level2?: string;
        level3?: string;
    };
    onChange?: (selected: {
        level1?: Category;
        level2?: Category;
        level3?: Category;
        categoryId: string;
        categoryCode: string;
        categoryName: string;
    }) => void;
    disabled?: boolean;
    onlyAuthorized?: boolean; // 新增：是否只显示用户授权的类目
    userId?: string; // 新增：用户ID
}

const CategorySelector: FC<CategorySelectorProps> = ({
    value,
    onChange,
    disabled = false,
    onlyAuthorized = false,
    userId
}) => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [level1List, setLevel1List] = useState<Category[]>([]);
    const [level2List, setLevel2List] = useState<Category[]>([]);
    const [level3List, setLevel3List] = useState<Category[]>([]);
    const [loading, setLoading] = useState(false);
    const [needFetch, setNeedFetch] = useState(false);

    const [selected1, setSelected1] = useState<string>('');
    const [selected2, setSelected2] = useState<string>('');
    const [selected3, setSelected3] = useState<string>('');

    // 加载类目数据
    useEffect(() => {
        loadCategories();
    }, [onlyAuthorized, userId]);

    const loadCategories = async () => {
        setLoading(true);

        try {
            if (onlyAuthorized && userId) {
                // 加载用户授权类目
                const res = await fetch('/api/user/categories', {
                    headers: {
                        'x-user-id': userId
                    }
                });

                const data = await res.json();

                if (data.success) {
                    // 构建树形结构
                    const tree = buildCategoryTree(data.categories);
                    setCategories(tree);
                    setLevel1List(tree);
                    setNeedFetch(false);
                } else if (data.needFetch) {
                    // 需要先抓取授权类目
                    setNeedFetch(true);
                }
            } else {
                // 加载完整类目
                const res = await fetch('/api/categories.json');
                const data = await res.json();
                setCategories(data.categories || data.tree || []);
                setLevel1List(data.categories || data.tree || []);
            }
        } catch (err) {
            console.error('加载类目失败:', err);
        } finally {
            setLoading(false);
        }
    };

    // 构建树形结构（从扁平数据）
    const buildCategoryTree = (flatCategories: Category[]): Category[] => {
        const level1 = flatCategories.filter(c => c.level === 1);

        level1.forEach(cat1 => {
            cat1.children = flatCategories.filter(c => c.level === 2 && c.parentId === cat1.id);

            cat1.children?.forEach(cat2 => {
                cat2.children = flatCategories.filter(c => c.level === 3 && c.parentId === cat2.id);
            });
        });

        return level1;
    };

    // 抓取用户授权类目
    const fetchUserCategories = async () => {
        if (!userId) return;

        setLoading(true);

        try {
            const res = await fetch('/api/user/fetch-categories', {
                method: 'POST',
                headers: {
                    'x-user-id': userId
                }
            });

            const data = await res.json();

            if (data.success) {
                // 重新加载
                await loadCategories();
            } else {
                alert('抓取授权类目失败: ' + data.message);
            }
        } catch (err) {
            console.error('抓取授权类目失败:', err);
            alert('抓取授权类目失败');
        } finally {
            setLoading(false);
        }
    };

    // 初始化选中值
    useEffect(() => {
        if (value) {
            setSelected1(value.level1 || '');
            setSelected2(value.level2 || '');
            setSelected3(value.level3 || '');
        }
    }, [value]);

    // 一级选择变化
    const handleLevel1Change = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setSelected1(id);
        setSelected2('');
        setSelected3('');

        if (id) {
            const cat1 = level1List.find(c => c.id.toString() === id);
            setLevel2List(cat1?.children || []);
            setLevel3List([]);

            if (onChange && cat1) {
                onChange({
                    level1: cat1,
                    categoryId: cat1.id.toString(),
                    categoryCode: cat1.categoryCode,
                    categoryName: cat1.name
                });
            }
        } else {
            setLevel2List([]);
            setLevel3List([]);
        }
    };

    // 二级选择变化
    const handleLevel2Change = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setSelected2(id);
        setSelected3('');

        if (id) {
            const cat2 = level2List.find(c => c.id.toString() === id);
            setLevel3List(cat2?.children || []);

            if (onChange && cat2) {
                const cat1 = level1List.find(c => c.id.toString() === selected1);
                onChange({
                    level1: cat1,
                    level2: cat2,
                    categoryId: cat2.id.toString(),
                    categoryCode: cat2.categoryCode,
                    categoryName: `${cat1?.name} > ${cat2.name}`
                });
            }
        } else {
            setLevel3List([]);
        }
    };

    // 三级选择变化
    const handleLevel3Change = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setSelected3(id);

        if (id && onChange) {
            const cat1 = level1List.find(c => c.id.toString() === selected1);
            const cat2 = level2List.find(c => c.id.toString() === selected2);
            const cat3 = level3List.find(c => c.id.toString() === id);

            if (cat3) {
                onChange({
                    level1: cat1,
                    level2: cat2,
                    level3: cat3,
                    categoryId: cat3.id.toString(),
                    categoryCode: cat3.categoryCode,
                    categoryName: `${cat1?.name} > ${cat2?.name} > ${cat3.name}`
                });
            }
        }
    };

    return (
        <div className="category-selector">
            {loading && (
                <div className="loading-indicator">
                    <div className="spinner"></div>
                    <span>加载类目中...</span>
                </div>
            )}

            {needFetch && (
                <div className="fetch-prompt">
                    <div className="prompt-icon">⚠️</div>
                    <div className="prompt-content">
                        <h4>需要抓取授权类目</h4>
                        <p>首次使用需要从政采云抓取您有权限的类目，这样可以避免选择无权限类目导致上传失败。</p>
                        <button onClick={fetchUserCategories} className="fetch-button">
                            立即抓取我的授权类目
                        </button>
                    </div>
                </div>
            )}

            {onlyAuthorized && !needFetch && level1List.length > 0 && (
                <div className="info-banner">
                    <span className="info-icon">ℹ️</span>
                    <span>当前显示您有权限的 {level1List.length} 个类目</span>
                </div>
            )}

            <div className="category-level">
                <label>一级类目</label>
                <select
                    value={selected1}
                    onChange={handleLevel1Change}
                    disabled={disabled}
                    className="category-select"
                >
                    <option value="">请选择</option>
                    {level1List.map(cat => (
                        <option key={cat.id} value={cat.id}>
                            {cat.name}
                        </option>
                    ))}
                </select>
            </div>

            {selected1 && level2List.length > 0 && (
                <div className="category-level">
                    <label>二级类目</label>
                    <select
                        value={selected2}
                        onChange={handleLevel2Change}
                        disabled={disabled}
                        className="category-select"
                    >
                        <option value="">请选择</option>
                        {level2List.map(cat => (
                            <option key={cat.id} value={cat.id}>
                                {cat.name}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {selected2 && level3List.length > 0 && (
                <div className="category-level">
                    <label>三级类目</label>
                    <select
                        value={selected3}
                        onChange={handleLevel3Change}
                        disabled={disabled}
                        className="category-select"
                    >
                        <option value="">请选择</option>
                        {level3List.map(cat => (
                            <option key={cat.id} value={cat.id}>
                                {cat.name}
                                {cat.hasSpu && <span className="tag-spu">有SPU</span>}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            <style jsx>{`
        .category-selector {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        .loading-indicator {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: #f3f4f6;
          border-radius: 8px;
          color: #6b7280;
          font-size: 14px;
        }
        
        .spinner {
          width: 20px;
          height: 20px;
          border: 3px solid #e5e7eb;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .fetch-prompt {
          display: flex;
          gap: 16px;
          padding: 20px;
          background: #fff7ed;
          border: 1px solid #fdba74;
          border-radius: 8px;
        }
        
        .prompt-icon {
          font-size: 32px;
          flex-shrink: 0;
        }
        
        .prompt-content h4 {
          margin: 0 0 8px 0;
          font-size: 16px;
          font-weight: 600;
          color: #92400e;
        }
        
        .prompt-content p {
          margin: 0 0 16px 0;
          font-size: 14px;
          color: #78350f;
          line-height: 1.5;
        }
        
        .fetch-button {
          padding: 10px 20px;
          background: #f59e0b;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .fetch-button:hover {
          background: #d97706;
          transform: translateY(-1px);
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .info-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 6px;
          font-size: 14px;
          color: #1e40af;
        }
        
        .info-icon {
          font-size: 18px;
        }

        .category-level {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .category-level label {
          font-size: 14px;
          font-weight: 500;
          color: #374151;
        }

        .category-select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          color: #1f2937;
          background: white;
          transition: all 0.2s;
        }

        .category-select:hover:not(:disabled) {
          border-color: #3b82f6;
        }

        .category-select:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .category-select:disabled {
          background: #f3f4f6;
          cursor: not-allowed;
        }

        .tag-spu {
          margin-left: 8px;
          padding: 2px 6px;
          background: #10b981;
          color: white;
          font-size: 11px;
          border-radius: 3px;
        }
      `}</style>
        </div>
    );
};

export default CategorySelector;
