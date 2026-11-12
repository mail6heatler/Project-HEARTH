"use client";

export interface Recording {
  /** True when the shared surface came with sound (the voice can be in the video). */
  hasAudio: boolean;
  /** Stops and downloads the video; resolves with the file name, or null when nothing was recorded. */
  stop: () => Promise<string | null>;
  /** Called if the viewer stops sharing from the browser's own bar. */
  onEnded: (fn: () => void) => void;
}

const TYPES = ["video/mp4;codecs=avc1,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];

/**
 * Records the presentation with the browser's own screen recorder. Must be called straight from a click:
 * the browser then asks the viewer what to share (this tab, or the whole screen with system audio so the
 * voice is captured). Resolves null when sharing is refused or not supported; the show then runs unrecorded.
 */
export async function startRecording(): Promise<Recording | null> {
  const md = typeof navigator !== "undefined" ? (navigator.mediaDevices as MediaDevices | undefined) : undefined;
  if (!md?.getDisplayMedia || typeof MediaRecorder === "undefined") return null;
  let stream: MediaStream;
  try {
    stream = await md.getDisplayMedia({
      video: { frameRate: 30 },
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
    rec = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 6_000_000 } : undefined);
  } catch {
    stream.getTracks().forEach((t) => t.stop());
    return null;
  }
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  rec.start(1000);
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
  return { hasAudio: stream.getAudioTracks().length > 0, stop, onEnded: (fn) => (ended = fn) };
}
