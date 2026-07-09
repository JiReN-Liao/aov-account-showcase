const PRODUCT_KEY = 'aov-marketplace:products:v1'
const SETTINGS_KEY = 'aov-marketplace:settings:v1'
const DB_NAME = 'aov-marketplace-images'
const DB_VERSION = 1
const IMAGE_STORE = 'images'

export const defaultSettings = {
  siteName: 'AOV帳號展示所',
  adminUsers: [],
  contactMethods: [
    { id: 'line', label: 'LINE', url: '' },
    { id: 'facebook', label: 'Facebook', url: '' },
    { id: 'instagram', label: 'Instagram', url: '' },
  ],
}

export function loadProducts() {
  try {
    const raw = localStorage.getItem(PRODUCT_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export async function loadPublicCatalog() {
  try {
    const response = await fetch('./catalog/products.json', { cache: 'no-store' })
    if (!response.ok) return []
    const data = await response.json()
    return Array.isArray(data.products) ? data.products : []
  } catch {
    return []
  }
}

export function saveProducts(products) {
  localStorage.setItem(PRODUCT_KEY, JSON.stringify(products))
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return defaultSettings

    const parsed = JSON.parse(raw)
    const adminUsers = Array.isArray(parsed.adminUsers)
      ? parsed.adminUsers
      : parsed.adminUsername && parsed.adminPassword
        ? [{ id: 'admin-1', username: parsed.adminUsername, password: parsed.adminPassword }]
        : []
    const contactMethods = Array.isArray(parsed.contactMethods)
      ? defaultSettings.contactMethods.map((method, index) => ({
          ...method,
          ...(parsed.contactMethods[index] || {}),
        }))
      : defaultSettings.contactMethods.map((method, index) => ({
          ...method,
          url: index === 0 ? parsed.defaultContactUrl || '' : '',
        }))

    return { ...defaultSettings, ...parsed, adminUsers, contactMethods }
  } catch {
    return defaultSettings
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...defaultSettings, ...settings }))
}

function openImageDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        db.createObjectStore(IMAGE_STORE)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function withImageStore(mode, action) {
  return openImageDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(IMAGE_STORE, mode)
        const store = tx.objectStore(IMAGE_STORE)
        const request = action(store)

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
        tx.oncomplete = () => db.close()
        tx.onerror = () => {
          db.close()
          reject(tx.error)
        }
      }),
  )
}

export function putImage(imageKey, file) {
  return withImageStore('readwrite', (store) =>
    store.put(
      {
        blob: file,
        name: file.name,
        type: file.type,
        size: file.size,
        updatedAt: new Date().toISOString(),
      },
      imageKey,
    ),
  )
}

export function getImage(imageKey) {
  if (!imageKey) return Promise.resolve(null)
  return withImageStore('readonly', (store) => store.get(imageKey))
}

export function deleteImage(imageKey) {
  if (!imageKey) return Promise.resolve()
  return withImageStore('readwrite', (store) => store.delete(imageKey))
}

export function clearImages() {
  return withImageStore('readwrite', (store) => store.clear())
}

export function resetLocalData() {
  localStorage.removeItem(PRODUCT_KEY)
}
