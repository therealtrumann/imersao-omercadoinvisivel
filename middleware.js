/**
 * A/B Test Middleware — Vercel Edge
 *
 * Intercepta GET / e serve v1 (rosa) ou v2 (vermelho) com 50/50 de chance.
 * Persiste a variante em cookie por 7 dias.
 * Quando Vercel KV sinalizar um vencedor, todos passam a ver o vencedor.
 */

export const config = {
  matcher: ['/']
}

export default async function middleware(request) {
  const kvUrl   = process.env.KV_REST_API_URL
  const kvToken = process.env.KV_REST_API_TOKEN
  const auth    = kvToken ? { Authorization: `Bearer ${kvToken}` } : null

  // ── 1. Checar se já há um vencedor ───────────────────────────
  let winner = null
  if (auth) {
    try {
      const r = await fetch(`${kvUrl}/get/ab_winner`, { headers: auth })
      const d = await r.json()
      if (d.result) winner = d.result
    } catch (_) {}
  }

  // ── 2. Determinar variante ───────────────────────────────────
  const cookieStr     = request.headers.get('cookie') || ''
  const cookieVariant = (cookieStr.match(/ab_variant=([ab])/) || [])[1]
  const isNew         = !cookieVariant && !winner

  const variant = winner ?? cookieVariant ?? (Math.random() < 0.5 ? 'a' : 'b')

  // ── 3. Buscar a página correta ───────────────────────────────
  const base    = new URL(request.url).origin
  const pageSrc = variant === 'b' ? `${base}/v2/index.html` : `${base}/index.html`

  const pageRes = await fetch(pageSrc)
  let html      = await pageRes.text()

  // Corrigir caminhos relativos do v2 (../asset → /asset)
  if (variant === 'b') {
    html = html
      .replace(/src="\.\.\/([^"]+)"/g,  'src="/$1"')
      .replace(/href="\.\.\/([^"]+)"/g, 'href="/$1"')
  }

  // ── 4. Montar response com cookie ───────────────────────────
  const headers = new Headers({
    'Content-Type'  : 'text/html; charset=utf-8',
    'Cache-Control' : 'no-store, no-cache, must-revalidate'
  })

  if (isNew) {
    headers.set('Set-Cookie',
      `ab_variant=${variant}; Path=/; Max-Age=604800; SameSite=Lax`)
  }

  return new Response(html, { status: 200, headers })
}
