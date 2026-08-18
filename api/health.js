import { json, MAGNIFIC_API_BASE } from './_shared.js'

export default function handler(_req, res) {
  json(res, 200, {
    ok: true,
    apiKeyPresent: Boolean(process.env.MAGNIFIC_API_KEY),
    webhookSecretPresent: Boolean(process.env.MAGNIFIC_WEBHOOK_SIGNING_SECRET),
    apiBase: MAGNIFIC_API_BASE,
  })
}
