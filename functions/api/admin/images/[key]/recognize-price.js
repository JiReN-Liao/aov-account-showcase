import { requireAdmin } from '../../../../_lib/auth.js'
import { writeAudit } from '../../../../_lib/audit.js'
import { errorResponse, json } from '../../../../_lib/http.js'
import { mapProduct } from '../../../../_lib/products.js'
import { safeImageKey } from '../../../../_lib/uploads.js'

const MODEL = '@cf/llava-hf/llava-1.5-7b-hf'

export async function onRequestPost({ request, params, env }) {
  const auth = await requireAdmin(request, env)
  if (auth instanceof Response) return auth
  if (!env.AI) return errorResponse('Cloud price recognition is not configured.', 503, 'PRICE_RECOGNITION_UNAVAILABLE')

  const key = safeImageKey(params.key)
  if (!key) return errorResponse('Invalid image key.', 400, 'INVALID_IMAGE_KEY')
  const product = await env.DB.prepare(
    "SELECT products.* FROM products JOIN image_objects ON image_objects.key = products.image_key WHERE products.image_key = ?1 AND products.deleted_at IS NULL AND image_objects.deleted_at IS NULL AND image_objects.upload_status = 'ready'",
  ).bind(key).first()
  if (!product) return errorResponse('Ready product image not found.', 404, 'IMAGE_NOT_READY')
  const image = await env.AOV_STORE.get(`image:${key}`, 'arrayBuffer')
  if (!image) return errorResponse('Image not found.', 404, 'IMAGE_NOT_FOUND')

  let answer
  try {
    answer = await env.AI.run(MODEL, {
      image: Array.from(new Uint8Array(image)),
      prompt: 'Read the large, visually prominent SALE PRICE overlaid near the center of this game account image. Ignore game statistics, currencies, levels, hero counts, skin counts, dates, and numbers at the edges. If the overlay is a decimal such as 14.0 or 3.85, it means ten-thousands: return 140000 or 38500. If it says 自開, 貼換, exchange, negotiable, or has no numeric sale price, return NONE. Reply with exactly one integer or NONE and nothing else.',
      max_tokens: 20,
    })
  } catch {
    return errorResponse('Cloud price recognition failed.', 502, 'PRICE_RECOGNITION_FAILED')
  }

  const raw = String(answer?.description ?? answer?.response ?? answer?.result ?? answer ?? '').trim()
  const price = parseRecognizedPrice(raw)
  if (price == null) return json({ ok: true, recognized: false, price: null, raw: raw.slice(0, 120) })

  const now = new Date().toISOString()
  const result = await env.DB.prepare(
    'UPDATE products SET price = ?1, updated_at = ?2, version = version + 1 WHERE id = ?3 AND version = ?4 AND deleted_at IS NULL',
  ).bind(price, now, product.id, product.version).run()
  if (Number(result.meta?.changes || 0) !== 1) return errorResponse('Product changed while recognizing its price.', 409, 'VERSION_CONFLICT')
  await writeAudit(env, { actorId: auth.id, action: 'product.price_recognized', entityType: 'product', entityId: product.id, versionBefore: product.version, versionAfter: product.version + 1, metadata: { price, model: MODEL } })
  const updated = await env.DB.prepare('SELECT * FROM products WHERE id = ?1').bind(product.id).first()
  return json({ ok: true, recognized: true, price, product: mapProduct(updated) })
}

export function parseRecognizedPrice(value) {
  const text = String(value || '').trim().toUpperCase()
  if (!text || text.includes('NONE')) return null
  const decimal = text.match(/(?:^|\D)(\d{1,2}[.,]\d{1,2})(?:\D|$)/)
  const price = decimal ? Math.round(Number(decimal[1].replace(',', '.')) * 10_000) : Number(text.match(/\b\d{3,6}\b/)?.[0])
  return Number.isInteger(price) && price >= 300 && price <= 500_000 ? price : null
}
