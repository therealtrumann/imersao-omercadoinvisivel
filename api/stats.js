/**
 * GET /api/stats
 * Retorna o estado atual do teste A/B.
 * Acesse no browser para acompanhar o progresso.
 */

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  const kvUrl   = process.env.KV_REST_API_URL
  const kvToken = process.env.KV_REST_API_TOKEN

  if (!kvUrl || !kvToken) {
    return res.status(200).json({ error: 'Vercel KV não configurado. Veja as instruções de setup.' })
  }

  const auth = { Authorization: `Bearer ${kvToken}` }

  const [winRes, aRes, bRes] = await Promise.all([
    fetch(`${kvUrl}/get/ab_winner`,   { headers: auth }),
    fetch(`${kvUrl}/get/ab_conv_a`,   { headers: auth }),
    fetch(`${kvUrl}/get/ab_conv_b`,   { headers: auth })
  ])

  const [{ result: winner }, { result: rawA }, { result: rawB }] = await Promise.all([
    winRes.json(), aRes.json(), bRes.json()
  ])

  const convA = parseInt(rawA) || 0
  const convB = parseInt(rawB) || 0
  const total = convA + convB

  return res.status(200).json({
    status  : winner ? `✅ Concluído — Versão ${winner.toUpperCase()} venceu` : '🔄 Teste em andamento',
    winner  : winner || null,
    versaoA : { conversoes: convA, pagina: '/ (rosa)' },
    versaoB : { conversoes: convB, pagina: '/v2 (vermelho)' },
    total,
    faltam  : winner ? 0 : Math.max(0, 50 - total)
  })
}
