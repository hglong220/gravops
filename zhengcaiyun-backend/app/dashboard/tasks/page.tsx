'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type ProductDraft = {
  id: string
  title: string
  originalUrl: string
  shopName?: string
  status: string
  createdAt: string | Date
  copyTaskId?: string
  skuData?: string
  detailHtml?: string
  attributes?: string
  images?: string | string[]
  mainImages?: string | string[]
  detailImages?: string | string[]
  model?: string
  brand?: string
  categoryPath?: string
  price?: number | string
  marketPrice?: number | string
  stock?: number | string
  permissionStatus?: string | null
  permissionCheckedAt?: string | Date | null
}

type TaskGroup = {
  id: string
  name: string
  icon?: string
  count: number
  type: 'single' | 'batch'
  copyTaskId?: string
}

const ZCY_CATEGORIES = [
  {
    name: '计算机设备',
    children: [
      {
        name: '便携式计算机',
        children: [{ name: '通用笔记本电脑' }, { name: '移动工作站' }, { name: '国产笔记本' }]
      },
      {
        name: '台式计算机',
        children: [{ name: '台式一体机' }, { name: '分体式台式机' }, { name: '国产台式机' }]
      }
    ]
  },
  {
    name: '办公设备',
    children: [
      {
        name: '打印设备',
        children: [{ name: 'A4黑白激光打印机' }, { name: 'A3彩色激光打印机' }, { name: '喷墨打印机' }]
      }
    ]
  }
]

const statusBadge = (status: string) => {
  const map: Record<
    string,
    {
      text: string
      color: string
    }
  > = {
    pending: { text: '待采集', color: 'bg-gray-100 text-gray-600' },
    collected: { text: '已采集', color: 'bg-blue-100 text-blue-600' },
    scraped: { text: '已采集', color: 'bg-blue-100 text-blue-600' },
    published: { text: '已发布', color: 'bg-green-100 text-green-600' }
  }
  return map[status] || { text: status, color: 'bg-gray-100 text-gray-600' }
}

const parseJsonArray = (val: any): string[] => {
  if (!val) return []
  if (Array.isArray(val)) return val.filter(Boolean)
  if (typeof val === 'string') {
    try {
      const arr = JSON.parse(val)
      return Array.isArray(arr) ? arr.filter(Boolean) : []
    } catch {
      return []
    }
  }
  return []
}

const parseAttributes = (val: any): Record<string, string> => {
  if (!val) return {}
  if (typeof val === 'string') {
    try {
      const obj = JSON.parse(val)
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        const out: Record<string, string> = {}
        Object.entries(obj).forEach(([k, v]) => {
          if (k) out[k] = String(v ?? '')
        })
        return out
      }
    } catch {
      return {}
    }
  }
  return {}
}

export default function TaskPage() {
  const router = useRouter()
  const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([])
  const [products, setProducts] = useState<ProductDraft[]>([])
  const [selectedTask, setSelectedTask] = useState<string>('single')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductDraft | null>(null)
  const [editMainImages, setEditMainImages] = useState<string[]>([])
  const [editDetailImages, setEditDetailImages] = useState<string[]>([])
  const [specEntries, setSpecEntries] = useState<Array<{ key: string; value: string }>>([])
  const [catL1, setCatL1] = useState('')
  const [catL2, setCatL2] = useState('')
  const [catL3, setCatL3] = useState('')
  const [missingNotice, setMissingNotice] = useState('')
  const [permissionChecking, setPermissionChecking] = useState(false)
  const [permissionStats, setPermissionStats] = useState<{ total: number; valid: number; invalid: number } | null>(null)
  const [jdUrl, setJdUrl] = useState('')
  const [jdSubmitting, setJdSubmitting] = useState(false)
  const [jdMessage, setJdMessage] = useState('')

  const authedFetch = async (path: string, init: RequestInit = {}) => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      throw new Error('Unauthorized')
    }

    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${token}`)
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    const res = await fetch(path, { ...init, headers })

    if (res.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      router.push('/login')
      throw new Error('Unauthorized')
    }

    return res
  }

  const fetchData = async () => {
    try {
      const draftsRes = await authedFetch('/api/copy/drafts')
      const draftsJson = await draftsRes.json()
      const drafts: ProductDraft[] = draftsJson.drafts || []

      const single = drafts.filter((d) => !d.copyTaskId)
      const batch = drafts.filter((d) => d.copyTaskId)

      const groups: TaskGroup[] = [
        { id: 'single', name: '单品采集', count: single.length, type: 'single' },
        { id: 'batch', name: '批量采集', count: batch.length, type: 'batch' },
        { id: 'all', name: '全部任务', count: drafts.length, type: 'single' }
      ]

      setTaskGroups(groups)
      setProducts(selectedTask === 'single' ? single : selectedTask === 'batch' ? batch : drafts)
    } catch (e) {
      console.error('fetch data error', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const timer = setInterval(fetchData, 8000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    fetchProductsForTask(selectedTask)
  }, [selectedTask])

  const fetchProductsForTask = async (taskId: string) => {
    try {
      const res = await authedFetch('/api/copy/drafts')
      const data = await res.json()
      const drafts: ProductDraft[] = data.drafts || []
      if (taskId === 'single') setProducts(drafts.filter((d) => !d.copyTaskId))
      else if (taskId === 'batch') setProducts(drafts.filter((d) => d.copyTaskId))
      else setProducts(drafts)
      setSelectedIds(new Set())
    } catch (e) {
      console.error('fetch products error', e)
    }
  }

  const handleBatchDelete = async () => {
    if (!selectedIds.size) return alert('请先选择商品')
    if (!confirm(`确定删除选中的 ${selectedIds.size} 个商品吗？`)) return
    try {
      const res = await authedFetch('/api/copy/drafts/batch-delete', {
        method: 'POST',
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      })
      if (!res.ok) throw new Error('batch delete failed')
      setSelectedIds(new Set())
      fetchData()
    } catch (e) {
      alert('删除失败')
    }
  }

  const handleReadJdProduct = async () => {
    const url = jdUrl.trim()
    if (!url) {
      setJdMessage('请先粘贴京东商品链接')
      return
    }
    if (!url.includes('jd.com') && !url.includes('jd.hk')) {
      setJdMessage('请输入有效的京东商品链接')
      return
    }

    try {
      setJdSubmitting(true)
      setJdMessage('正在读取京东商品信息...')
      const res = await authedFetch('/api/copy/jd', {
        method: 'POST',
        body: JSON.stringify({ url })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || data?.details || '读取失败')
      }
      setJdUrl('')
      setJdMessage('已保存到任务中心')
      await fetchData()
    } catch (error: any) {
      setJdMessage(error?.message || '读取失败')
    } finally {
      setJdSubmitting(false)
    }
  }

  const handlePublish = async (id: string) => {
    try {
      const res = await authedFetch('/api/publish', {
        method: 'POST',
        body: JSON.stringify({ draftId: id })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success || !data?.publishData?.product) {
        throw new Error(data?.error || data?.details || '发布准备失败')
      }

      window.postMessage({
        type: 'TRIGGER_ZCY_PUBLISH',
        data: {
          ...data.publishData.product,
          draftId: data.publishData.draftId,
          zcyUrl: data.publishData.zcyUrl,
          template: data.publishData.template
        }
      }, window.location.origin)

      setTimeout(() => {
        if (document.visibilityState === 'visible') {
          window.open(data.publishData.zcyUrl, '_blank')
        }
      }, 800)
    } catch (error: any) {
      alert(error?.message || '发布准备失败')
    }
  }

  const handleCheckPermissions = async () => {
    // 验证是否选中商品
    if (!selectedIds.size) {
      alert('请先选择要检测的商品')
      return
    }

    // 限制单次检测数量上限为 20 条
    if (selectedIds.size > 20) {
      alert(`单次检测数量不能超过 20 条，当前已选中 ${selectedIds.size} 条。`)
      return
    }

    try {
      setPermissionChecking(true)
      setPermissionStats(null)

      // 从localStorage获取licenseKey（需要用户登录后保存）
      const user = localStorage.getItem('user')
      if (!user) {
        alert('请先登录')
        return
      }

      // 从用户信息中获取 licenseKey
      let licenseKey = ''
      try {
        const userData = JSON.parse(user)
        licenseKey = userData.licenseKey || ''
      } catch (e) {
        console.error('解析用户信息失败:', e)
      }

      if (!licenseKey) {
        alert('未找到授权密钥，请联系管理员配置')
        return
      }

      const res = await authedFetch('/api/tasks/check-permissions', {
        method: 'POST',
        body: JSON.stringify({
          licenseKey,
          productIds: Array.from(selectedIds)  // 只检测选中的商品
        })
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || '检测失败')
      }

      setPermissionStats(result.stats)

      // 刷新商品列表
      await fetchProductsForTask(selectedTask)

      // 不再显示弹窗，只通过标题颜色显示结果
    } catch (error: any) {
      console.error('权限检测失败:', error)
      alert('权限检测失败: ' + error.message)
    } finally {
      setPermissionChecking(false)
    }
  }

  // 判断是否可以发布（必须检测且全部有权限）
  const canPublish = useMemo(() => {
    if (selectedIds.size === 0) return false;

    const selectedProducts = products.filter(p => selectedIds.has(p.id));

    // 检查是否都已检测
    const allChecked = selectedProducts.every(p => p.permissionStatus);
    if (!allChecked) return false;

    // 检查是否都有权限
    const allValid = selectedProducts.every(p => p.permissionStatus === 'valid');
    return allValid;
  }, [selectedIds, products]);

  // 发布提示信息
  const publishHint = useMemo(() => {
    if (selectedIds.size === 0) return '请先选择商品';

    const selectedProducts = products.filter(p => selectedIds.has(p.id));
    const unchecked = selectedProducts.filter(p => !p.permissionStatus);
    const invalid = selectedProducts.filter(p => p.permissionStatus === 'invalid');

    if (unchecked.length > 0) {
      return `有 ${unchecked.length} 个商品未检测，请先点击"检测"`;
    }

    if (invalid.length > 0) {
      return `有 ${invalid.length} 个商品无权限，无法发布`;
    }

    return `${selectedProducts.length} 个商品可发布`;
  }, [selectedIds, products]);

  const handleBatchPublish = () => {
    if (!selectedIds.size) return alert('请先选择商品')
    selectedIds.forEach((id) => {
      void handlePublish(id)
    })
  }

  const openEditModal = (product: ProductDraft) => {
    const mainImgs = parseJsonArray(product.mainImages || product.images)
    const detailImgs = parseJsonArray(product.detailImages)
    const attrsObj = parseAttributes(product.attributes)
    setEditMainImages(mainImgs)
    setEditDetailImages(detailImgs)
    setSpecEntries(Object.entries(attrsObj).map(([key, value]) => ({ key, value })))
    const path = product.categoryPath || '计算机设备/便携式计算机/通用笔记本电脑'
    const [l1, l2, l3] = path.split('/')
    setCatL1(l1 || '')
    setCatL2(l2 || '')
    setCatL3(l3 || '')

    // 从 skuData 解析市场价和库存
    let productWithPrice = { ...product } as any
    if (product.skuData) {
      try {
        const skuObj = JSON.parse(product.skuData)
        // 把采集到的价格作为市场价
        const originalPrice = skuObj.price || product.price || ''
        productWithPrice.marketPrice = product.marketPrice || originalPrice
        productWithPrice.stock = skuObj.stock || 99
        // 如果数据库里有销售价就显示，没有就留空
        productWithPrice.price = product.price || ''
      } catch { }
    } else {
      // 没有 skuData 时也读取市场价
      const originalPrice = product.price || ''
      productWithPrice.marketPrice = product.marketPrice || originalPrice
      // 如果数据库里有销售价就显示，没有就留空
      productWithPrice.price = product.price || ''
    }

    setEditingProduct(productWithPrice)
    setMissingNotice('')
    setIsEditModalOpen(true)
  }

  const saveProduct = async () => {
    if (!editingProduct) return
    if (!editingProduct.title || !editingProduct.brand || !editingProduct.model || !editMainImages.length) {
      setMissingNotice('请先补全：标题 / 品牌 / 型号 / 至少一张主图。')
      return
    }
    setMissingNotice('')
    const attrs = specEntries.reduce<Record<string, string>>((acc, cur) => {
      if (cur.key.trim()) acc[cur.key.trim()] = cur.value
      return acc
    }, {})
    const categoryPath = [catL1, catL2, catL3].filter(Boolean).join('/')
    const rawPrice = (editingProduct as any).price
    const rawStock = (editingProduct as any).stock

    const parsedPrice =
      rawPrice === undefined || rawPrice === null || String(rawPrice).trim() === ''
        ? undefined
        : Number.parseFloat(String(rawPrice))

    const price = Number.isFinite(parsedPrice) ? parsedPrice : undefined

    const parsedStock =
      rawStock === undefined || rawStock === null || String(rawStock).trim() === ''
        ? undefined
        : Number.parseInt(String(rawStock), 10)
    const rawMarketPrice = (editingProduct as any).marketPrice
    const parsedMarketPrice =
      rawMarketPrice === undefined || rawMarketPrice === null || String(rawMarketPrice).trim() === ''
        ? undefined
        : Number.parseFloat(String(rawMarketPrice))
    const marketPrice = Number.isFinite(parsedMarketPrice) ? parsedMarketPrice : undefined

    const stock = Number.isFinite(parsedStock) ? parsedStock : undefined

    // 🔍 调试：打印即将保存的价格数据
    console.log('[SAVE_DEBUG] price:', price, 'marketPrice:', marketPrice, 'stock:', stock)

    try {
      const res = await authedFetch(`/api/copy/drafts/${editingProduct.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: editingProduct.title,
          price,
          marketPrice,
          stock,
          detailHtml: editingProduct.detailHtml || '',
          categoryPath,
          attributes: attrs,
          images: editMainImages,
          detailImages: editDetailImages,
          model: editingProduct.model || '',
          brand: editingProduct.brand || '',
          originalUrl: editingProduct.originalUrl || ''
        })
      })
      if (!res.ok) throw new Error('save failed')
      setIsEditModalOpen(false)
      fetchProductsForTask(selectedTask)
    } catch (e) {
      alert('保存失败')
    }
  }

  const sourceLabel = (url: string) => {
    if (!url) return '未知'
    if (url.includes('jd.com')) return '京东'
    if (url.includes('tmall')) return '天猫'
    if (url.includes('taobao')) return '淘宝'
    if (url.includes('suning.com')) return '苏宁'
    if (url.includes('zcygov')) return '政采云'
    return '其他'
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const allSelected = useMemo(() => products.length > 0 && selectedIds.size === products.length, [products, selectedIds])

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)))
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* 标题 */}
      <div className="flex-shrink-0 mb-4">
        <h1 className="text-2xl font-bold text-gray-900">任务中心</h1>
        <p className="text-gray-500 text-sm mt-1">统一管理采集和发布任务</p>
      </div>

      {/* 批量操作按钮 */}
      <div className="flex-shrink-0 mb-4 bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <input
            value={jdUrl}
            onChange={(event) => setJdUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleReadJdProduct()
            }}
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder="粘贴京东商品链接"
          />
          <button
            onClick={handleReadJdProduct}
            disabled={jdSubmitting}
            className="px-4 py-2 bg-black text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {jdSubmitting ? '读取中...' : '读取京东商品'}
          </button>
        </div>
        {jdMessage && (
          <div className="text-xs text-gray-500 mt-2">{jdMessage}</div>
        )}
      </div>

      <div className="flex justify-end gap-2 flex-shrink-0 mb-4">
        <button
          onClick={handleCheckPermissions}
          disabled={permissionChecking}
          className="px-4 py-2 bg-white text-gray-700 rounded border border-gray-300 hover:bg-gray-50 text-sm disabled:opacity-50"
        >
          {permissionChecking ? '检测中...' : '检测'}
        </button>
        <button
          onClick={handleBatchPublish}
          disabled={!canPublish}
          title={publishHint}
          className={`px-4 py-2 rounded text-sm transition-colors ${canPublish
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
        >
          发布
        </button>
        <button
          onClick={handleBatchDelete}
          className="px-4 py-2 bg-red-50 text-red-600 rounded border border-red-200 hover:bg-red-100 text-sm"
        >
          删除
        </button>
      </div>

      {/* 提示信息 */}
      {selectedIds.size > 0 && (
        <div className="flex justify-end mb-2 flex-shrink-0">
          <p className={`text-xs ${canPublish ? 'text-green-600' : 'text-gray-500'
            }`}>
            {publishHint}
          </p>
        </div>
      )}

      {/* 商品列表 - 占满全宽 */}
      <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
        <div className="overflow-y-auto overflow-x-hidden flex-1">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="w-12 px-3 py-3 text-left whitespace-nowrap">选择</th>
                <th className="px-4 py-3 text-left">标题</th>
                <th className="hidden md:table-cell w-20 px-4 py-3 text-center whitespace-nowrap">来源</th>
                <th className="hidden lg:table-cell w-20 px-4 py-3 text-center whitespace-nowrap">状态</th>
                <th className="hidden xl:table-cell w-32 px-4 py-3 text-center whitespace-nowrap">时间</th>
                <th className="w-24 md:w-48 px-3 py-3 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-3">
                    <div className="hidden md:flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        className="h-4 w-4"
                        title="全选"
                      />
                      <span className="text-sm text-gray-500 font-normal">全选</span>
                    </div>
                    <div className="hidden md:flex items-center gap-1">
                      {taskGroups.filter(g => g.id !== 'all').map((g) => {
                        const active = selectedTask === g.id
                        return (
                          <button
                            key={g.id}
                            onClick={() => setSelectedTask(g.id)}
                            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${active
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-500 hover:bg-gray-100'
                              }`}
                          >
                            {g.name}({g.count})
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const badge = statusBadge(p.status)
                return (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={() => toggleSelect(p.id)}
                        className="h-4 w-4"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="min-w-0 truncate" title={p.title}>
                        <span className={`font-medium ${p.permissionStatus === 'invalid' ? 'text-red-600' :
                          p.permissionStatus === 'valid' ? 'text-green-700' :
                            'text-gray-900'
                          }`}>
                          {p.title}
                        </span>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-gray-600 text-center whitespace-nowrap">{sourceLabel(p.originalUrl)}</td>
                    <td className="hidden lg:table-cell px-4 py-3 text-center whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${badge.color}`}>{badge.text}</span>
                    </td>
                    <td className="hidden xl:table-cell px-4 py-3 text-gray-500 text-center whitespace-nowrap text-xs">
                      {new Date(p.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="w-24 md:w-48 px-3 py-3 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditModal(p)}
                          className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                        >
                          编辑
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!products.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isEditModalOpen && editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3">
          <div className="relative w-full max-w-[780px]">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="absolute right-3 top-3 z-10 w-9 h-9 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow hover:bg-gray-50"
              title="关闭"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-h-[85vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-gray-900 mb-4">编辑商品信息</h3>

              {/* 类目选择 - UI已隐藏，由后台自动匹配。保留 ZCY_CATEGORIES 数据和 catL1/catL2/catL3 状态供插件使用 */}

              {/* 商品标题 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">商品标题</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  value={editingProduct.title}
                  onChange={(e) => setEditingProduct({ ...editingProduct, title: e.target.value })}
                />
              </div>

              {/* 品牌型号 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">品牌</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    value={editingProduct.brand || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, brand: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">型号</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    value={editingProduct.model || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, model: e.target.value })}
                  />
                </div>
              </div>

              {/* 原始链接 + 市场价 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">原始链接</label>
                  <input
                    type="text"
                    className="w-full border border-gray-200 bg-gray-50 rounded px-3 py-2 text-sm"
                    value={editingProduct.originalUrl || ''}
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">市场价 (元)</label>
                  <input
                    type="number"
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    value={(editingProduct as any).marketPrice || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, marketPrice: e.target.value as any })}
                    placeholder="原价/市场价"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">销售价 (元)</label>
                  <input
                    type="number"
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    value={(editingProduct as any).price || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value as any })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">库存</label>
                  <input
                    type="number"
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    value={(editingProduct as any).stock || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, stock: e.target.value as any })}
                  />
                </div>
              </div>

              {/* 主图 */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">主图</label>
                  <button
                    onClick={() => setEditMainImages([...editMainImages, ''])}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    + 添加
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {editMainImages.map((url, idx) => (
                    <div key={idx} className="border rounded-lg p-2 space-y-2">
                      <div className="w-full h-28 bg-gray-50 flex items-center justify-center overflow-hidden rounded">
                        {url ? <img src={url} alt="" className="object-contain max-h-28" /> : <span className="text-xs text-gray-400">无预览</span>}
                      </div>
                      <input
                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                        value={url}
                        placeholder="图片 URL"
                        onChange={(e) => {
                          const next = [...editMainImages]
                          next[idx] = e.target.value
                          setEditMainImages(next)
                        }}
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <button
                          onClick={() => {
                            const next = editMainImages.filter((_, i) => i !== idx)
                            setEditMainImages(next)
                          }}
                          className="text-red-500 hover:underline"
                        >
                          删除
                        </button>
                        {idx > 0 && (
                          <button
                            onClick={() => {
                              const next = [...editMainImages]
                                ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
                              setEditMainImages(next)
                            }}
                            className="hover:underline"
                          >
                            上移
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {!editMainImages.length && <div className="text-sm text-gray-400 col-span-3">暂无主图，可点击“添加”</div>}
                </div>
              </div>

              {/* 详情图 */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">详情图</label>
                  <button
                    onClick={() => setEditDetailImages([...editDetailImages, ''])}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    + 添加
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {editDetailImages.map((url, idx) => (
                    <div key={idx} className="border rounded-lg p-1 space-y-1">
                      <div className="w-full h-20 bg-gray-50 flex items-center justify-center overflow-hidden rounded">
                        {url ? <img src={url} alt="" className="object-contain max-h-20" /> : <span className="text-xs text-gray-400">无预览</span>}
                      </div>
                      <input
                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                        value={url}
                        placeholder="图片 URL"
                        onChange={(e) => {
                          const next = [...editDetailImages]
                          next[idx] = e.target.value
                          setEditDetailImages(next)
                        }}
                      />
                      <div className="flex justify-between text-[11px] text-gray-500">
                        <button
                          onClick={() => {
                            const next = editDetailImages.filter((_, i) => i !== idx)
                            setEditDetailImages(next)
                          }}
                          className="text-red-500 hover:underline"
                        >
                          删
                        </button>
                        {idx > 0 && (
                          <button
                            onClick={() => {
                              const next = [...editDetailImages]
                                ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
                              setEditDetailImages(next)
                            }}
                            className="hover:underline"
                          >
                            ↑
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {!editDetailImages.length && <div className="text-sm text-gray-400 col-span-4">暂无详情图，可点击“添加”</div>}
                </div>
              </div>

              {/* 规格参数 */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">规格参数</label>
                  <button
                    onClick={() => setSpecEntries([...specEntries, { key: '', value: '' }])}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    + 添加
                  </button>
                </div>
                <div className="space-y-2">
                  {specEntries.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-5 gap-2 items-center">
                      <input
                        className="col-span-2 border border-gray-300 rounded px-2 py-1 text-sm"
                        placeholder="参数名"
                        value={row.key}
                        onChange={(e) => {
                          const next = [...specEntries]
                          next[idx] = { ...next[idx], key: e.target.value }
                          setSpecEntries(next)
                        }}
                      />
                      <input
                        className="col-span-3 border border-gray-300 rounded px-2 py-1 text-sm"
                        placeholder="参数值"
                        value={row.value}
                        onChange={(e) => {
                          const next = [...specEntries]
                          next[idx] = { ...next[idx], value: e.target.value }
                          setSpecEntries(next)
                        }}
                      />
                      <button
                        onClick={() => setSpecEntries(specEntries.filter((_, i) => i !== idx))}
                        className="text-xs text-red-500 hover:underline col-span-5 text-right"
                      >
                        删除
                      </button>
                    </div>
                  ))}
                  {!specEntries.length && <div className="text-sm text-gray-400">暂无规格，可点击"添加"</div>}
                </div>
              </div>

              {/* SKU规格组 (新增) */}
              {(() => {
                let skuDataObj: any = null
                try {
                  if (editingProduct.skuData) {
                    skuDataObj = typeof editingProduct.skuData === 'string'
                      ? JSON.parse(editingProduct.skuData)
                      : editingProduct.skuData
                  }
                } catch { }

                if (!skuDataObj?.specGroups?.length) return null

                return (
                  <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <label className="block text-sm font-medium text-blue-700 mb-3">
                      📦 SKU规格组 (已采集 {skuDataObj.specGroups.length} 组)
                    </label>
                    <div className="space-y-3">
                      {skuDataObj.specGroups.map((group: any, gIdx: number) => (
                        <div key={gIdx} className="bg-white rounded p-3 border border-blue-100">
                          <div className="text-sm font-medium text-gray-700 mb-2">{group.name}</div>
                          <div className="flex flex-wrap gap-2">
                            {group.values?.map((val: any, vIdx: number) => (
                              <div
                                key={vIdx}
                                className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-700"
                              >
                                {val.image && (
                                  <img src={val.image} alt="" className="w-5 h-5 object-cover rounded" />
                                )}
                                <span>{val.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    {skuDataObj.defaultPrice && (
                      <div className="mt-2 text-sm text-blue-600">
                        默认价格: ¥{skuDataObj.defaultPrice}
                      </div>
                    )}
                  </div>
                )
              })()}

              {!!(editingProduct.detailHtml || '').trim() && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">商品详情 (HTML)</label>
                  <textarea
                    className="w-full border border-gray-300 rounded px-3 py-2 h-40 font-mono text-xs focus:ring-blue-500 focus:border-blue-500"
                    value={editingProduct.detailHtml || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, detailHtml: e.target.value })}
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                {missingNotice && <div className="text-red-500 text-sm mr-auto">{missingNotice}</div>}
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={saveProduct}
                  className="px-5 py-2.5 bg-black text-white rounded-lg hover:opacity-80 font-medium transition-opacity shadow-lg shadow-gray-200"
                >
                  保存修改
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
