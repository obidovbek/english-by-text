export let sharedMicrophoneStream: MediaStream | null = null;
let microphonePermissionRequested = false;

/**
 * Request and cache a single microphone stream for the session.
 * Subsequent calls will reuse the same active stream to avoid repeated prompts.
 */
export async function getMicrophoneStream(): Promise<MediaStream> {
  if (sharedMicrophoneStream && sharedMicrophoneStream.active) {
    return sharedMicrophoneStream;
  }

  // Mark that we've requested permission in this session
  microphonePermissionRequested = true;

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  sharedMicrophoneStream = stream;
  return stream;
}

/**
 * Check if microphone permission has been requested in this session
 */
export function hasMicrophonePermissionBeenRequested(): boolean {
  return microphonePermissionRequested;
}

/**
 * Release the cached microphone stream (e.g., on app unload).
 */
export function releaseMicrophone(): void {
  try {
    if (sharedMicrophoneStream) {
      for (const track of sharedMicrophoneStream.getTracks()) track.stop();
    }
  } finally {
    sharedMicrophoneStream = null;
    microphonePermissionRequested = false;
  }
}

/**
 * Best-effort prewarm to satisfy some browsers' user-gesture requirements for audio playback.
 */
export function prewarmAudio(): void {
  try {
    const a = new Audio();
    a.muted = true;
    const p = a.play();
    if (p && typeof (p as any).then === "function") {
      (p as Promise<void>).catch(() => {});
    }
  } catch {}
}

// Ensure microphone is released when the page is being closed/refreshed
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    releaseMicrophone();
  });
}
