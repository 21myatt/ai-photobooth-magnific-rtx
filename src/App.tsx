import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { DEFAULT_PROMPT_PRESET, PROMPT_PRESETS } from "./prompts";

const HAND_STABLE_FRAMES = 4;
const COUNTDOWN_SECONDS = 3;
const MEDIAPIPE_HANDS_VERSION = "0.4.1675469240";
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 60;
const SUBMIT_IMAGE_MAX_SIDE = 1280;
const FAILED_STATUSES = new Set(["FAILED", "ERROR", "CANCELLED", "TIMED_OUT"]);
const PASSCODE_MAX_ATTEMPTS = 3;
const PASSCODE_LOCKOUT_BASE_MINUTES = 1;

type SubmitStatus = "idle" | "submitting" | "polling" | "ready" | "error";

function isFingerExtended(
  landmarks: Array<{ x: number; y: number }>,
  tip: number,
  pip: number,
) {
  return landmarks[tip].y < landmarks[pip].y;
}

function isPeaceSign(landmarks: Array<{ x: number; y: number }>) {
  const indexExtended = isFingerExtended(landmarks, 8, 6);
  const middleExtended = isFingerExtended(landmarks, 12, 10);
  const ringFolded = !isFingerExtended(landmarks, 16, 14);
  const pinkyFolded = !isFingerExtended(landmarks, 20, 18);
  return indexExtended && middleExtended && ringFolded && pinkyFolded;
}

function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const handsRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const cameraStartTokenRef = useRef(0);
  const peaceFramesRef = useRef(0);
  const peaceLatchedRef = useRef(false);
  const peaceTriggeredRef = useRef(false);
  const awaitingReleaseRef = useRef(false);
  const countdownActiveRef = useRef(false);
  const countdownEndRef = useRef(0);
  const processingRef = useRef(false);
  const generationTokenRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [handsReady, setHandsReady] = useState(false);
  const [status, setStatus] = useState("idle");
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [countdownUntil, setCountdownUntil] = useState(0);
  const [countdownLabel, setCountdownLabel] = useState("");
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [submitError, setSubmitError] = useState("");
  const [pollAttempt, setPollAttempt] = useState(0);
  const [generationSeconds, setGenerationSeconds] = useState(0);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [promptPanelOpen, setPromptPanelOpen] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(
    DEFAULT_PROMPT_PRESET.id,
  );
  const [activePrompt, setActivePrompt] = useState<string>(
    DEFAULT_PROMPT_PRESET.prompt,
  );
  const [passcodeOpen, setPasscodeOpen] = useState(false);
  const [passcodeValue, setPasscodeValue] = useState("");
  const [passcodeError, setPasscodeError] = useState("");
  const [generationUnlocked, setGenerationUnlocked] = useState(false);
  const [passcodeAttempts, setPasscodeAttempts] = useState(0);
  const [passcodeLockoutUntil, setPasscodeLockoutUntil] = useState(0);
  const [passcodeCooldownLabel, setPasscodeCooldownLabel] = useState("");
  const [passcodeCooldownLevel, setPasscodeCooldownLevel] = useState(0);
  const [snapshotConsumed, setSnapshotConsumed] = useState(false);
  const [mode, setMode] = useState<"desktop" | "mobile">(
    window.matchMedia("(max-width: 768px)").matches ? "mobile" : "desktop",
  );

  const aspect = useMemo(() => "16 / 9", []);
  const appReady = ready && handsReady;
  const previewUrl = generatedUrl || snapshotUrl;
  const generating =
    submitStatus === "submitting" || submitStatus === "polling";
  const selectedPreset =
    PROMPT_PRESETS.find((preset) => preset.id === selectedPresetId) ||
    DEFAULT_PROMPT_PRESET;
  const requiredPasscode = import.meta.env.VITE_PASSCODE
    ? String(import.meta.env.VITE_PASSCODE)
    : "";
  const passcodeLocked = passcodeLockoutUntil > Date.now();
  const hideEditAndGenerate = generating || Boolean(generatedUrl) || snapshotConsumed;

  useEffect(() => {
    if (!generating) return;

    const startedAt = Date.now();
    setGenerationSeconds(0);
    const timer = window.setInterval(() => {
      setGenerationSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [generating]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    const onChange = () => setMode(media.matches ? "mobile" : "desktop");
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      if (countdownActiveRef.current && countdownUntil > now) {
        const remaining = Math.ceil((countdownUntil - now) / 1000);
        setCountdownLabel(String(Math.max(1, remaining)));
        setStatus("ငြိမ်ငြိမ်နေပါ");
      } else if (appReady && !snapshotUrl) {
        setStatus("ဓာတ်ပုံရိုက်ရန် လက်နှစ်ချောင်းထောင်ပါ");
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [appReady, countdownUntil, snapshotUrl]);

  useEffect(() => {
    if (!passcodeOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPasscodeOpen(false);
        setPasscodeValue("");
        setPasscodeError("");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [passcodeOpen]);

  useEffect(() => {
    if (!passcodeOpen) {
      setPasscodeCooldownLabel("");
      return;
    }

    const timer = window.setInterval(() => {
      const remainingMs = passcodeLockoutUntil - Date.now();
      if (remainingMs <= 0) {
        setPasscodeCooldownLabel("");
        return;
      }

      const totalSeconds = Math.ceil(remainingMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      setPasscodeCooldownLabel(
        minutes > 0
          ? `${minutes}m ${String(seconds).padStart(2, "0")}s`
          : `${seconds}s`,
      );
    }, 250);

    return () => window.clearInterval(timer);
  }, [passcodeLockoutUntil, passcodeOpen]);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      const startToken = ++cameraStartTokenRef.current;
      try {
        setStatus("preparing camera");
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("getUserMedia unavailable");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        if (cancelled || cameraStartTokenRef.current !== startToken) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setReady(true);
        setStatus("loading hand tracking");
      } catch {
        setStatus("camera error");
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !ready) return;

    let alive = true;
    let hands: any = null;

    void (async () => {
      try {
        if (!(window as any).Hands) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector<HTMLScriptElement>(
              'script[data-mediapipe-hands="true"]',
            );
            if (existing) {
              existing.addEventListener("load", () => resolve(), {
                once: true,
              });
              existing.addEventListener(
                "error",
                () => reject(new Error("MediaPipe script failed to load")),
                { once: true },
              );
              return;
            }
            const script = document.createElement("script");
            script.src = `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${MEDIAPIPE_HANDS_VERSION}/hands.js`;
            script.async = true;
            script.defer = true;
            script.dataset.mediapipeHands = "true";
            script.onload = () => resolve();
            script.onerror = () =>
              reject(new Error("MediaPipe script failed to load"));
            document.head.appendChild(script);
          });
        }

        const HandsCtor = (window as any).Hands ?? (window as any).Solution;
        if (typeof HandsCtor !== "function") {
          throw new Error("Hands global missing");
        }

        hands = new HandsCtor({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${MEDIAPIPE_HANDS_VERSION}/${file}`,
        });
        handsRef.current = hands;
        hands.setOptions({
          selfieMode: true,
          maxNumHands: 1,
          modelComplexity: 0,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.7,
        });
        await hands.initialize();
        setHandsReady(true);
        setStatus("ဓာတ်ပုံရိုက်ရန် လက်နှစ်ချောင်းထောင်ပါ");

        hands.onResults((results: any) => {
          const landmarks = results.multiHandLandmarks?.[0];
          if (!landmarks) {
            peaceFramesRef.current = 0;
            peaceLatchedRef.current = false;
            if (awaitingReleaseRef.current) {
              awaitingReleaseRef.current = false;
            }
            return;
          }

          const peace = isPeaceSign(landmarks);
          if (!peace) {
            peaceFramesRef.current = 0;
            peaceLatchedRef.current = false;
            if (!countdownActiveRef.current) {
              setStatus("ဓာတ်ပုံရိုက်ရန် လက်နှစ်ချောင်းထောင်ပါ");
            }
            return;
          }

          if (
            countdownActiveRef.current ||
            awaitingReleaseRef.current ||
            peaceTriggeredRef.current
          ) {
            return;
          }

          if (peaceLatchedRef.current) {
            return;
          }

          peaceFramesRef.current += 1;
          setStatus("ရပါပြီ");

          const now = Date.now();
          if (peaceFramesRef.current >= HAND_STABLE_FRAMES) {
            peaceFramesRef.current = 0;
            peaceLatchedRef.current = true;
            peaceTriggeredRef.current = true;
            countdownActiveRef.current = true;
            countdownEndRef.current = now + COUNTDOWN_SECONDS * 1000;
            setCountdownLabel(String(COUNTDOWN_SECONDS));
            setCountdownUntil(countdownEndRef.current);
            startCaptureCountdown();
          }
        });

        const tick = async () => {
          if (!alive || !hands) return;
          if (
            processingRef.current ||
            !video.videoWidth ||
            !video.videoHeight
          ) {
            rafRef.current = window.requestAnimationFrame(tick);
            return;
          }

          processingRef.current = true;
          try {
            await hands.send({ image: video });
          } finally {
            processingRef.current = false;
            rafRef.current = window.requestAnimationFrame(tick);
          }
        };

        rafRef.current = window.requestAnimationFrame(tick);
      } catch {
        setStatus("mediapipe error");
      }
    })();

    return () => {
      alive = false;
      setHandsReady(false);
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }
      void hands?.close?.();
      handsRef.current = null;
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function startCaptureCountdown() {
    const tick = () => {
      const now = Date.now();
      if (now >= countdownEndRef.current) {
        countdownActiveRef.current = false;
        setCountdownUntil(0);
        setCountdownLabel("GO");
        window.setTimeout(() => {
          setCountdownLabel("");
          captureSnapshot();
          awaitingReleaseRef.current = true;
        }, 300);
        return;
      }
      setCountdownLabel(
        String(Math.max(1, Math.ceil((countdownEndRef.current - now) / 1000))),
      );
      setStatus("ငြိမ်ငြိမ်နေပါ");
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  }

  function captureSnapshot() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const sourceWidth = video.videoWidth || 1280;
    const sourceHeight = video.videoHeight || 720;
    const targetWidth = mode === "mobile" ? 1080 : 1920;
    const targetHeight = mode === "mobile" ? 1920 : 1080;

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");
    if (!context) return;

    const sourceRatio = sourceWidth / sourceHeight;
    const targetRatio = targetWidth / targetHeight;

    let sx = 0;
    let sy = 0;
    let sw = sourceWidth;
    let sh = sourceHeight;

    if (sourceRatio > targetRatio) {
      sw = sourceHeight * targetRatio;
      sx = (sourceWidth - sw) / 2;
    } else {
      sh = sourceWidth / targetRatio;
      sy = (sourceHeight - sh) / 2;
    }

    context.drawImage(video, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
    const url = canvas.toDataURL("image/jpeg", 0.92);
    setSnapshotUrl(url);
    setGeneratedUrl(null);
    setTaskId(null);
    setSubmitStatus("idle");
    setSubmitError("");
    setPollAttempt(0);
    setGenerationSeconds(0);
    setGenerationUnlocked(false);
    setSnapshotConsumed(false);
    setPasscodeAttempts(0);
    setPasscodeLockoutUntil(0);
    setPasscodeCooldownLabel("");
    setPasscodeCooldownLevel(0);
    setStatus("snapshot taken");
    // void submitSnapshot(url)
    setPreviewOpen(true);
  }

  async function submitSnapshot(url: string) {
    try {
      setSubmitStatus("submitting");
      setSubmitError("");
      setPollAttempt(0);
      setGenerationSeconds(0);
      setStatus("sending to magnific");
      const submissionUrl = await createSubmissionImage(url);

      const response = await fetch("/api/submit", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          prompt: activePrompt,
          aspectRatio: mode === "mobile" ? "9:16" : "16:9",
          referenceImages: [
            {
              image: submissionUrl,
              text: "img1",
              mime_type: "image/jpeg",
            },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error || `Submit failed: ${response.status}`);
      }

      const data = await response.json();
      if (!data?.taskId) {
        throw new Error("Missing task id");
      }

      setTaskId(data.taskId);
      setSubmitStatus("polling");
      setStatus("generating photo");
      await pollResult(data.taskId, generationTokenRef.current);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSubmitStatus("error");
      setSubmitError(message);
      setStatus("generation failed");
    }
  }

  async function createSubmissionImage(url: string) {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not prepare image"));
      img.src = url;
    });

    const scale = Math.min(
      1,
      SUBMIT_IMAGE_MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not prepare image");
    }
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.86);
  }

  async function pollResult(nextTaskId: string, token: number) {
    for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt += 1) {
      await new Promise((resolve) =>
        window.setTimeout(resolve, POLL_INTERVAL_MS),
      );
      if (token !== generationTokenRef.current) return;
      setPollAttempt(attempt);

      const response = await fetch(
        `/api/status?taskId=${encodeURIComponent(nextTaskId)}`,
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error || `Status failed: ${response.status}`);
      }

      const data = await response.json();
      if (token !== generationTokenRef.current) return;

      if (data.status === "COMPLETED" && data.imageUrl) {
        setGeneratedUrl(data.imageUrl);
        setSubmitStatus("ready");
        setStatus("AI photo ready");
        return;
      }

      if (FAILED_STATUSES.has(data.status)) {
        const detail =
          data.error ||
          data.result?.data?.error ||
          data.result?.error ||
          data.status;
        throw new Error(`Generation failed: ${detail}`);
      }

      setStatus("generating photo");
    }

    throw new Error("Generation timed out");
  }

  function generatePhoto() {
    if (!snapshotUrl || generating || snapshotConsumed) return;

    if (!generationUnlocked) {
      setPasscodeOpen(true);
      setPasscodeError("");
      setPasscodeValue("");
      return;
    }

    generationTokenRef.current += 1;
    setSnapshotConsumed(true);
    setGenerationUnlocked(false);
    void submitSnapshot(snapshotUrl);
  }

  function resetSession() {
    setPreviewOpen(false);
    setSnapshotUrl(null);
    setGeneratedUrl(null);
    setTaskId(null);
    setSubmitStatus("idle");
    setSubmitError("");
    setPollAttempt(0);
    setGenerationSeconds(0);
    setPromptPanelOpen(false);
    setPasscodeOpen(false);
    setPasscodeValue("");
    setPasscodeError("");
    setGenerationUnlocked(false);
    setPasscodeAttempts(0);
    setPasscodeLockoutUntil(0);
    setPasscodeCooldownLabel("");
    setPasscodeCooldownLevel(0);
    setSnapshotConsumed(false);
    generationTokenRef.current += 1;
    peaceFramesRef.current = 0;
    peaceLatchedRef.current = false;
    peaceTriggeredRef.current = false;
    awaitingReleaseRef.current = false;
    countdownActiveRef.current = false;
    setCountdownLabel("");
    setCountdownUntil(0);
  }

  async function downloadPreview() {
    if (!previewUrl) return;

    const extension = generatedUrl ? "png" : "jpg";
    const response = await fetch(previewUrl);
    if (!response.ok) {
      setSubmitError(`Download failed: ${response.status}`);
      return;
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `${generatedUrl ? "ai-photo" : "snapshot"}-${Date.now()}.${extension}`;
    link.click();
    URL.revokeObjectURL(objectUrl);
  }

  function selectPromptPreset(id: string) {
    const preset = PROMPT_PRESETS.find((entry) => entry.id === id);
    if (!preset) return;

    setSelectedPresetId(preset.id);
    setActivePrompt(preset.prompt);
  }

  function resetPrompt() {
    setActivePrompt(selectedPreset.prompt);
  }

  function submitPasscode() {
    if (passcodeLocked) {
      setPasscodeError("Please wait for the cooldown to end");
      return;
    }

    const trimmed = passcodeValue.trim();
    if (!requiredPasscode) {
      setPasscodeError("Passcode is not configured");
      return;
    }

    if (trimmed !== requiredPasscode) {
      const nextAttempts = passcodeAttempts + 1;
      setPasscodeAttempts(nextAttempts);
      setPasscodeValue("");

      const remaining = PASSCODE_MAX_ATTEMPTS - nextAttempts;
      if (nextAttempts >= PASSCODE_MAX_ATTEMPTS) {
        const nextLevel = passcodeCooldownLevel + 1;
        const lockoutMinutes =
          PASSCODE_LOCKOUT_BASE_MINUTES * Math.pow(3, nextLevel - 1);
        const lockoutUntil = Date.now() + lockoutMinutes * 60 * 1000;
        setPasscodeAttempts(0);
        setPasscodeCooldownLevel(nextLevel);
        setPasscodeLockoutUntil(lockoutUntil);
        setPasscodeError(
          `Too many attempts. Try again in ${lockoutMinutes} minute${lockoutMinutes === 1 ? "" : "s"}.`,
        );
        return;
      }

      setPasscodeError(
        `Incorrect passcode. ${remaining} ${remaining === 1 ? "try" : "tries"} left`,
      );
      return;
    }

    setGenerationUnlocked(true);
    setPasscodeOpen(false);
    setPasscodeValue("");
    setPasscodeError("");
    setPasscodeAttempts(0);
    setPasscodeLockoutUntil(0);
    setPasscodeCooldownLabel("");
    setPasscodeCooldownLevel(0);
    generationTokenRef.current += 1;
    if (snapshotUrl) {
      void submitSnapshot(snapshotUrl);
    }
  }

  return (
    <main className={`app ${mode}`}>
      <div className="stage">
        <div className="camera-shell" style={{ aspectRatio: aspect }}>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`camera-feed ${appReady ? "ready" : ""}`}
          />
          {!appReady ? (
            <div className="loading-screen" aria-live="polite">
              <div className="loading-orbit" />
              <div className="loading-copy">
                <strong>
                  Wait, your browser is building the best experience
                </strong>
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
              <span className={`dot ${appReady ? "on" : ""}`} />
              <span>{status}</span>
            </div>
          </div>
          {countdownLabel ? (
            <div
              key={countdownLabel}
              className="countdown-overlay"
              aria-live="assertive"
            >
              {countdownLabel}
            </div>
          ) : null}
        </div>

        {previewUrl && previewOpen ? (
          <div
            className="snapshot-modal"
            aria-live="polite"
            onClick={generating ? undefined : resetSession}
          >
            <div
              className="snapshot-frame"
              data-task-id={taskId || undefined}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="snapshot-actions">
                <span className="reset-hint">
                  {submitStatus === "submitting"
                    ? "AI ပုံစတင်နေသည်"
                    : submitStatus === "polling"
                      ? "AI ပုံဖန်တီးနေသည်"
                      : submitStatus === "ready"
                        ? "AI ပုံရပြီ"
                        : submitStatus === "error"
                          ? submitError || "AI ပုံမရပါ၊ ထပ်လုပ်ပါ"
                          : "နောက်တစ်ပုံရိုက်ရန် ပိတ်ပါ"}
                </span>
                <button
                  type="button"
                  className="snapshot-action prompt-action"
                  aria-label="Prompt ပြင်ရန်"
                  disabled={generating}
                  style={{ display: hideEditAndGenerate ? "none" : undefined }}
                  onClick={() => setPromptPanelOpen(true)}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="snapshot-action"
                  aria-label="ပုံဒေါင်းရန်"
                  disabled={generating}
                  onClick={() => void downloadPreview()}
                >
                  ⬇
                </button>
                <button
                  type="button"
                  className="snapshot-action generate-action"
                  aria-label="AI ပုံဖန်တီးရန်"
                  disabled={generating || !snapshotUrl}
                  style={{ display: hideEditAndGenerate ? "none" : undefined }}
                  onClick={generatePhoto}
                >
                  {generating ? "…" : "✨"}
                </button>
                <button
                  type="button"
                  className="snapshot-action"
                  aria-label="ပိတ်ရန်"
                  disabled={generating}
                  onClick={resetSession}
                >
                  ×
                </button>
              </div>
              <div
                className={`preview-image-shell ${generating ? "generating" : ""}`}
              >
                <img
                  src={previewUrl}
                  alt={generatedUrl ? "generated AI result" : "snapshot"}
                />
                {generating ? (
                  <div className="generation-overlay" aria-live="polite">
                    <div className="generation-ring" />
                    <strong>Generating AI photo</strong>
                    <span>
                      {pollAttempt > 0
                        ? `Checking result ${pollAttempt} of ${MAX_POLL_ATTEMPTS}`
                        : "Preparing your photo"}
                    </span>
                    <span>{`Working for ${generationSeconds} sec`}</span>
                  </div>
                ) : null}
              </div>
              {promptPanelOpen ? (
                <div
                  className="prompt-panel"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Prompt editor"
                >
                  <div className="prompt-panel-header">
                    <strong>Prompt</strong>
                    <button
                      type="button"
                      className="prompt-panel-close"
                      aria-label="Close prompt editor"
                      onClick={() => setPromptPanelOpen(false)}
                    >
                      ×
                    </button>
                  </div>
                  <label className="prompt-field">
                    <span>Preset</span>
                    <select
                      value={selectedPresetId}
                      onChange={(event) =>
                        selectPromptPreset(event.target.value)
                      }
                    >
                      {PROMPT_PRESETS.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="prompt-field">
                    <span>Prompt</span>
                    <textarea
                      value={activePrompt}
                      onChange={(event) => setActivePrompt(event.target.value)}
                    />
                  </label>
                  <div className="prompt-panel-actions">
                    <button type="button" onClick={resetPrompt}>
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setPromptPanelOpen(false)}
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : null}
              {passcodeOpen ? (
                <div
                  className="passcode-panel"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Passcode required"
                >
                  <div className="passcode-panel-header">
                    <strong>Enter passcode</strong>
                    <button
                      type="button"
                      className="prompt-panel-close"
                      aria-label="Close passcode prompt"
                      onClick={() => {
                        setPasscodeOpen(false);
                        setPasscodeValue("");
                        setPasscodeError("");
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <p className="passcode-help">
                    Ask staff for the code to start generation.
                  </p>
                  <label className="passcode-field">
                    <span>Passcode</span>
                    <input
                      type="password"
                      value={passcodeValue}
                      disabled={passcodeLocked}
                      autoFocus
                      onChange={(event) => {
                        setPasscodeValue(event.target.value);
                        setPasscodeError("");
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          submitPasscode();
                        }
                      }}
                    />
                  </label>
                  {passcodeLocked ? (
                    <div className="passcode-cooldown">
                      Try again in{" "}
                      <strong>{passcodeCooldownLabel || "0s"}</strong>
                    </div>
                  ) : null}
                  {passcodeError ? (
                    <div className="passcode-error">{passcodeError}</div>
                  ) : null}
                  <div className="passcode-panel-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setPasscodeOpen(false);
                        setPasscodeValue("");
                        setPasscodeError("");
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={submitPasscode}
                      disabled={passcodeLocked}
                    >
                      Unlock
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <canvas ref={canvasRef} className="hidden-canvas" />
    </main>
  );
}

export default App;
