import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const HAND_STABLE_FRAMES = 4
const COUNTDOWN_SECONDS = 3
const MEDIAPIPE_HANDS_VERSION = '0.4.1675469240'

function isFingerExtended(
  landmarks: Array<{ x: number; y: number }>,
  tip: number,
  pip: number,
) {
  return landmarks[tip].y < landmarks[pip].y
}

function isPeaceSign(landmarks: Array<{ x: number; y: number }>) {
  const indexExtended = isFingerExtended(landmarks, 8, 6)
  const middleExtended = isFingerExtended(landmarks, 12, 10)
  const ringFolded = !isFingerExtended(landmarks, 16, 14)
  const pinkyFolded = !isFingerExtended(landmarks, 20, 18)
  return indexExtended && middleExtended && ringFolded && pinkyFolded
}

function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const handsRef = useRef<any>(null)
  const rafRef = useRef<number | null>(null)
  const cameraStartTokenRef = useRef(0)
  const peaceFramesRef = useRef(0)
  const peaceLatchedRef = useRef(false)
  const peaceTriggeredRef = useRef(false)
  const awaitingReleaseRef = useRef(false)
  const countdownActiveRef = useRef(false)
  const countdownEndRef = useRef(0)
  const processingRef = useRef(false)

  const [ready, setReady] = useState(false)
  const [handsReady, setHandsReady] = useState(false)
  const [status, setStatus] = useState('idle')
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(true)
  const [countdownUntil, setCountdownUntil] = useState(0)
  const [countdownLabel, setCountdownLabel] = useState('')
  const [mode, setMode] = useState<'desktop' | 'mobile'>(
    window.matchMedia('(max-width: 768px)').matches ? 'mobile' : 'desktop',
  )

  const aspect = useMemo(() => '16 / 9', [])
  const appReady = ready && handsReady

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)')
    const onChange = () => setMode(media.matches ? 'mobile' : 'desktop')
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now()
      if (countdownActiveRef.current && countdownUntil > now) {
        const remaining = Math.ceil((countdownUntil - now) / 1000)
        setCountdownLabel(String(Math.max(1, remaining)))
        setStatus('ငြိမ်ငြိမ်နေပါ')
      } else if (appReady) {
        setStatus('ဓာတ်ပုံရိုက်ရန် လက်နှစ်ချောင်းထောင်ပါ')
      }
    }, 250)
    return () => window.clearInterval(timer)
  }, [appReady, countdownUntil])

  useEffect(() => {
    let cancelled = false

    async function startCamera() {
      const startToken = ++cameraStartTokenRef.current
      try {
        setStatus('preparing camera')
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('getUserMedia unavailable')
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        })

        if (cancelled || cameraStartTokenRef.current !== startToken) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setReady(true)
        setStatus('loading hand tracking')
      } catch {
        setStatus('camera error')
      }
    }

    startCamera()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !ready) return

    let alive = true
    let hands: any = null

    void (async () => {
      try {
        if (!(window as any).Hands) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector<HTMLScriptElement>(
              'script[data-mediapipe-hands="true"]',
            )
            if (existing) {
              existing.addEventListener('load', () => resolve(), { once: true })
              existing.addEventListener('error', () => reject(new Error('MediaPipe script failed to load')), { once: true })
              return
            }
            const script = document.createElement('script')
            script.src = `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${MEDIAPIPE_HANDS_VERSION}/hands.js`
            script.async = true
            script.defer = true
            script.dataset.mediapipeHands = 'true'
            script.onload = () => resolve()
            script.onerror = () => reject(new Error('MediaPipe script failed to load'))
            document.head.appendChild(script)
          })
        }

        const HandsCtor = (window as any).Hands ?? (window as any).Solution
        if (typeof HandsCtor !== 'function') {
          throw new Error('Hands global missing')
        }

        hands = new HandsCtor({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${MEDIAPIPE_HANDS_VERSION}/${file}`,
        })
        handsRef.current = hands
        hands.setOptions({
          selfieMode: true,
          maxNumHands: 1,
          modelComplexity: 0,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.7,
        })
        await hands.initialize()
        setHandsReady(true)
        setStatus('ဓာတ်ပုံရိုက်ရန် လက်နှစ်ချောင်းထောင်ပါ')

        hands.onResults((results: any) => {
          const landmarks = results.multiHandLandmarks?.[0]
          if (!landmarks) {
            peaceFramesRef.current = 0
            peaceLatchedRef.current = false
            if (awaitingReleaseRef.current) {
              awaitingReleaseRef.current = false
            }
            return
          }

          const peace = isPeaceSign(landmarks)
          if (!peace) {
            peaceFramesRef.current = 0
            peaceLatchedRef.current = false
            if (!countdownActiveRef.current) {
              setStatus('ဓာတ်ပုံရိုက်ရန် လက်နှစ်ချောင်းထောင်ပါ')
            }
            return
          }

          if (countdownActiveRef.current || awaitingReleaseRef.current || peaceTriggeredRef.current) {
            return
          }

          if (peaceLatchedRef.current) {
            return
          }

          peaceFramesRef.current += 1
          setStatus('ရပါပြီ')

          const now = Date.now()
          if (peaceFramesRef.current >= HAND_STABLE_FRAMES) {
            peaceFramesRef.current = 0
            peaceLatchedRef.current = true
            peaceTriggeredRef.current = true
            countdownActiveRef.current = true
            countdownEndRef.current = now + COUNTDOWN_SECONDS * 1000
            setCountdownLabel(String(COUNTDOWN_SECONDS))
            setCountdownUntil(countdownEndRef.current)
            startCaptureCountdown()
          }
        })

        const tick = async () => {
          if (!alive || !hands) return
          if (processingRef.current || !video.videoWidth || !video.videoHeight) {
            rafRef.current = window.requestAnimationFrame(tick)
            return
          }

          processingRef.current = true
          try {
            await hands.send({ image: video })
          } finally {
            processingRef.current = false
            rafRef.current = window.requestAnimationFrame(tick)
          }
        }

        rafRef.current = window.requestAnimationFrame(tick)
      } catch {
        setStatus('mediapipe error')
      }
    })()

    return () => {
      alive = false
      setHandsReady(false)
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current)
      }
      void hands?.close?.()
      handsRef.current = null
    }
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  function startCaptureCountdown() {
    const tick = () => {
      const now = Date.now()
      if (now >= countdownEndRef.current) {
        countdownActiveRef.current = false
        setCountdownUntil(0)
        setCountdownLabel('GO')
        window.setTimeout(() => {
          setCountdownLabel('')
          captureSnapshot()
          awaitingReleaseRef.current = true
        }, 300)
        return
      }
      setCountdownLabel(String(Math.max(1, Math.ceil((countdownEndRef.current - now) / 1000))))
      setStatus('ငြိမ်ငြိမ်နေပါ')
      window.requestAnimationFrame(tick)
    }
    window.requestAnimationFrame(tick)
  }

  function captureSnapshot() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const sourceWidth = video.videoWidth || 1280
    const sourceHeight = video.videoHeight || 720
    const targetWidth = mode === 'mobile' ? 1080 : 1920
    const targetHeight = mode === 'mobile' ? 1920 : 1080

    canvas.width = targetWidth
    canvas.height = targetHeight

    const context = canvas.getContext('2d')
    if (!context) return

    const sourceRatio = sourceWidth / sourceHeight
    const targetRatio = targetWidth / targetHeight

    let sx = 0
    let sy = 0
    let sw = sourceWidth
    let sh = sourceHeight

    if (sourceRatio > targetRatio) {
      sw = sourceHeight * targetRatio
      sx = (sourceWidth - sw) / 2
    } else {
      sh = sourceWidth / targetRatio
      sy = (sourceHeight - sh) / 2
    }

    context.drawImage(video, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight)
    const url = canvas.toDataURL('image/jpeg', 0.92)
    setSnapshotUrl(url)
    setStatus('snapshot taken')
    setPreviewOpen(true)
  }

  function resetSession() {
    setPreviewOpen(false)
    setSnapshotUrl(null)
    peaceFramesRef.current = 0
    peaceLatchedRef.current = false
    peaceTriggeredRef.current = false
    awaitingReleaseRef.current = false
    countdownActiveRef.current = false
    setCountdownLabel('')
    setCountdownUntil(0)
  }

  return (
    <main className={`app ${mode}`}>
      <div className="stage">
        <div className="camera-shell" style={{ aspectRatio: aspect }}>
          <video ref={videoRef} autoPlay muted playsInline className={`camera-feed ${appReady ? 'ready' : ''}`} />
          {!appReady ? (
            <div className="loading-screen" aria-live="polite">
              <div className="loading-orbit" />
              <div className="loading-copy">
                <strong>Wait, your browser is building the best experience</strong>
              </div>
              <div className="loading-bars" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            </div>
          ) : null}
          <div className="overlay">
            <div className="hud">
              <span className={`dot ${appReady ? 'on' : ''}`} />
              <span>{status}</span>
            </div>
          </div>
          {countdownLabel ? (
            <div key={countdownLabel} className="countdown-overlay" aria-live="assertive">
              {countdownLabel}
            </div>
          ) : null}
        </div>

        {snapshotUrl && previewOpen ? (
          <div className="snapshot-modal" aria-live="polite" onClick={resetSession}>
            <div className="snapshot-frame" onClick={(event) => event.stopPropagation()}>
              <div className="snapshot-actions">
                <span className="reset-hint">နောက်တစ်ပုံရိုက်ရန် ပိတ်ပါ</span>
                <button
                  type="button"
                  className="snapshot-action"
                  aria-label="ပုံဒေါင်းရန်"
                  onClick={() => {
                    const link = document.createElement('a')
                    link.href = snapshotUrl
                    link.download = `snapshot-${Date.now()}.jpg`
                    link.click()
                  }}
                >
                  ⬇
                </button>
                <button
                  type="button"
                  className="snapshot-action"
                  aria-label="ပိတ်ရန်"
                  onClick={resetSession}
                >
                  ×
                </button>
              </div>
              <img src={snapshotUrl} alt="snapshot" />
            </div>
          </div>
        ) : null}
      </div>

      <canvas ref={canvasRef} className="hidden-canvas" />
    </main>
  )
}

export default App
