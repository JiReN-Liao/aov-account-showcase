import { requireAdmin } from '../../../_lib/auth.js'
import { writeAudit } from '../../../_lib/audit.js'
import { errorResponse, json, readJson } from '../../../_lib/http.js'
import { expectedVersion, normalizeProductInput } from '../../../_lib/products.js'

// Batch writes preserve the same optimistic-lock contract as the single-product API.
export async function onRequestPatch({ request, env }) {
  const auth = await requireAdmin(request, env)
  if (auth instanceof Response) return auth
  const body = await readJson(request)
  const operations = body.operations
  if (!Array.isArray(operations) || !operations.length || operations.length > 100) {
    return errorResponse('Provide 1 to 100 patch operations.', 400, 'INVALID_BATCH')
  }

  const statements = []
  const now = new Date().toISOString()
  try {
    for (const operation of operations) {
      const id = String(operation?.id || '')
      const version = expectedVersion(request, operation)
      if (!id || !version || !operation.patch || typeof operation.patch !== 'object') {
        throw new Error('Every operation needs id, expectedVersion, and patch.')
      }
      const current = await env.DB.prepare('SELECT * FROM products WHERE id = ?1 AND deleted_at IS NULL').bind(id).first()
      if (!current) throw new Error(`Product ${id} was not found.`)
      if (current.version !== version) throw new Error(`Product ${id} has changed. Reload before updating.`)
      const product = normalizeProductInput({ ...current, ...operation.patch, id })
      statements.push(env.DB.prepare(
        'UPDATE products SET code = ?1, title = ?2, description = ?3, price = ?4, status = ?5, note = ?6, image_key = ?7, sort_order = ?8, updated_at = ?9, version = version + 1 WHERE id = ?10 AND version = ?11 AND deleted_at IS NULL',
      ).bind(product.code, product.title, product.description, product.price, product.status, product.note, product.imageKey, product.sortOrder, now, id, version))
      statements.push(env.DB.prepare(
        'INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, version_before, version_after, metadata_json, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)',
      ).bind(crypto.randomUUID(), auth.id, 'product.batch_update', 'product', id, version, version + 1, JSON.stringify({ fields: Object.keys(operation.patch) }), now))
    }
  } catch (caught) {
    return errorResponse(caught.message, 409, 'BATCH_CONFLICT')
  }

  const results = await env.DB.batch(statements)
  if (results.some((result) => Number(result.meta?.changes || 0) === 0)) {
    return errorResponse('One or more products changed while the batch was saved.', 409, 'BATCH_CONFLICT')
  }
  await writeAudit(env, { actorId: auth.id, action: 'products.batch_update', entityType: 'product_batch', metadata: { count: operations.length } })
  return json({ ok: true, operations: operations.length })
}
