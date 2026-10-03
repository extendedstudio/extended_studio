// Vercel Serverless Function: 네이버 블로그 최신 글 (RSS → JSON)
// GET /api/blog?limit=6
const BLOG_ID = 'extended-studio'
const RSS_URL = `https://rss.blog.naver.com/${BLOG_ID}.xml`

const decode = s => String(s || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))
  return m ? decode(m[1]).trim() : ''
}

export function parseRss(xml, limit = 6) {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || []
  return items.slice(0, limit).map(it => {
    const html = tag(it, 'description')
    const img = (html.match(/<img[^>]+src=["']([^"']+)["']/i) || [])[1] || ''
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const d = new Date(tag(it, 'pubDate'))
    return {
      title: tag(it, 'title'),
      link: tag(it, 'link').replace(/\?fromRss.*$/, ''),
      date: isNaN(d) ? '' : new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10), // KST
      category: tag(it, 'category'),
      thumb: img,
      excerpt: text.slice(0, 90),
    }
  }).filter(p => p.title && p.link)
}

export default async function handler(req, res) {
  const limit = Math.min(parseInt(req.query?.limit) || 6, 20)
  try {
    const r = await fetch(RSS_URL, { headers: { 'User-Agent': 'Mozilla/5.0 ExtendedStudioSite' } })
    if (!r.ok) throw new Error(`RSS ${r.status}`)
    const posts = parseRss(await r.text(), limit)
    // 1시간 캐시, 만료 후 하루 동안은 이전 결과를 보여주며 백그라운드 갱신
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
    return res.status(200).json({ blog: `https://blog.naver.com/${BLOG_ID}`, posts })
  } catch (e) {
    res.setHeader('Cache-Control', 's-maxage=300')
    return res.status(200).json({ blog: `https://blog.naver.com/${BLOG_ID}`, posts: [], error: String(e.message || e) })
  }
}
