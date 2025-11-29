// 政采云公司名称提取模块
export async function getCompanyNameFromZCY(): Promise<string | null> {
  try {
    // 方法1: 从DOM提取
    const selectors = [
      '.company-name',
      '.corp-name',
      '[class*="company"]',
      '[class*="corp"]'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element?.textContent) {
        const companyName = element.textContent.trim();
        if (companyName.length > 0) {
          console.log('[ZCY] 从DOM提取公司名称:', companyName);
          return companyName;
        }
      }
    }
    
    // 方法2: 从LocalStorage提取
    const keys = ['userInfo', 'companyInfo', 'user'];
    for (const key of keys) {
      const data = localStorage.getItem(key);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          const companyName = parsed.companyName || parsed.company || parsed.corpName;
          if (companyName) {
            console.log('[ZCY] 从LocalStorage提取公司名称:', companyName);
            return companyName;
          }
        } catch (e) {
          // 跳过解析错误
        }
      }
    }
    
    // 方法3: 从SessionStorage提取
    for (const key of keys) {
      const data = sessionStorage.getItem(key);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          const companyName = parsed.companyName || parsed.company || parsed.corpName;
          if (companyName) {
            console.log('[ZCY] 从SessionStorage提取公司名称:', companyName);
            return companyName;
          }
        } catch (e) {
          // 跳过解析错误
        }
      }
    }
    
    console.warn('[ZCY] 未能提取公司名称');
    return null;
  } catch (error) {
    console.error('[ZCY] 提取公司名称失败:', error);
    return null;
  }
}

// 检测是否在政采云页面
export function isZCYPage(): boolean {
  return window.location.hostname.includes('zcygov.cn');
}
