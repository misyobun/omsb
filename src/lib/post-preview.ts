import { existsSync } from 'node:fs'
import { extractTargetBlocks, filePath } from './blog-helpers'
import { getAllBlocksByBlockId, getBlock, downloadFile } from './notion/client'
import type { Post } from './interfaces'

// Explicit featured images take precedence; only the homepage needs this fallback.
export async function getPostPreviewImage(post: Post): Promise<string> {
  if (post.FeaturedImage?.Url) return ''

  try {
    const blocks = await getAllBlocksByBlockId(post.PageId)
    const firstImage = extractTargetBlocks('image', blocks).find(
      (block) => block.Image?.External?.Url || block.Image?.File?.Url
    )
    if (!firstImage) return ''

    let image = firstImage.Image
    // Cached Notion blocks can contain expired signed download URLs.
    if (image.File && !(Date.parse(image.File.ExpiryTime || '') > Date.now())) {
      image = (await getBlock(firstImage.Id)).Image
    }
    const source = image?.External?.Url || image?.File?.Url
    if (!source) return ''
    const url = new URL(source)
    if (!['https:', 'http:'].includes(url.protocol)) return ''

    if (image.External || import.meta.env.DEV) return url.toString()

    // Persist Notion uploads so the published thumbnail does not expire.
    await downloadFile(url)
    const [directory, filename] = url.pathname.split('/').slice(-2)
    const localFile = `public/notion/${directory}/${decodeURIComponent(filename)}`
    return existsSync(localFile) ? filePath(url) : ''
  } catch {
    console.warn(`Could not load the preview image for post ${post.Slug}`)
    return ''
  }
}
