let cachedBsvPrice: { usd: number; at: number } | null = null
export const FALLBACK_BSV_PRICE_USD = 40

export async function getBsvPriceUsd() {
  const now = Date.now()
  if (cachedBsvPrice && now - cachedBsvPrice.at < 60_000) return cachedBsvPrice.usd

  let usd: number | null = null
  const geckoRes = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin-sv&vs_currencies=usd",
    { headers: { "User-Agent": "bountybee/1.0" } },
  )
  if (geckoRes.ok) {
    const data = (await geckoRes.json().catch(() => null)) as any
    const value = Number(data?.["bitcoin-sv"]?.usd)
    if (Number.isFinite(value) && value > 0) usd = value
  }

  if (!usd) {
    const paprikaRes = await fetch("https://api.coinpaprika.com/v1/tickers/bsv-bitcoin-sv", {
      headers: { "User-Agent": "bountybee/1.0" },
    })
    if (paprikaRes.ok) {
      const data = (await paprikaRes.json().catch(() => null)) as any
      const value = Number(data?.quotes?.USD?.price)
      if (Number.isFinite(value) && value > 0) usd = value
    }
  }

  if (!usd) {
    if (cachedBsvPrice) return cachedBsvPrice.usd
    return FALLBACK_BSV_PRICE_USD
  }

  cachedBsvPrice = { usd, at: now }
  return usd
}

export function usdToSats(usd: number, bsvPriceUsd: number) {
  if (!Number.isFinite(usd) || usd <= 0) return 0
  if (!Number.isFinite(bsvPriceUsd) || bsvPriceUsd <= 0) throw new Error("Invalid BSV price")
  return Math.ceil((usd / bsvPriceUsd) * 100_000_000)
}

export function satsToUsd(sats: number, bsvPriceUsd: number) {
  if (!Number.isFinite(sats) || sats <= 0) return 0
  if (!Number.isFinite(bsvPriceUsd) || bsvPriceUsd <= 0) return 0
  return (sats / 100_000_000) * bsvPriceUsd
}
