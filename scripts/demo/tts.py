"""
The demo video's narration: each line spoken by Microsoft's natural Aria voice (edge-tts, the voice behind Edge's
Read Aloud), saved as MP3 with the time every word starts. Only the public narration text is sent. Lines already
spoken with the same voice, speed and text are reused from the cache, so re-recording does not ask again.

Usage (run by scripts/demo/record.mjs): python scripts/demo/tts.py <lines.json> <cache dir> <out.json>
  lines.json: [{"id": "...", "text": "..."}]
  out.json:   {"voice": "...", "lines": [{"id", "text", "mp3", "words": [{"text", "offsetMs"}]}]}
"""
import asyncio
import hashlib
import json
import os
import sys

import edge_tts

VOICE = "en-US-AriaNeural"
RATE = "+4%"


async def speak(text: str, mp3: str) -> list:
    try:
        comm = edge_tts.Communicate(text, VOICE, rate=RATE, boundary="WordBoundary")
    except TypeError:  # older edge-tts always reports words
        comm = edge_tts.Communicate(text, VOICE, rate=RATE)
    words = []
    tmp = mp3 + ".part"
    with open(tmp, "wb") as f:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                # offsets come in 100-nanosecond units
                words.append({"text": chunk["text"], "offsetMs": round(chunk["offset"] / 10_000)})
    os.replace(tmp, mp3)
    return words


async def main() -> None:
    lines_path, cache, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
    os.makedirs(cache, exist_ok=True)
    with open(lines_path, encoding="utf-8") as f:
        lines = json.load(f)
    out = []
    for line in lines:
        key = hashlib.sha1(f"{VOICE}|{RATE}|{line['text']}".encode("utf-8")).hexdigest()[:16]
        mp3 = os.path.join(cache, f"{key}.mp3")
        meta = os.path.join(cache, f"{key}.json")
        if os.path.exists(mp3) and os.path.exists(meta):
            with open(meta, encoding="utf-8") as f:
                words = json.load(f)
            print(f"  voice {line['id']}: cached")
        else:
            words = await speak(line["text"], mp3)
            with open(meta, "w", encoding="utf-8") as f:
                json.dump(words, f)
            print(f"  voice {line['id']}: spoken ({len(words)} words)")
        out.append({"id": line["id"], "text": line["text"], "mp3": mp3, "words": words})
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"voice": f"Microsoft Aria ({VOICE})", "lines": out}, f, indent=1)


if __name__ == "__main__":
    asyncio.run(main())
