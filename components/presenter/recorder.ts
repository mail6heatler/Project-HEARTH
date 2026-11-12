"use client";

export type Quality = "720p" | "1080p";

export interface Recording {
  /** True when the shared surface came with sound (the voice can be in the video). */
  hasAudio: boolean;
  /** Starts writing the video (after the countdown, so the share pop-up is never in it). */
  begin: () => void;
  /** Stops and downloads the video; resolves with the file name, or null when nothing was recorded. */
  stop: () => Promise<string | null>;
  /** Called if the viewer stops sharing from the browser's own bar. */
  onEnded: (fn: () => void) => void;
}

const TYPES = ["video/mp4;codecs=avc1,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
const SIZE: Record<Quality, { width: number; height: number; bits: number }> = {
  "720p": { width: 1280, height: 720, bits: 5_000_000 },
  "1080p": { width: 1920, height: 1080, bits: 9_000_000 },
};

/**
 * Records the presentation with the browser's own screen recorder. Must be called straight from a click:
 * the browser then asks the viewer what to share (this tab, or the whole screen with system audio so the
 * voice is captured). Resolves null when sharing is refused or not supported; the show then runs unrecorded.
 */
export async function startRecording(quality: Quality): Promise<Recording | null> {
  const md = typeof navigator !== "undefined" ? (navigator.mediaDevices as MediaDevices | undefined) : undefined;
  if (!md?.getDisplayMedia || typeof MediaRecorder === "undefined") return null;
  const size = SIZE[quality];
  let stream: MediaStream;
  try {
    stream = await md.getDisplayMedia({
      video: { width: { ideal: size.width }, height: { ideal: size.height }, frameRate: { ideal: 60, max: 60 } },
      audio: true,
      // hints some browsers understand: offer this tab first, allow system audio
      preferCurrentTab: true,
      selfBrowserSurface: "include",
      systemAudio: "include",
    } as DisplayMediaStreamOptions);
  } catch {
    return null;
  }
  const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t));
  let rec: MediaRecorder;
  try {
    rec = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: size.bits } : undefined);
  } catch {
    stream.getTracks().forEach((t) => t.stop());
    return null;
  }
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  let ended: (() => void) | null = null;
  stream.getVideoTracks()[0]?.addEventListener("ended", () => ended?.());

  let done: Promise<string | null> | null = null;
  const stop = () => {
    if (done) return done;
    done = new Promise<string | null>((resolve) => {
      const save = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (!chunks.length) return resolve(null);
        const blob = new Blob(chunks, { type: rec.mimeType || "video/webm" });
        const name = `HEARTH-presentation.${blob.type.includes("mp4") ? "mp4" : "webm"}`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
        resolve(name);
      };
      if (rec.state === "inactive") save();
      else {
        rec.onstop = save;
        rec.stop();
      }
    });
    return done;
  };
  return {
    hasAudio: stream.getAudioTracks().length > 0,
    begin: () => {
      if (rec.state === "inactive") rec.start(1000);
    },
    stop,
    onEnded: (fn) => (ended = fn),
  };
}
