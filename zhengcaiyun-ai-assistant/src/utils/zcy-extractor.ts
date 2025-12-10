// 政采云公司名称提取模块
export async function getCompanyNameFromZCY(): Promise<string | null> {
  try {
    // 方法1: 从DOM提取 - 扩展选择器列表
    const selectors = [
      // 政采云右上角用户区域的选择器
      '.user-info .company-name',
      '.user-center .company-name',
      '.header-user .company',
      '.header-right .company',
      '.top-nav .company',
      '.navbar .company',
      // 下拉菜单中的公司名
      '.dropdown-menu .company',
      '.user-dropdown .company',
      '.ant-dropdown .company',
      // 通用选择器
      '.company-name',
      '.corp-name',
      '.enterprise-name',
      '[class*="company-name"]',
      '[class*="companyName"]',
      '[class*="corp-name"]',
      '[class*="corpName"]',
      '[class*="enterprise"]',
      // 政采云特定的类名模式
      '[class*="user"] [class*="company"]',
      '[class*="header"] [class*="company"]',
      // 用户信息区域
      '.user-info span',
      '.user-center span',
    ];

    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          const text = element.textContent?.trim();
          // 公司名称通常包含"公司"、"有限"、"集团"等关键词
          if (text && (text.includes('公司') || text.includes('有限') || text.includes('集团') || text.includes('企业') || text.includes('中心'))) {
            console.log('[ZCY] 从DOM提取公司名称:', text);
            return text;
          }
        }
      } catch (e) {
        // 选择器可能无效，跳过
      }
    }

    // 方法2: 全局搜索包含"公司"的文本节点
    const allElements = document.querySelectorAll('span, div, a, p');
    for (const el of allElements) {
      const text = el.textContent?.trim();
      if (text && text.length > 4 && text.length < 50 &&
        (text.includes('有限公司') || text.includes('有限责任公司') || text.includes('股份公司'))) {
        // 排除导航和按钮文本
        if (!el.closest('nav') && !el.closest('button') && !el.closest('.sidebar')) {
          console.log('[ZCY] 从全局搜索提取公司名称:', text);
          return text;
        }
      }
    }

    // 方法3: 从LocalStorage提取
    const keys = ['userInfo', 'companyInfo', 'user', 'loginInfo', 'currentUser', 'session'];
    for (const key of keys) {
      const data = localStorage.getItem(key);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          const companyName = parsed.companyName || parsed.company || parsed.corpName ||
            parsed.enterpriseName || parsed.org || parsed.orgName;
          if (companyName) {
            console.log('[ZCY] 从LocalStorage提取公司名称:', companyName);
            return companyName;
          }
        } catch (e) {
          // 跳过解析错误
        }
      }
    }

    // 方法4: 从SessionStorage提取
    for (const key of keys) {
      const data = sessionStorage.getItem(key);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          const companyName = parsed.companyName || parsed.company || parsed.corpName ||
            parsed.enterpriseName || parsed.org || parsed.orgName;
          if (companyName) {
            console.log('[ZCY] 从SessionStorage提取公司名称:', companyName);
            return companyName;
          }
        } catch (e) {
          // 跳过解析错误
        }
      }
    }

    // 方法5: 从Cookie提取
    try {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        if (cookie.includes('company') || cookie.includes('corp') || cookie.includes('org')) {
          const value = decodeURIComponent(cookie.split('=')[1] || '');
          if (value && value.includes('公司')) {
            console.log('[ZCY] 从Cookie提取公司名称:', value);
            return value;
          }
        }
      }
    } catch (e) {
      // 跳过
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
