'use client'

import { useEffect, useMemo, useState } from 'react'

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

  const fetchData = async () => {
    try {
      const draftsRes = await fetch('http://localhost:3000/api/copy/drafts')
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
      const res = await fetch('http://localhost:3000/api/copy/drafts')
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
      const res = await fetch('http://localhost:3000/api/copy/drafts/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      })
      if (!res.ok) throw new Error('batch delete failed')
      setSelectedIds(new Set())
      fetchData()
    } catch (e) {
      alert('删除失败')
    }
  }

  const handlePublish = (id: string) => {
    const url = `https://www.zcygov.cn/goods-center/goods/category/attr/select?draft_id=${id}`
    window.open(url, '_blank')
  }

  const handleBatchPublish = () => {
    if (!selectedIds.size) return alert('请先选择商品')
    selectedIds.forEach((id) => handlePublish(id))
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
    setEditingProduct(product)
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
    try {
      const res = await fetch(`http://localhost:3000/api/copy/drafts/${editingProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editingProduct.title,
          price: (editingProduct as any).price || '',
          stock: (editingProduct as any).stock || '',
          detailHtml: editingProduct.detailHtml || '',
          categoryPath,
          attributes: JSON.stringify(attrs),
          images: JSON.stringify(editMainImages),
          detailImages: JSON.stringify(editDetailImages),
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
    if (url.includes('zcygov')) return '政采云'
    return '其他'
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const allSelected = useMemo(() => products.length && selectedIds.size === products.length, [products, selectedIds])

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)))
    }
  }

  return (
    <div className="h-full flex flex-col relative p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">任务中心</h1>
          <p className="text-gray-500 text-sm mt-1">统一管理采集和发布任务</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleBatchPublish}
            className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            批量发布
          </button>
          <button
            onClick={handleBatchDelete}
            className="px-3 py-2 bg-red-50 text-red-600 rounded border border-red-200 hover:bg-red-100 text-sm"
          >
            批量删除
          </button>
        </div>
      </div>

      <div className="flex gap-6 flex-1 overflow-hidden">
        <div className="w-72 bg-white rounded-lg border border-gray-200 overflow-y-auto">
          <div className="p-3 border-b border-gray-200 font-semibold text-gray-800">任务列表</div>
          <div className="p-2 space-y-1">
            {taskGroups.map((g) => {
              const active = selectedTask === g.id
              return (
                <button
                  key={g.id}
                  onClick={() => setSelectedTask(g.id)}
                  className={`w-full text-left p-3 rounded-lg ${active ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{g.name}</span>
                    <span className="text-sm text-gray-500">{g.count}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <span>共 {products.length} 条</span>
              {loading && <span className="text-gray-400">加载中…</span>}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="h-4 w-4"
                title="全选"
              />
              <span className="text-sm text-gray-500">全选</span>
            </div>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">选择</th>
                  <th className="px-4 py-2 text-left">标题</th>
                  <th className="px-4 py-2 text-left">来源</th>
                  <th className="px-4 py-2 text-left">状态</th>
                  <th className="px-4 py-2 text-left">时间</th>
                  <th className="px-4 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const badge = statusBadge(p.status)
                  return (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(p.id)}
                          onChange={() => toggleSelect(p.id)}
                          className="h-4 w-4"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <div className="text-gray-900 font-medium line-clamp-2">{p.title}</div>
                      </td>
                      <td className="px-4 py-2 text-gray-600">{sourceLabel(p.originalUrl)}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${badge.color}`}>{badge.text}</span>
                      </td>
                      <td className="px-4 py-2 text-gray-500">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handlePublish(p.id)}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                          >
                            发布
                          </button>
                          <button
                            onClick={() => openEditModal(p)}
                            className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
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
                    <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                      暂无数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isEditModalOpen && editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="relative">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="absolute -right-10 -top-10 w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow hover:bg-gray-50"
              title="关闭"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="bg-white rounded-lg p-6 w-[780px] max-h-[85vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-gray-900 mb-4">编辑商品信息</h3>

              {/* 类目选择 */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-5">
                <div className="flex items-center gap-2 text-blue-800 font-semibold mb-3">
                  <span>政采云标准类目</span>
                  <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">机器核对 + 人工调整</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-blue-600 mb-1">一级类目</label>
                    <select
                      className="w-full border-blue-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                      value={catL1}
                      onChange={(e) => {
                        setCatL1(e.target.value)
                        setCatL2('')
                        setCatL3('')
                      }}
                    >
                      <option value="">请选择</option>
                      {ZCY_CATEGORIES.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-blue-600 mb-1">二级类目</label>
                    <select
                      className="w-full border-blue-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                      value={catL2}
                      onChange={(e) => {
                        setCatL2(e.target.value)
                        setCatL3('')
                      }}
                      disabled={!catL1}
                    >
                      <option value="">请选择</option>
                      {catL1 &&
                        ZCY_CATEGORIES.find((c) => c.name === catL1)?.children.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-blue-600 mb-1">三级类目</label>
                    <select
                      className="w-full border-blue-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                      value={catL3}
                      onChange={(e) => setCatL3(e.target.value)}
                      disabled={!catL2}
                    >
                      <option value="">请选择</option>
                      {catL1 &&
                        catL2 &&
                        ZCY_CATEGORIES.find((c) => c.name === catL1)
                          ?.children.find((c) => c.name === catL2)
                          ?.children.map((c: any) => (
                            <option key={c.name} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                    </select>
                  </div>
                </div>
                <div className="mt-3 text-xs text-blue-700">
                  当前选择：{[catL1, catL2, catL3].filter(Boolean).join(' > ') || '未选择'}
                </div>
              </div>

              {/* 原始信息 + 品牌型号 */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">原始链接</label>
                  <input
                    type="text"
                    className="w-full border border-gray-200 bg-gray-50 rounded px-3 py-2 text-sm"
                    value={editingProduct.originalUrl || ''}
                    readOnly
                  />
                </div>
                <div />
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

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">商品标题</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  value={editingProduct.title}
                  onChange={(e) => setEditingProduct({ ...editingProduct, title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">价格 (元)</label>
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
                <div className="grid grid-cols-3 gap-3">
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
                <div className="grid grid-cols-4 gap-2">
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
                  {!specEntries.length && <div className="text-sm text-gray-400">暂无规格，可点击“添加”</div>}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">商品详情 (HTML)</label>
                <textarea
                  className="w-full border border-gray-300 rounded px-3 py-2 h-40 font-mono text-xs focus:ring-blue-500 focus:border-blue-500"
                  value={editingProduct.detailHtml || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, detailHtml: e.target.value })}
                />
              </div>

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
