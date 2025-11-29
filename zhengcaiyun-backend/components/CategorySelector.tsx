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
}

const CategorySelector: FC<CategorySelectorProps> = ({ value, onChange, disabled = false }) => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [level1List, setLevel1List] = useState<Category[]>([]);
    const [level2List, setLevel2List] = useState<Category[]>([]);
    const [level3List, setLevel3List] = useState<Category[]>([]);

    const [selected1, setSelected1] = useState<string>('');
    const [selected2, setSelected2] = useState<string>('');
    const [selected3, setSelected3] = useState<string>('');

    // 加载类目数据
    useEffect(() => {
        fetch('/api/categories.json')
            .then(res => res.json())
            .then(data => {
                setCategories(data.tree || []);
                setLevel1List(data.tree || []);
            })
            .catch(err => console.error('加载类目失败:', err));
    }, []);

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
