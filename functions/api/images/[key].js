import { requireAdmin } from '../../_lib/auth.js'
import { writeAudit } from '../../_lib/audit.js'
import { errorResponse, json } from '../../_lib/http.js'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024

function safeKey(value) {
  const key = String(value || '')
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,239}$/.test(key) ? key : ''
}

export async function onRequestGet({ params, env }) {
  const key = safeKey(params.key)
  if (!key) return errorResponse('Invalid image key.', 400, 'INVALID_IMAGE_KEY')
  const [body, metadata] = await Promise.all([
    env.AOV_STORE.get(storageKey(key), 'arrayBuffer'),
    env.DB.prepare('SELECT content_type FROM image_objects WHERE key = ?1 AND deleted_at IS NULL').bind(key).first(),
  ])
  if (!body || !metadata) return errorResponse('Image not found.', 404, 'IMAGE_NOT_FOUND')
  return new Response(body, { headers: { 'Content-Type': metadata.content_type, 'Cache-Control': 'public, max-age=31536000, immutable' } })
}

export async function onRequestPut({ request, params, env }) {
  const auth = await requireAdmin(request, env)
  if (auth instanceof Response) return auth
  const key = safeKey(params.key)
  const contentType = request.headers.get('Content-Type') || ''
  const length = Number(request.headers.get('Content-Length') || 0)
  if (!key) return errorResponse('Invalid image key.', 400, 'INVALID_IMAGE_KEY')
  if (!contentType.startsWith('image/')) return errorResponse('Only image uploads are allowed.', 415, 'INVALID_IMAGE_TYPE')
  if (length > MAX_IMAGE_BYTES) return errorResponse('Image is too large. Maximum size is 10 MB.', 413, 'IMAGE_TOO_LARGE')
  const body = await request.arrayBuffer()
  if (!body.byteLength) return errorResponse('Image body is required.', 400, 'IMAGE_REQUIRED')
  if (body.byteLength > MAX_IMAGE_BYTES) return errorResponse('Image is too large. Maximum size is 10 MB.', 413, 'IMAGE_TOO_LARGE')

  const now = new Date().toISOString()
  try {
    // D1 reserves the key before the KV write, so a key cannot be replaced or reused.
    await env.DB.prepare(
      'INSERT INTO image_objects (key, content_type, size, uploaded_by, created_at) VALUES (?1, ?2, ?3, ?4, ?5)',
    ).bind(key, contentType, body.byteLength, auth.id, now).run()
  } catch {
    return errorResponse('Image keys are immutable and cannot be reused.', 409, 'IMMUTABLE_IMAGE_KEY')
  }
  try {
    await env.AOV_STORE.put(storageKey(key), body)
  } catch {
    await env.DB.prepare('DELETE FROM image_objects WHERE key = ?1').bind(key).run()
    return errorResponse('Cloud image upload failed.', 502, 'IMAGE_UPLOAD_FAILED')
  }
  await writeAudit(env, { actorId: auth.id, action: 'image.upload', entityType: 'image', entityId: key, metadata: { size: body.byteLength, contentType } })
  return json({ ok: true, imageKey: key, imageUrl: `/api/images/${encodeURIComponent(key)}` }, { status: 201 })
}

export async function onRequestDelete({ request, params, env }) {
  const auth = await requireAdmin(request, env)
  if (auth instanceof Response) return auth
  const key = safeKey(params.key)
  if (!key) return errorResponse('Invalid image key.', 400, 'INVALID_IMAGE_KEY')
  await env.AOV_STORE.delete(storageKey(key))
  await env.DB.prepare('UPDATE image_objects SET deleted_at = ?1 WHERE key = ?2 AND deleted_at IS NULL').bind(new Date().toISOString(), key).run()
  await writeAudit(env, { actorId: auth.id, action: 'image.delete', entityType: 'image', entityId: key })
  return json({ ok: true, imageKey: key })
}

function storageKey(key) {
  return `image:${key}`
}
