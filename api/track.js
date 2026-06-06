/**
 * POST /api/track
 * Body: { "variant": "a" | "b" }
 *
 * Incrementa o contador da variante no Vercel KV.
 * Quando total >= 50, determina o vencedor e grava em KV.
 * O middleware passa a servir o vencedor para todos.
 */

const CONVERSION_THRESHOLD = 50

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' })

  // Parse body
  let variant
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    variant = body?.variant
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' })
  }

  if (!['a', 'b'].includes(variant)) {
    return res.status(400).json({ error: 'variant must be "a" or "b"' })
  }

  const kvUrl   = process.env.KV_REST_API_URL
  const kvToken = process.env.KV_REST_API_TOKEN

  if (!kvUrl || !kvToken) {
    return res.status(200).json({ ok: true, msg: 'KV não configurado — tracking desativado' })
  }

  const auth = { Authorization: `Bearer ${kvToken}` }

  // Checar vencedor já existente
  const winRes = await fetch(`${kvUrl}/get/ab_winner`, { headers: auth })
  const { result: existingWinner } = await winRes.json()

  if (existingWinner) {
    return res.status(200).json({
      ok: true,
      winner: existingWinner,
      msg: `Teste já concluído — Versão ${existingWinner.toUpperCase()} venceu`
    })
  }

  // Incrementar contador desta variante
  const incrRes              = await fetch(`${kvUrl}/incr/ab_conv_${variant}`, { headers: auth })
  const { result: thisCount } = await incrRes.json()

  // Ler contador da outra variante
  const other                  = variant === 'a' ? 'b' : 'a'
  const otherRes               = await fetch(`${kvUrl}/get/ab_conv_${other}`, { headers: auth })
  const { result: otherRaw }   = await otherRes.json()
  const otherCount             = parseInt(otherRaw) || 0

  const convA  = variant === 'a' ? thisCount : otherCount
  const convB  = variant === 'b' ? thisCount : otherCount
  const total  = convA + convB

  // Verificar se atingiu o threshold
  if (total >= CONVERSION_THRESHOLD) {
    const winner = convA >= convB ? 'a' : 'b'
    await fetch(`${kvUrl}/set/ab_winner/${winner}`, { headers: auth })

    return res.status(200).json({
      ok: true,
      winner,
      convA,
      convB,
      total,
      msg: `🏆 Teste concluído! Versão ${winner.toUpperCase()} venceu com ${winner === 'a' ? convA : convB} conversões`
    })
  }

  return res.status(200).json({
    ok: true,
    convA,
    convB,
    total,
    remaining: CONVERSION_THRESHOLD - total
  })
}
