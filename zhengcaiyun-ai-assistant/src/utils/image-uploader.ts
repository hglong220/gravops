/**
 * 图片处理工具
 * 
 * 功能：
 * 1. 验证图片URL有效性
 * 2. 通过后端代理下载图片
 * 3. 本地缓存（IndexedDB）
 * 4. 上传到政采云
 * 5. 清理缓存
 */

const BACKEND_URL = process.env.PLASMO_PUBLIC_BACKEND_URL || '';

// ========== 日志工具 ==========
function log(...args: any[]) {
    console.log('[ImageUploader]', ...args);
}

// ========== IndexedDB 缓存 ==========

const DB_NAME = 'ImageCache';
const DB_VERSION = 1;
const STORE_NAME = 'images';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });

    return dbPromise;
}

async function cacheImage(id: string, blob: Blob, url: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put({ id, blob, url, timestamp: Date.now() });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function getCachedImage(id: string): Promise<Blob | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result?.blob || null);
        request.onerror = () => reject(request.error);
    });
}

async function clearImageCache(): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        tx.oncomplete = () => {
            log('✓ 图片缓存已清理');
            resolve();
        };
        tx.onerror = () => reject(tx.error);
    });
}

// ========== 图片验证和下载 ==========

interface ImageDownloadResult {
    url: string;
    success: boolean;
    blob?: Blob;
    error?: string;
}

/**
 * 验证图片URL是否有效
 */
async function checkImageExists(url: string): Promise<boolean> {
    try {
        const response = await fetch(`${BACKEND_URL}/api/image-proxy?url=${encodeURIComponent(url)}`);
        const data = await response.json();
        return data.exists === true;
    } catch (e) {
        log(`验证图片失败: ${url}`, e);
        return false;
    }
}

/**
 * 通过后端代理下载单张图片
 */
async function downloadImage(url: string): Promise<Blob | null> {
    try {
        const response = await fetch(`${BACKEND_URL}/api/image-proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
        });

        const data = await response.json();

        if (!data.success || !data.data) {
            log(`下载失败: ${url}`, data.error);
            return null;
        }

        // Base64 转 Blob
        const base64Data = data.data.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: data.contentType || 'image/jpeg' });

        return blob;
    } catch (e) {
        log(`下载图片异常: ${url}`, e);
        return null;
    }
}

/**
 * 批量下载图片到本地缓存
 * @param urls 图片URL列表
 * @param prefix 缓存ID前缀（如 'main' 或 'detail'）
 * @returns 下载结果
 */
export async function downloadAndCacheImages(
    urls: string[],
    prefix: string = 'img'
): Promise<{
    success: boolean;
    total: number;
    downloaded: number;
    failed: number;
    cachedIds: string[];
}> {
    log(`开始下载 ${urls.length} 张图片 (${prefix})`);

    const cachedIds: string[] = [];
    let downloaded = 0;
    let failed = 0;

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const id = `${prefix}_${i}`;

        try {
            // 1. 先验证图片存在
            const exists = await checkImageExists(url);
            if (!exists) {
                log(`✗ 图片不存在，跳过: ${url}`);
                failed++;
                continue;
            }

            // 2. 下载图片
            const blob = await downloadImage(url);
            if (!blob) {
                log(`✗ 下载失败，跳过: ${url}`);
                failed++;
                continue;
            }

            // 3. 缓存到 IndexedDB
            await cacheImage(id, blob, url);
            cachedIds.push(id);
            downloaded++;
            log(`✓ 下载成功 [${i + 1}/${urls.length}]: ${url.substring(0, 50)}...`);

        } catch (e) {
            log(`✗ 处理失败: ${url}`, e);
            failed++;
            // 不重试，继续下一张
        }
    }

    log(`下载完成: ${downloaded}/${urls.length} 成功, ${failed} 失败`);

    return {
        success: downloaded > 0,
        total: urls.length,
        downloaded,
        failed,
        cachedIds,
    };
}

// ========== 图片上传到政采云 ==========

/**
 * 将缓存的图片上传到指定的上传区域
 * @param cachedIds 缓存的图片ID列表
 * @param uploadAreaSelector 上传区域选择器
 */
export async function uploadCachedImages(
    cachedIds: string[],
    uploadAreaSelector: string = '.el-upload__input'
): Promise<{
    success: boolean;
    uploaded: number;
    failed: number;
}> {
    log(`开始上传 ${cachedIds.length} 张图片`);

    let uploaded = 0;
    let failed = 0;

    // 找到上传 input
    const uploadInput = document.querySelector(uploadAreaSelector) as HTMLInputElement;
    if (!uploadInput) {
        log('❌ 未找到上传组件');
        return { success: false, uploaded: 0, failed: cachedIds.length };
    }

    // 收集所有 File 对象
    const files: File[] = [];

    for (const id of cachedIds) {
        try {
            const blob = await getCachedImage(id);
            if (!blob) {
                log(`缓存中未找到图片: ${id}`);
                failed++;
                continue;
            }

            // 创建 File 对象
            const fileName = `${id}.jpg`;
            const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
            files.push(file);
            log(`✓ 准备上传: ${fileName} (${Math.round(blob.size / 1024)}KB)`);

        } catch (e) {
            log(`处理缓存图片失败: ${id}`, e);
            failed++;
        }
    }

    if (files.length === 0) {
        log('❌ 没有可上传的图片');
        return { success: false, uploaded: 0, failed: cachedIds.length };
    }

    // 使用 DataTransfer 模拟文件选择
    try {
        const dataTransfer = new DataTransfer();
        files.forEach(file => dataTransfer.items.add(file));

        // 设置 files 属性
        uploadInput.files = dataTransfer.files;

        // 触发 change 事件
        uploadInput.dispatchEvent(new Event('change', { bubbles: true }));

        uploaded = files.length;
        log(`✓ 触发上传事件，共 ${uploaded} 张图片`);

        // 等待上传完成（检查预览图出现）
        await waitForUploadComplete(uploaded);

    } catch (e) {
        log('上传触发失败:', e);
        return { success: false, uploaded: 0, failed: files.length };
    }

    return {
        success: uploaded > 0,
        uploaded,
        failed,
    };
}

/**
 * 等待上传完成（检查预览图）
 */
async function waitForUploadComplete(expectedCount: number, timeout: number = 30000): Promise<boolean> {
    log(`等待上传完成，期望 ${expectedCount} 张`);

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        // 检查已上传的预览图数量
        const previews = document.querySelectorAll('.el-upload-list__item, [class*="upload-item"], [class*="preview"]');
        const loadedPreviews = Array.from(previews).filter(el => {
            // 排除正在上传中的
            const isLoading = el.classList.contains('is-uploading') || el.querySelector('.el-loading');
            return !isLoading;
        });

        if (loadedPreviews.length >= expectedCount) {
            log(`✓ 上传完成，检测到 ${loadedPreviews.length} 张预览图`);
            return true;
        }

        await new Promise(r => setTimeout(r, 500));
    }

    log('⚠️ 上传超时');
    return false;
}

// ========== 清理 ==========

export { clearImageCache };

// ========== 完整上传流程 ==========

export interface ImageUploadOptions {
    mainImages: string[];       // 主图URL列表
    detailImages?: string[];    // 详情图URL列表
    mainUploadSelector?: string;
    detailUploadSelector?: string;
}

export interface ImageUploadResult {
    success: boolean;
    mainUploaded: number;
    detailUploaded: number;
    errors: string[];
}

/**
 * 完整图片上传流程
 */
export async function processAndUploadImages(options: ImageUploadOptions): Promise<ImageUploadResult> {
    const errors: string[] = [];
    let mainUploaded = 0;
    let detailUploaded = 0;

    try {
        log('═══════════════════════════════════════');
        log('🖼️ 开始图片处理流程');
        log('═══════════════════════════════════════');

        // 1. 下载主图
        if (options.mainImages.length > 0) {
            log(`\n📷 处理主图 (${options.mainImages.length} 张)`);
            const mainResult = await downloadAndCacheImages(options.mainImages, 'main');

            if (!mainResult.success) {
                errors.push('主图下载失败');
                return { success: false, mainUploaded: 0, detailUploaded: 0, errors };
            }

            // 上传主图
            const mainUploadResult = await uploadCachedImages(
                mainResult.cachedIds,
                options.mainUploadSelector || 'input[type="file"]'
            );
            mainUploaded = mainUploadResult.uploaded;

            if (mainUploaded === 0) {
                errors.push('主图上传失败');
                return { success: false, mainUploaded: 0, detailUploaded: 0, errors };
            }
        }

        // 2. 下载详情图
        if (options.detailImages && options.detailImages.length > 0) {
            log(`\n📷 处理详情图 (${options.detailImages.length} 张)`);
            const detailResult = await downloadAndCacheImages(options.detailImages, 'detail');

            if (detailResult.success) {
                // 上传详情图
                const detailUploadResult = await uploadCachedImages(
                    detailResult.cachedIds,
                    options.detailUploadSelector || 'input[type="file"]'
                );
                detailUploaded = detailUploadResult.uploaded;
            }
        }

        log('\n═══════════════════════════════════════');
        log(`✅ 图片处理完成: 主图 ${mainUploaded} 张, 详情图 ${detailUploaded} 张`);
        log('═══════════════════════════════════════');

        return {
            success: mainUploaded > 0,
            mainUploaded,
            detailUploaded,
            errors,
        };

    } catch (error) {
        log('图片处理异常:', error);
        errors.push(String(error));
        return {
            success: false,
            mainUploaded,
            detailUploaded,
            errors,
        };
    } finally {
        // 3. 清理缓存
        await clearImageCache();
    }
}
