# Speech eval recordings

Put your own recordings here. `pnpm eval:asr` transcribes each clip and compares the words with what you wrote down.

## How to record

- Use your phone voice recorder. Any app is fine, 16 kHz or better, mono.
- One sentence per file, 3 to 15 seconds.
- Speak the way you talk at the market, not like reading. Include prices and quantities ("three bags for forty five thousand").
- Record in the places you will really use it: shop noise, generator, traffic.
- Aim for at least 10 clips per language you care about.

## Files

For each clip `<id>` add two files:

- `<id>.m4a` (or `.webm`, `.wav`, `.mp3`, `.ogg`): the audio.
- `<id>.txt`: exactly what was said, one line of plain text.

The id starts with the language: `en-`, `pcm-` (Pidgin), `yo-` (Yoruba), `ha-` (Hausa), `ig-` (Igbo) or `mixed-` (English with local words). Example: `pcm-03.m4a` and `pcm-03.txt`.

Optional `manifest.json` overrides the language and adds notes:

```json
{
  "pcm-03": { "lang": "pcm", "speaker": "Mama Ngozi", "note": "noisy generator" }
}
```

Write numbers the way you want them compared. The word error rate treats "45,000" and "forty five thousand" as different words. The "numbers correct" score understands both.

## Experimental: Gemma 4 E4B native audio

Set `GEMMA_AUDIO_BASE_URL` and `GEMMA_AUDIO_MODEL` to also send each clip to a chat endpoint as an `input_audio` message part. Ollama's OpenAI endpoint may not accept audio yet. llama.cpp's server or vLLM can serve audio input. This is untested here, so treat any failure as a setup problem first. `webm` and `m4a` are often rejected by these servers; `wav` or `mp3` is safer.

## Privacy

These are real voices. Do not commit recordings you do not want public.
