import { json, readJson, magnificFetch } from './_shared.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' })
  }

  try {
    const body = await readJson(req)
    const prompt = String(body.prompt || '').trim()
    const aspectRatio = String(body.aspectRatio || '16:9')
    const referenceImages = Array.isArray(body.referenceImages) ? body.referenceImages : []

    if (!prompt) {
      return json(res, 400, { error: 'prompt is required' })
    }

    const payload = {
      prompt,
      aspect_ratio: aspectRatio,
      resolution: '1K',
    }

    if (referenceImages.length) {
      payload.reference_images = referenceImages
    }

    const result = await magnificFetch('/ai/text-to-image/nano-banana-pro', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    const taskId = result?.data?.task_id

    if (!taskId) {
      return json(res, 502, {
        error: 'Magnific did not return a task id',
        result,
      })
    }

    return json(res, 200, {
      ok: true,
      taskId,
      result,
    })
  } catch (error) {
    return json(res, 500, {
      error: error.message || String(error),
    })
  }
}
