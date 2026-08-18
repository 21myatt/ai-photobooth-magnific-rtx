import { json, magnificFetch } from './_shared.js'

const DONE = new Set(['COMPLETED', 'FAILED', 'ERROR', 'CANCELLED', 'TIMED_OUT'])

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' })
  }

  try {
    const taskId = String(req.query?.taskId || '').trim()
    if (!taskId) {
      return json(res, 400, { error: 'taskId is required' })
    }

    const result = await magnificFetch(`/ai/text-to-image/nano-banana-pro/${encodeURIComponent(taskId)}`, {
      method: 'GET',
    })
    const status = result?.data?.status || 'UNKNOWN'
    const imageUrl = result?.data?.generated?.[0] || null
    const error = result?.data?.error || result?.error || null

    return json(res, 200, {
      ok: true,
      taskId,
      status,
      done: DONE.has(status),
      imageUrl,
      error,
      result,
    })
  } catch (error) {
    return json(res, 500, {
      error: error.message || String(error),
    })
  }
}
