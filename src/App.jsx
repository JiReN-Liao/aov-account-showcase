import { useEffect, useMemo, useState } from 'react'
import {
  clearImages,
  defaultSettings,
  deleteImage,
  getImage,
  loadProducts,
  loadSettings,
  putImage,
  resetLocalData,
  saveProducts,
  saveSettings,
} from './storage'

const STATUSES = {
  draft: { label: '草稿', chip: 'bg-zinc-600 text-zinc-100' },
  available: { label: '出售中', chip: 'bg-emerald-500 text-emerald-950' },
  reserved: { label: '洽談中', chip: 'bg-amber-400 text-amber-950' },
  sold: { label: '已售出', chip: 'bg-zinc-300 text-zinc-900' },
  hidden: { label: '隱藏', chip: 'bg-zinc-800 text-zinc-200' },
}

const PUBLIC_STATUSES = ['available', 'reserved', 'sold']
const currency = new Intl.NumberFormat('zh-TW')
const ADMIN_SESSION_KEY = 'aov-marketplace:admin-session:v1'

export default function App() {
  const [products, setProductsState] = useState(() => loadProducts())
  const [settings, setSettingsState] = useState(() => loadSettings())
  const [route, setRoute] = useState(() => parseRoute(window.location.hash))
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true')

  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute(window.location.hash))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const setProducts = (next) => {
    setProductsState((current) => {
      const resolved = typeof next === 'function' ? next(current) : next
      saveProducts(resolved)
      return resolved
    })
  }

  const setSettings = (next) => {
    setSettingsState((current) => {
      const resolved = typeof next === 'function' ? next(current) : next
      saveSettings(resolved)
      return resolved
    })
  }

  const pageProps = { products, settings, setProducts, setSettings }
  const loginAdmin = () => {
    sessionStorage.setItem(ADMIN_SESSION_KEY, 'true')
    setIsAdmin(true)
  }
  const logoutAdmin = () => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY)
    setIsAdmin(false)
    window.location.hash = '#/'
  }

  return (
    <div className="min-h-screen text-zinc-100">
      <Header settings={settings} isAdmin={isAdmin} onLogout={logoutAdmin} />
      {route.page === 'detail' ? (
        <DetailPage {...pageProps} productId={route.id} />
      ) : route.page === 'admin' ? (
        isAdmin ? <AdminPage {...pageProps} /> : <AdminAuthPage settings={settings} setSettings={setSettings} onLogin={loginAdmin} target="admin" />
      ) : route.page === 'settings' ? (
        isAdmin ? <SettingsPage {...pageProps} /> : <AdminAuthPage settings={settings} setSettings={setSettings} onLogin={loginAdmin} target="settings" />
      ) : (
        <HomePage {...pageProps} />
      )}
    </div>
  )
}

function parseRoute(hash) {
  const clean = hash.replace(/^#\/?/, '')
  const [page, id] = clean.split('/')
  if (page === 'product' && id) return { page: 'detail', id }
  if (page === 'admin') return { page: 'admin' }
  if (page === 'settings') return { page: 'settings' }
  return { page: 'home' }
}

function Header({ settings, isAdmin, onLogout }) {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800 bg-black/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-4">
        <a href="#/" className="min-w-0 truncate text-base font-black text-white sm:text-xl">
          {settings.siteName || defaultSettings.siteName}
        </a>
        <nav className="flex shrink-0 items-center gap-1 text-sm sm:gap-2">
          <NavLink href="#/">商品牆</NavLink>
          {isAdmin && (
            <>
              <NavLink href="#/admin">後台</NavLink>
              <NavLink href="#/settings">設定</NavLink>
              <button type="button" onClick={onLogout} className="rounded-md px-2 py-2 text-zinc-300 hover:bg-zinc-900 hover:text-white">
                登出
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}

function NavLink({ href, children }) {
  return (
    <a className="rounded-md px-2 py-2 text-zinc-300 hover:bg-zinc-900 hover:text-white" href={href}>
      {children}
    </a>
  )
}

function AdminAuthPage({ settings, setSettings, onLogin, target }) {
  const adminUsers = getAdminUsers(settings)
  const hasAdminAccount = adminUsers.length > 0
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = (event) => {
    event.preventDefault()
    setError('')

    if (!username.trim() || !password.trim()) {
      setError('請輸入管理員帳號與密碼。')
      return
    }

    if (!hasAdminAccount) {
      setSettings((current) => ({
        ...current,
        adminUsers: [{ id: crypto.randomUUID(), username: username.trim(), password }],
      }))
      onLogin()
      window.location.hash = `#/${target}`
      return
    }

    if (adminUsers.some((user) => user.username === username.trim() && user.password === password)) {
      onLogin()
      window.location.hash = `#/${target}`
      return
    }

    setError('帳號或密碼不正確。')
  }

  return (
    <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-md place-items-center px-3 py-8 sm:px-4">
      <form onSubmit={submit} className="w-full space-y-4 rounded-lg border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black">
        <div>
          <h1 className="text-2xl font-black">{hasAdminAccount ? '管理員登入' : '建立管理員帳號'}</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            {hasAdminAccount ? '登入後才能進入後台與設定頁。' : '第一次使用請先建立本機管理員帳號。'}
          </p>
          <p className="mt-2 rounded-md border border-amber-900 bg-amber-950/60 p-2 text-xs leading-5 text-amber-200">
            這是純前端本機 MVP 的簡單保護，不是正式後端登入。正式公開管理後台建議改用 Supabase Auth。
          </p>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-zinc-300">管理員帳號</span>
          <input
            className="h-11 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-zinc-300">管理員密碼</span>
          <input
            className="h-11 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={hasAdminAccount ? 'current-password' : 'new-password'}
          />
        </label>
        {error && <p className="rounded-md border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-200">{error}</p>}
        <button type="submit" className="h-11 w-full rounded-md bg-yellow-300 font-black text-zinc-950">
          {hasAdminAccount ? '登入後台' : '建立並登入'}
        </button>
      </form>
    </main>
  )
}

function HomePage({ products, settings }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('default')

  const visibleProducts = useMemo(() => {
    const search = query.trim().toLowerCase()
    const filtered = products
      .filter((product) => PUBLIC_STATUSES.includes(product.status))
      .filter((product) => {
        const target = [product.code, product.title, product.note].join(' ').toLowerCase()
        return (!search || target.includes(search)) && (status === 'all' || product.status === status)
      })

    return filtered.sort((a, b) => {
      if (sort === 'priceAsc') return Number(a.price || 0) - Number(b.price || 0)
      if (sort === 'priceDesc') return Number(b.price || 0) - Number(a.price || 0)
      if (sort === 'newest') return new Date(b.createdAt) - new Date(a.createdAt)
      return Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || a.code.localeCompare(b.code)
    })
  }, [products, query, status, sort])

  return (
    <main className="mx-auto max-w-7xl px-3 py-4 sm:px-4">
      <section className="mb-4 space-y-3">
        <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
          <input className="h-11 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-white placeholder:text-zinc-500" placeholder="搜尋商品編號、標題、備註" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select className="h-11 rounded-md border border-zinc-700 bg-zinc-950 px-3" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">全部狀態</option>
            <option value="available">出售中</option>
            <option value="reserved">洽談中</option>
            <option value="sold">已售出</option>
          </select>
          <select className="h-11 rounded-md border border-zinc-700 bg-zinc-950 px-3" value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="default">預設排序</option>
            <option value="priceAsc">價格低到高</option>
            <option value="priceDesc">價格高到低</option>
            <option value="newest">最新上架</option>
          </select>
        </div>
        <p className="text-sm text-zinc-400">目前顯示 {visibleProducts.length} 筆公開商品</p>
      </section>

      {visibleProducts.length ? (
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visibleProducts.map((product) => <ProductCard key={product.id} product={product} settings={settings} />)}
        </section>
      ) : (
        <EmptyState title="目前沒有符合條件的商品" text="可以調整搜尋、狀態或排序條件後再看看。" />
      )}
    </main>
  )
}

function ProductCard({ product, settings }) {
  const isSold = product.status === 'sold'
  return (
    <article className={`overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-lg shadow-black/30 ${isSold ? 'opacity-75' : ''}`}>
      <a href={`#/product/${product.id}`} className="relative block h-36 bg-black sm:h-44">
        <StoredImage imageKey={product.imageKey} alt={product.code} className="h-full w-full object-contain" />
        {isSold && <div className="absolute inset-0 grid place-items-center bg-black/60 text-lg font-black text-zinc-100">已售出</div>}
      </a>
      <div className="space-y-2 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <a href={`#/product/${product.id}`} className="truncate text-sm font-bold text-zinc-100">{product.code}</a>
          <StatusChip status={product.status} />
        </div>
        {product.title && <p className="line-clamp-1 text-xs text-zinc-400">{product.title}</p>}
        {formatPrice(product.price) && <p className="text-lg font-black text-yellow-300">{formatPrice(product.price)}</p>}
        <ContactButton product={product} settings={settings} compact />
      </div>
    </article>
  )
}

function DetailPage({ products, settings, productId }) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const product = products.find((item) => item.id === productId)

  if (!product || !PUBLIC_STATUSES.includes(product.status)) {
    return (
      <main className="mx-auto max-w-4xl px-3 py-6 sm:px-4">
        <EmptyState title="找不到公開商品" text="這筆商品可能還是草稿、已隱藏，或已被刪除。" />
        <a href="#/" className="mt-4 inline-flex rounded-md bg-zinc-100 px-4 py-2 font-bold text-zinc-950">返回商品列表</a>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4">
      <a href="#/" className="mb-3 inline-flex rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200">返回商品列表</a>
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <button type="button" onClick={() => setPreviewOpen(true)} className="min-h-[60vh] overflow-hidden rounded-lg border border-zinc-800 bg-black p-2">
          <StoredImage imageKey={product.imageKey} alt={product.code} className="h-full max-h-[78vh] w-full object-contain" />
        </button>
        <aside className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-zinc-400">商品編號</p>
              <h1 className="text-2xl font-black">{product.code}</h1>
            </div>
            <StatusChip status={product.status} />
          </div>
          {product.title && <p className="text-lg font-bold text-zinc-200">{product.title}</p>}
          {formatPrice(product.price) && <p className="text-3xl font-black text-yellow-300">{formatPrice(product.price)}</p>}
          {product.note && (
            <div>
              <h2 className="mb-2 text-sm font-bold text-zinc-300">備註</h2>
              <p className="whitespace-pre-wrap rounded-md bg-zinc-900 p-3 text-sm leading-6 text-zinc-200">{product.note}</p>
            </div>
          )}
          <ContactButton product={product} settings={settings} />
        </aside>
      </section>
      {previewOpen && <ImagePreview imageKey={product.imageKey} alt={product.code} onClose={() => setPreviewOpen(false)} />}
    </main>
  )
}

function AdminPage({ products, settings, setProducts, setSettings }) {
  const [message, setMessage] = useState('')
  const [previewProduct, setPreviewProduct] = useState(null)

  const nextCodeNumber = () => products.reduce((max, product) => {
    const match = product.code?.match(/AOV-(\d+)/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0) + 1

  const handleUpload = async (event) => {
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith('image/'))
    if (!files.length) return
    const now = new Date().toISOString()
    const start = nextCodeNumber()
    const created = []

    for (const [index, file] of files.entries()) {
      const id = crypto.randomUUID()
      const code = `AOV-${String(start + index).padStart(3, '0')}`
      const imageKey = `image-${id}`
      await putImage(imageKey, file)
      created.push({ id, code, title: '', price: '', status: 'draft', note: '', imageKey, contactUrl: '', sortOrder: products.length + index + 1, createdAt: now, updatedAt: now })
    }

    setProducts([...products, ...created])
    setMessage(`已新增 ${created.length} 筆草稿商品，可在下方批量編輯後發布。`)
    event.target.value = ''
  }

  const updateProduct = (id, patch) => {
    const now = new Date().toISOString()
    setProducts((current) => current.map((product) => (product.id === id ? { ...product, ...patch, updatedAt: now } : product)))
  }

  const publishDrafts = () => {
    const drafts = products.filter((product) => product.status === 'draft')
    if (!drafts.length) {
      setMessage('目前沒有草稿商品需要上架。')
      return
    }
    if (!confirm(`確定將 ${drafts.length} 筆草稿商品一鍵上架為出售中？`)) return

    const now = new Date().toISOString()
    setProducts((current) =>
      current.map((product) =>
        product.status === 'draft' ? { ...product, status: 'available', updatedAt: now } : product,
      ),
    )
    setMessage(`已一鍵上架 ${drafts.length} 筆草稿商品。`)
  }

  const removeProduct = async (product) => {
    if (!confirm(`確定刪除 ${product.code}？圖片與商品資料都會移除。`)) return
    await deleteImage(product.imageKey)
    setProducts((current) => current.filter((item) => item.id !== product.id))
  }

  const clearAll = async () => {
    if (!confirm('確定清空全部測試資料？這會刪除 localStorage 商品資料與 IndexedDB 圖片。')) return
    resetLocalData()
    await clearImages()
    setProducts([])
    setMessage('已清空全部測試資料。')
  }

  const exportBackup = async () => {
    const images = {}
    for (const product of products) {
      const record = await getImage(product.imageKey)
      if (record?.blob) {
        images[product.imageKey] = {
          dataUrl: await blobToDataUrl(record.blob),
          name: record.name,
          type: record.type,
          size: record.size,
        }
      }
    }

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings,
      products,
      images,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `aov-marketplace-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const importBackup = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!confirm('匯入備份會覆蓋目前本機商品、設定與圖片，確定繼續？')) {
      event.target.value = ''
      return
    }

    const payload = JSON.parse(await file.text())
    await clearImages()
    const imageEntries = Object.entries(payload.images || {})
    for (const [imageKey, image] of imageEntries) {
      const blob = dataUrlToBlob(image.dataUrl)
      await putImage(imageKey, new File([blob], image.name || imageKey, { type: image.type || blob.type }))
    }
    setSettings({ ...defaultSettings, ...(payload.settings || {}) })
    setProducts(Array.isArray(payload.products) ? payload.products : [])
    setMessage(`已匯入備份：${Array.isArray(payload.products) ? payload.products.length : 0} 筆商品。`)
    event.target.value = ''
  }

  return (
    <main className="mx-auto max-w-7xl px-3 py-4 sm:px-4">
      <section className="mb-4 grid gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4 lg:grid-cols-[1fr_auto]">
        <div>
          <h1 className="text-2xl font-black">管理後台</h1>
          <p className="mt-1 text-sm text-zinc-400">批量上傳圖片會自動建立草稿商品，圖片存 IndexedDB，文字資料存 localStorage。純靜態部署，第一版沒有伺服器費用。</p>
          {hasContactMethods(settings) ? <p className="mt-2 text-sm text-zinc-300">目前已有聯絡方式可供買家選擇。</p> : <p className="mt-2 text-sm text-amber-300">尚未設定聯絡方式，請到設定頁填入 LINE、Facebook 或 Instagram 連結。</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer rounded-md bg-yellow-300 px-4 py-2 font-black text-zinc-950">
            批量上傳圖片
            <input className="hidden" type="file" accept="image/*" multiple onChange={handleUpload} />
          </label>
          <button type="button" onClick={publishDrafts} className="rounded-md bg-emerald-400 px-4 py-2 font-black text-emerald-950">
            一鍵上架
          </button>
          <a href="#/settings" className="rounded-md border border-zinc-700 px-4 py-2 font-bold text-zinc-100">設定聯絡網址</a>
          <button type="button" onClick={exportBackup} className="rounded-md border border-zinc-700 px-4 py-2 font-bold text-zinc-100">匯出備份</button>
          <label className="cursor-pointer rounded-md border border-zinc-700 px-4 py-2 font-bold text-zinc-100">
            匯入備份
            <input className="hidden" type="file" accept="application/json" onChange={importBackup} />
          </label>
          <button type="button" onClick={clearAll} className="rounded-md border border-red-800 px-4 py-2 font-bold text-red-300">清空測試資料</button>
        </div>
      </section>

      {message && <p className="mb-3 rounded-md border border-emerald-800 bg-emerald-950 px-3 py-2 text-sm text-emerald-200">{message}</p>}

      {products.length ? (
        <section className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-zinc-900 text-xs uppercase text-zinc-400">
              <tr>
                <th className="px-3 py-3">圖片</th>
                <th className="px-3 py-3">編號</th>
                <th className="px-3 py-3">標題</th>
                <th className="px-3 py-3">價格</th>
                <th className="px-3 py-3">狀態</th>
                <th className="px-3 py-3">備註</th>
                <th className="px-3 py-3">排序</th>
                <th className="px-3 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {products.slice().sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)).map((product) => (
                <AdminRow key={product.id} product={product} updateProduct={updateProduct} removeProduct={removeProduct} openPreview={setPreviewProduct} />
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <EmptyState title="尚未建立商品" text="點擊批量上傳圖片後，每張圖片會自動變成一筆草稿商品。" />
      )}
      {previewProduct && (
        <ImagePreview
          imageKey={previewProduct.imageKey}
          alt={previewProduct.code}
          onClose={() => setPreviewProduct(null)}
        />
      )}
    </main>
  )
}

function AdminRow({ product, updateProduct, removeProduct, openPreview }) {
  return (
    <tr className="align-top">
      <td className="px-3 py-3">
        <button
          type="button"
          className="h-20 w-20 overflow-hidden rounded-md bg-black ring-1 ring-zinc-800 transition hover:ring-yellow-300"
          onClick={() => openPreview(product)}
          aria-label={`放大查看 ${product.code} 圖片`}
          title="點擊放大查看"
        >
          <StoredImage imageKey={product.imageKey} alt={product.code} className="h-full w-full object-contain" />
        </button>
      </td>
      <td className="px-3 py-3 font-bold text-zinc-100">{product.code}</td>
      <td className="px-3 py-3"><input className="w-36 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-2" value={product.title} onChange={(event) => updateProduct(product.id, { title: event.target.value })} /></td>
      <td className="px-3 py-3"><input className="w-28 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-2" inputMode="numeric" value={product.price} onChange={(event) => updateProduct(product.id, { price: event.target.value.replace(/[^\d]/g, '') })} /></td>
      <td className="px-3 py-3">
        <select className="w-28 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-2" value={product.status} onChange={(event) => updateProduct(product.id, { status: event.target.value })}>
          {Object.entries(STATUSES).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
        </select>
      </td>
      <td className="px-3 py-3"><textarea className="h-24 w-52 resize-none rounded-md border border-zinc-700 bg-zinc-900 px-2 py-2" value={product.note} onChange={(event) => updateProduct(product.id, { note: event.target.value })} /></td>
      <td className="px-3 py-3"><input className="w-20 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-2" inputMode="numeric" value={product.sortOrder} onChange={(event) => updateProduct(product.id, { sortOrder: event.target.value.replace(/[^\d]/g, '') })} /></td>
      <td className="space-y-2 px-3 py-3">
        <div className="flex flex-wrap gap-1">
          {['available', 'reserved', 'sold', 'hidden'].map((status) => <QuickStatus key={status} product={product} updateProduct={updateProduct} status={status} />)}
        </div>
        {PUBLIC_STATUSES.includes(product.status) && <a className="inline-flex rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200" href={`#/product/${product.id}`}>查看</a>}
        <button type="button" onClick={() => removeProduct(product)} className="ml-1 rounded-md border border-red-800 px-2 py-1 text-xs text-red-300">刪除</button>
      </td>
    </tr>
  )
}

function QuickStatus({ product, updateProduct, status }) {
  return <button type="button" onClick={() => updateProduct(product.id, { status })} className={`rounded px-2 py-1 text-xs ${product.status === status ? 'bg-yellow-300 text-zinc-950' : 'bg-zinc-800 text-zinc-300'}`}>{STATUSES[status].label}</button>
}

function SettingsPage({ settings, setSettings }) {
  const [draft, setDraft] = useState(settings)
  const [adminUsersDraft, setAdminUsersDraft] = useState(() =>
    getAdminUsers(settings).map((user) => ({ ...user, passwordDraft: '' })),
  )
  const [saved, setSaved] = useState(false)

  const updateContactMethod = (index, patch) => {
    setDraft((current) => ({
      ...current,
      contactMethods: current.contactMethods.map((method, methodIndex) =>
        methodIndex === index ? { ...method, ...patch } : method,
      ),
    }))
  }

  const submit = (event) => {
    event.preventDefault()
    const adminUsers = adminUsersDraft
      .map((user) => ({
        id: user.id || crypto.randomUUID(),
        username: user.username.trim(),
        password: user.passwordDraft || user.password,
      }))
      .filter((user) => user.username && user.password)

    if (!adminUsers.length) {
      alert('至少需要保留一位管理員。')
      return
    }

    setSettings({
      ...draft,
      adminUsers,
    })
    setAdminUsersDraft(adminUsers.map((user) => ({ ...user, passwordDraft: '' })))
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  const addAdminUser = () => {
    setAdminUsersDraft((current) => [
      ...current,
      { id: crypto.randomUUID(), username: '', password: '', passwordDraft: '' },
    ])
  }

  const updateAdminUser = (id, patch) => {
    setAdminUsersDraft((current) => current.map((user) => (user.id === id ? { ...user, ...patch } : user)))
  }

  const removeAdminUser = (id) => {
    setAdminUsersDraft((current) => {
      if (current.length <= 1) {
        alert('至少需要保留一位管理員。')
        return current
      }
      return current.filter((user) => user.id !== id)
    })
  }

  return (
    <main className="mx-auto max-w-3xl px-3 py-4 sm:px-4">
      <form onSubmit={submit} className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
        <div>
          <h1 className="text-2xl font-black">設定頁</h1>
          <p className="mt-1 text-sm text-zinc-400">這裡設定三個聯絡方式。買家點擊聯絡購買後，會先選擇想用哪個平台聯絡。</p>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-zinc-300">網站名稱</span>
          <input className="h-11 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3" value={draft.siteName} onChange={(event) => setDraft({ ...draft, siteName: event.target.value })} />
        </label>
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-zinc-300">聯絡方式</h2>
          {draft.contactMethods.map((method, index) => (
            <div key={method.id} className="grid gap-2 rounded-md border border-zinc-800 bg-zinc-900/60 p-3 sm:grid-cols-[9rem_1fr]">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-zinc-400">名稱</span>
                <input
                  className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3"
                  value={method.label}
                  onChange={(event) => updateContactMethod(index, { label: event.target.value })}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-zinc-400">網址</span>
                <input
                  className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3"
                  value={method.url}
                  onChange={(event) => updateContactMethod(index, { url: event.target.value })}
                  placeholder="https://line.me/... 或 https://facebook.com/..."
                />
              </label>
            </div>
          ))}
        </div>
        <div className="space-y-3 rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-zinc-300">管理員帳號</h2>
            <button type="button" onClick={addAdminUser} className="rounded-md bg-zinc-100 px-3 py-2 text-sm font-black text-zinc-950">
              新增管理員
            </button>
          </div>
          <div className="space-y-3">
            {adminUsersDraft.map((user, index) => (
              <div key={user.id} className="grid gap-2 rounded-md border border-zinc-800 bg-zinc-950 p-3 sm:grid-cols-[1fr_1fr_auto]">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-zinc-400">帳號</span>
                  <input
                    className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3"
                    value={user.username}
                    onChange={(event) => updateAdminUser(user.id, { username: event.target.value })}
                    autoComplete={index === 0 ? 'username' : 'off'}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-zinc-400">新密碼</span>
                  <input
                    className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3"
                    type="password"
                    value={user.passwordDraft}
                    onChange={(event) => updateAdminUser(user.id, { passwordDraft: event.target.value })}
                    placeholder={user.password ? '留空代表不變更' : '新管理員必填'}
                    autoComplete="new-password"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removeAdminUser(user.id)}
                  className="self-end rounded-md border border-red-800 px-3 py-2 text-sm font-bold text-red-300"
                >
                  刪除
                </button>
              </div>
            ))}
          </div>
        </div>
        <button type="submit" className="rounded-md bg-yellow-300 px-4 py-2 font-black text-zinc-950">儲存設定</button>
        {saved && <p className="text-sm text-emerald-300">已儲存設定。</p>}
      </form>
    </main>
  )
}

function StoredImage({ imageKey, alt, className, style }) {
  const [src, setSrc] = useState('')

  useEffect(() => {
    let url = ''
    let alive = true
    setSrc('')
    getImage(imageKey).then((record) => {
      if (!alive || !record?.blob) return
      url = URL.createObjectURL(record.blob)
      setSrc(url)
    })
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [imageKey])

  if (!src) return <div className={`${className} grid place-items-center text-xs text-zinc-600`} style={style}>無圖片</div>
  return <img src={src} alt={alt} className={className} style={style} loading="lazy" />
}

function ImagePreview({ imageKey, alt, onClose }) {
  const [zoom, setZoom] = useState('fit')

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 bg-black/95">
      <div className="fixed left-0 right-0 top-0 z-10 flex items-center justify-end gap-2 border-b border-zinc-800 bg-black/90 p-3 backdrop-blur">
        {[
          ['fit', '完整'],
          [100, '100%'],
          [150, '150%'],
          [200, '200%'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setZoom(value)}
            className={`rounded-md px-3 py-2 text-sm font-bold ${
              zoom === value ? 'bg-yellow-300 text-zinc-950' : 'bg-zinc-800 text-zinc-100'
            }`}
          >
            {label}
          </button>
        ))}
        <button type="button" onClick={onClose} className="rounded-md bg-zinc-100 px-3 py-2 font-bold text-zinc-950">
          關閉
        </button>
      </div>
      <div className="h-dvh overflow-auto px-3 pb-8 pt-20">
        <div className="mx-auto flex min-h-[calc(100dvh-7rem)] min-w-full items-center justify-center">
          <StoredImage
            imageKey={imageKey}
            alt={alt}
            className="block rounded-sm object-contain"
            style={
              zoom === 'fit'
                ? {
                    maxWidth: 'calc(100vw - 1.5rem)',
                    maxHeight: 'calc(100dvh - 7rem)',
                    width: 'auto',
                    height: 'auto',
                  }
                : {
                    width: `calc(${zoom}vw - 2rem)`,
                    maxWidth: 'none',
                    height: 'auto',
                  }
            }
          />
        </div>
      </div>
    </div>
  )
}

function StatusChip({ status }) {
  const meta = STATUSES[status] || STATUSES.draft
  return <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-black ${meta.chip}`}>{meta.label}</span>
}

function ContactButton({ product, settings, compact = false }) {
  const [open, setOpen] = useState(false)
  const methods = getContactMethods(settings)
  const disabled = !methods.some((method) => method.url) || product.status === 'sold'
  const label = product.status === 'sold' ? '已售出' : '聯絡購買'

  if (disabled) return <button type="button" disabled className={`${compact ? 'h-9 text-sm' : 'h-11'} w-full rounded-md bg-zinc-800 font-black text-zinc-500`}>{label}</button>
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${compact ? 'h-9 text-sm' : 'h-11'} flex w-full items-center justify-center rounded-md bg-yellow-300 font-black text-zinc-950 hover:bg-yellow-200`}
      >
        {label}
      </button>
      {open && <ContactModal product={product} methods={methods} onClose={() => setOpen(false)} />}
    </>
  )
}

function ContactModal({ product, methods, onClose }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4">
      <div className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-zinc-100">選擇聯絡方式</h2>
            <p className="mt-1 text-sm text-zinc-400">商品編號：{product.code}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md bg-zinc-800 px-3 py-2 text-sm font-bold text-zinc-100">
            關閉
          </button>
        </div>
        <div className="space-y-2">
          {methods.map((method) =>
            method.url ? (
              <a
                key={method.id}
                href={buildContactUrl(method.url, product.code)}
                target="_blank"
                rel="noreferrer"
                className="flex h-12 items-center justify-between rounded-md border border-zinc-700 bg-zinc-900 px-3 font-black text-zinc-100 hover:border-yellow-300 hover:text-yellow-300"
              >
                <span>{method.label || '聯絡方式'}</span>
                <span className="text-sm text-zinc-500">詢問 {product.code}</span>
              </a>
            ) : (
              <button
                key={method.id}
                type="button"
                disabled
                className="flex h-12 w-full items-center justify-between rounded-md border border-zinc-800 bg-zinc-900/50 px-3 font-black text-zinc-600"
              >
                <span>{method.label || '聯絡方式'}</span>
                <span className="text-sm">未設定</span>
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  )
}

function getContactMethods(settings) {
  if (Array.isArray(settings.contactMethods)) {
    return settings.contactMethods
  }

  return defaultSettings.contactMethods.map((method, index) => ({
    ...method,
    url: index === 0 ? settings.defaultContactUrl || '' : '',
  }))
}

function hasContactMethods(settings) {
  return getContactMethods(settings).some((method) => method.url)
}

function getAdminUsers(settings) {
  if (Array.isArray(settings.adminUsers) && settings.adminUsers.length) {
    return settings.adminUsers
  }

  if (settings.adminUsername && settings.adminPassword) {
    return [{ id: 'admin-1', username: settings.adminUsername, password: settings.adminPassword }]
  }

  return []
}

function buildContactUrl(url, code) {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    parsed.searchParams.set('text', `你好，我想詢問商品 ${code}`)
    return parsed.toString()
  } catch {
    return url
  }
}

function formatPrice(price) {
  const value = Number(price || 0)
  return value > 0 ? `NT$${currency.format(value)}` : ''
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function dataUrlToBlob(dataUrl) {
  const [meta, data] = dataUrl.split(',')
  const mime = meta.match(/data:(.*);base64/)?.[1] || 'application/octet-stream'
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new Blob([bytes], { type: mime })
}

function EmptyState({ title, text }) {
  return (
    <section className="rounded-lg border border-dashed border-zinc-700 bg-zinc-950 p-8 text-center">
      <h2 className="text-xl font-black text-zinc-100">{title}</h2>
      <p className="mt-2 text-sm text-zinc-400">{text}</p>
    </section>
  )
}
