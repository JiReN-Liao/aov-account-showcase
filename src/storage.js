export const defaultSettings = {
  siteName: 'AOV帳號展示所',
  adminUsers: [],
  contactMethods: [
    { id: 'line', label: 'LINE', url: '' },
    { id: 'facebook', label: 'Facebook', url: '' },
    { id: 'instagram', label: 'Instagram', url: '' },
  ],
}

async function requestJson(path, options = {}) {
  const response = await fetch(path, { cache: 'no-store', ...options })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.error || 'Request failed.')
    error.code = data.code
    error.status = response.status
    throw error
  }
  return data
}

export function loadProducts() {
  return []
}

export function loadCloudCatalog() {
  return requestJson('/api/catalog')
}

export async function loginAdmin(username, password) {
  return requestJson('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
}

export async function setupAdmin(username, password) {
  return requestJson('/api/admin/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
}

export function listAdminCatalog(token) {
  return requestJson('/api/admin/catalog', { headers: { Authorization: `Bearer ${token}` } })
}

export function createProducts(products, token) {
  return requestJson('/api/admin/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ products }),
  })
}

export function updateProduct(id, patch, version, token) {
  return requestJson(`/api/admin/products/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'If-Match': String(version) },
    body: JSON.stringify({ ...patch, expectedVersion: version }),
  })
}

export function updateProductStatus(id, status, version, token) {
  return requestJson(`/api/admin/products/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'If-Match': String(version) },
    body: JSON.stringify({ status, expectedVersion: version }),
  })
}

export function softDeleteProduct(id, version, token) {
  return requestJson(`/api/admin/products/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'If-Match': String(version) },
    body: JSON.stringify({ expectedVersion: version }),
  })
}

export function saveAdminSettings(settings, adminUsers, token) {
  return requestJson('/api/admin/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      siteName: settings.siteName,
      contactMethods: settings.contactMethods,
      adminUsers,
    }),
  })
}

export function loadSettings() {
  return defaultSettings
}

export async function putImage(imageKey, file, token) {
  return requestJson(`/api/images/${encodeURIComponent(imageKey)}`, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream', Authorization: `Bearer ${token}` },
    body: file,
  })
}

export function deleteImage(imageKey, token) {
  if (!imageKey) return Promise.resolve()
  return requestJson(`/api/images/${encodeURIComponent(imageKey)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
}
