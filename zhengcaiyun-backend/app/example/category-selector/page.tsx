'use client';

import { useState } from 'react';
import CategorySelector from '@/components/CategorySelector';

/**
 * 政采云类目选择器使用示例
 */
export default function CategoryExample() {
    const [selectedCategory, setSelectedCategory] = useState<any>(null);

    return (
        <div className="container">
            <div className="card">
                <h1>政采云类目选择器</h1>
                <p className="subtitle">
                    基于真实的132个政采云类目（3个一级 + 35个二级 + 94个三级）
                </p>

                <div className="selector-wrapper">
                    <CategorySelector
                        value={{
                            level1: selectedCategory?.level1?.id?.toString(),
                            level2: selectedCategory?.level2?.id?.toString(),
                            level3: selectedCategory?.level3?.id?.toString(),
                        }}
                        onChange={(selected) => {
                            setSelectedCategory(selected);
                            console.log('选中类目:', selected);
                        }}
                    />
                </div>

                {selectedCategory && (
                    <div className="result-card">
                        <h3>选中的类目</h3>
                        <div className="result-item">
                            <span className="label">类目ID：</span>
                            <span className="value">{selectedCategory.categoryId}</span>
                        </div>
                        <div className="result-item">
                            <span className="label">商品代码：</span>
                            <span className="value code">{selectedCategory.categoryCode}</span>
                        </div>
                        <div className="result-item">
                            <span className="label">完整路径：</span>
                            <span className="value">{selectedCategory.categoryName}</span>
                        </div>

                        <div className="json-preview">
                            <h4>完整数据（JSON）</h4>
                            <pre>{JSON.stringify(selectedCategory, null, 2)}</pre>
                        </div>
                    </div>
                )}
            </div>

            <div className="info-card">
                <h3>📊 类目统计</h3>
                <div className="stats">
                    <div className="stat-item">
                        <div className="stat-number">132</div>
                        <div className="stat-label">总类目数</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-number">3</div>
                        <div className="stat-label">一级类目</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-number">35</div>
                        <div className="stat-label">二级类目</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-number">94</div>
                        <div className="stat-label">三级类目</div>
                    </div>
                </div>

                <div className="available-categories">
                    <h4>✅ 可用的一级类目</h4>
                    <ul>
                        <li>橡胶及塑料制品（6个二级，58个三级）</li>
                        <li>文化用品（15个二级，36个三级）</li>
                        <li>文化玩乐（14个二级）</li>
                    </ul>
                </div>
            </div>

            <style jsx>{`
        .container {
          max-width: 900px;
          margin: 0 auto;
          padding: 40px 20px;
        }

        .card {
          background: white;
          border-radius: 12px;
          padding: 32px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          margin-bottom: 24px;
        }

        h1 {
          margin: 0 0 8px 0;
          font-size: 28px;
          font-weight: 700;
          color: #111827;
        }

        .subtitle {
          margin: 0 0 32px 0;
          color: #6b7280;
          font-size: 14px;
        }

        .selector-wrapper {
          margin-bottom: 24px;
        }

        .result-card {
          margin-top: 32px;
          padding: 24px;
          background: #f9fafb;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }

        .result-card h3 {
          margin: 0 0 16px 0;
          font-size: 18px;
          font-weight: 600;
          color: #111827;
        }

        .result-item {
          display: flex;
          margin-bottom: 12px;
          font-size: 14px;
        }

        .label {
          font-weight: 500;
          color: #6b7280;
          min-width: 100px;
        }

        .value {
          color: #111827;
        }

        .value.code {
          font-family: 'Monaco', monospace;
          background: #fffbeb;
          padding: 2px 8px;
          border-radius: 4px;
          color: #d97706;
        }

        .json-preview {
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid #e5e7eb;
        }

        .json-preview h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 600;
          color: #374151;
        }

        .json-preview pre {
          background: #1f2937;
          color: #10b981;
          padding: 16px;
          border-radius: 6px;
          overflow-x: auto;
          font-size: 12px;
          font-family: 'Monaco', monospace;
        }

        .info-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 12px;
          padding: 32px;
          color: white;
        }

        .info-card h3 {
          margin: 0 0 24px 0;
          font-size: 22px;
          font-weight: 700;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 32px;
        }

        .stat-item {
          text-align: center;
        }

        .stat-number {
          font-size: 36px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .stat-label {
          font-size: 14px;
          opacity: 0.9;
        }

        .available-categories {
          background: rgba(255, 255, 255, 0.1);
          padding: 20px;
          border-radius: 8px;
        }

        .available-categories h4 {
          margin: 0 0 12px 0;
          font-size: 16px;
          font-weight: 600;
        }

        .available-categories ul {
          margin: 0;
          padding-left: 20px;
        }

        .available-categories li {
          margin-bottom: 8px;
          font-size: 14px;
          opacity: 0.95;
        }
      `}</style>
        </div>
    );
}
