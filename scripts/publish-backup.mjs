import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

const input = process.argv[2]

if (!input) {
  console.error('Usage: npm run publish:backup -- path/to/aov-marketplace-backup.json')
  process.exit(1)
}

const raw = await readFile(input, 'utf8')
const backup = JSON.parse(raw)
const catalogDir = join(process.cwd(), 'public', 'catalog')
const imageDir = join(catalogDir, 'images')

await rm(imageDir, { recursive: true, force: true })
await mkdir(imageDir, { recursive: true })

const products = []

for (const product of backup.products || []) {
  const image = backup.images?.[product.imageKey]
  let imageUrl = ''

  if (image?.dataUrl) {
    const mimeMatch = image.dataUrl.match(/^data:(.+);base64,(.+)$/)
    if (mimeMatch) {
      const mime = mimeMatch[1]
      const base64 = mimeMatch[2]
      const extFromName = extname(image.name || '').replace('.', '')
      const extFromMime = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'png'
      const ext = extFromName || extFromMime
      const fileName = `${product.imageKey}.${ext}`
      await writeFile(join(imageDir, fileName), Buffer.from(base64, 'base64'))
      imageUrl = `./catalog/images/${fileName}`
    }
  }

  products.push({
    ...product,
    imageUrl,
  })
}

await writeFile(
  join(catalogDir, 'products.json'),
  `${JSON.stringify({ updatedAt: new Date().toISOString(), products }, null, 2)}\n`,
)

console.log(`Published ${products.length} products to public/catalog`)
