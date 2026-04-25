const state = {
  result: null
}

const productUrl = document.querySelector('#productUrl')
const readButton = document.querySelector('#readButton')
const notice = document.querySelector('#notice')
const summary = document.querySelector('#summary')
const tabs = document.querySelector('#tabs')
const panels = {
  images: document.querySelector('#panel-images'),
  attrs: document.querySelector('#panel-attrs'),
  specs: document.querySelector('#panel-specs'),
  json: document.querySelector('#panel-json')
}

readButton.addEventListener('click', readProduct)
productUrl.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') readProduct()
})

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => setTab(tab.dataset.tab))
})

document.querySelector('#copyJsonButton').addEventListener('click', async () => {
  if (!state.result) return
  await navigator.clipboard.writeText(JSON.stringify(state.result, null, 2))
  showNotice('JSON 已复制')
})

document.querySelector('#downloadJsonButton').addEventListener('click', () => {
  if (!state.result) return
  const blob = new Blob([JSON.stringify(state.result, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `jd-product-${state.result.skuId || Date.now()}.json`
  link.click()
  URL.revokeObjectURL(url)
})

async function readProduct() {
  const url = productUrl.value.trim()
  if (!url) {
    showNotice('请输入京东商品链接', true)
    return
  }

  setLoading(true)
  showNotice('正在读取京东商品信息，浏览器窗口会自动打开或复用现有窗口。')
  try {
    const response = await fetch('/api/read-jd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    })
    const payload = await response.json()
    if (!response.ok || !payload.ok) throw new Error(payload.error || '读取失败')
    state.result = payload.result
    renderResult(payload.result)
    showNotice('读取完成')
  } catch (error) {
    showNotice(error.message || String(error), true)
  } finally {
    setLoading(false)
  }
}

function renderResult(result) {
  summary.hidden = false
  tabs.hidden = false
  document.querySelector('#titleText').textContent = result.title || '-'
  document.querySelector('#brandText').textContent = result.brand || '-'
  document.querySelector('#modelText').textContent = result.model || '-'
  document.querySelector('#skuText').textContent = result.skuId || '-'
  document.querySelector('#mainCount').textContent = String(result.mainImages?.length || 0)
  document.querySelector('#detailCount').textContent = String(result.detailImages?.length || 0)
  document.querySelector('#attrCount').textContent = String(Object.keys(result.attributes || {}).length)
  document.querySelector('#specCount').textContent = String(result.specGroups?.length || 0)

  renderImages('#mainImages', result.mainImages || [])
  renderImages('#detailImages', result.detailImages || [])
  document.querySelector('#mainImageMeta').textContent = `${result.mainImages?.length || 0} 张`
  document.querySelector('#detailImageMeta').textContent = `${result.detailImages?.length || 0} 张`
  renderAttributes(result.attributes || {})
  renderSpecs(result.selectedSaleSpecs || [], result.specGroups || [])
  document.querySelector('#jsonOutput').textContent = JSON.stringify(result, null, 2)
}

function renderImages(selector, images) {
  const root = document.querySelector(selector)
  root.replaceChildren()
  if (!images.length) {
    root.append(emptyText('暂无图片'))
    return
  }
  for (const src of images) {
    const link = document.createElement('a')
    link.href = src
    link.target = '_blank'
    link.rel = 'noreferrer'
    const image = document.createElement('img')
    image.src = src
    image.loading = 'lazy'
    image.alt = ''
    link.append(image)
    root.append(link)
  }
}

function renderAttributes(attributes) {
  const tbody = document.querySelector('#attributeRows')
  tbody.replaceChildren()
  const entries = Object.entries(attributes)
  if (!entries.length) {
    const row = document.createElement('tr')
    row.append(td('暂无参数'), td(''))
    tbody.append(row)
    return
  }
  for (const [name, value] of entries) {
    const row = document.createElement('tr')
    row.append(td(name), td(value))
    tbody.append(row)
  }
}

function renderSpecs(selectedSpecs, groups) {
  const selectedRoot = document.querySelector('#selectedSpecs')
  const groupRoot = document.querySelector('#specGroups')
  selectedRoot.replaceChildren()
  groupRoot.replaceChildren()

  if (selectedSpecs.length) {
    for (const spec of selectedSpecs) {
      const item = document.createElement('span')
      item.textContent = `${spec.name}: ${spec.value}`
      selectedRoot.append(item)
    }
  } else {
    selectedRoot.append(emptyText('暂无当前选中规格'))
  }

  if (!groups.length) {
    groupRoot.append(emptyText('暂无规格组'))
    return
  }

  for (const group of groups) {
    const block = document.createElement('div')
    block.className = 'spec-group'
    const title = document.createElement('div')
    title.className = 'spec-title'
    title.textContent = group.name || '-'
    const options = document.createElement('div')
    options.className = 'options'
    for (const option of group.optionDetails || []) {
      const item = document.createElement('span')
      item.className = ['option', option.selected ? 'selected' : '', option.disabled ? 'disabled' : ''].filter(Boolean).join(' ')
      item.textContent = option.name
      options.append(item)
    }
    block.append(title, options)
    groupRoot.append(block)
  }
}

function setTab(name) {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === name)
  })
  for (const [panelName, panel] of Object.entries(panels)) {
    panel.classList.toggle('active', panelName === name)
  }
}

function setLoading(loading) {
  readButton.disabled = loading
  readButton.textContent = loading ? '读取中' : '读取'
}

function showNotice(message, error = false) {
  notice.hidden = false
  notice.textContent = message
  notice.classList.toggle('error', error)
}

function td(text) {
  const cell = document.createElement('td')
  cell.textContent = String(text ?? '')
  return cell
}

function emptyText(text) {
  const node = document.createElement('p')
  node.className = 'empty'
  node.textContent = text
  return node
}
