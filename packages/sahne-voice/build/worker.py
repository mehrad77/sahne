# sahne-voice's speech worker: the model loaded once, driven by build/voices.ts over stdin/stdout, one JSON request per line.
#   {"op": "say", "text", "lang", "ref", "exaggeration", "cfg", "seed", "out"}  → writes a wav at `out`: {"ok": true}
#   {"op": "hear", "path", "lang"}                                              → {"ok": true, "heard": "…"}
# Chatterbox Multilingual (Resemble AI, MIT) clones the voice of the `ref` sample; Whisper (mlx-whisper on Apple silicon,
# else openai-whisper) hears the result back so the generator can check it. Needs: chatterbox-tts, mlx-whisper,
# setuptools<81 (the watermarker imports pkg_resources). Every clip carries Resemble's inaudible Perth watermark.
import json, sys, os, contextlib
import torch, torchaudio as ta

if os.environ.get("SAHNE_VOICE_THREADS"): torch.set_num_threads(int(os.environ["SAHNE_VOICE_THREADS"]))
dev = "mps" if torch.backends.mps.is_available() else "cuda" if torch.cuda.is_available() else "cpu"
model = None
ASR = os.environ.get("SAHNE_VOICE_ASR", "mlx-community/whisper-large-v3-turbo")

def say(q):
    global model
    if model is None:
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS
        with contextlib.redirect_stdout(sys.stderr): model = ChatterboxMultilingualTTS.from_pretrained(device=dev)
    torch.manual_seed(int(q.get("seed", 0)))
    with contextlib.redirect_stdout(sys.stderr):
        w = model.generate(q["text"], language_id=q["lang"], audio_prompt_path=q["ref"],
                           exaggeration=float(q.get("exaggeration", 0.5)), cfg_weight=float(q.get("cfg", 0.5)))
    ta.save(q["out"], w, model.sr)
    return {}

def hear(q):
    import mlx_whisper
    with contextlib.redirect_stdout(sys.stderr):
        return {"heard": mlx_whisper.transcribe(q["path"], path_or_hf_repo=ASR, language=q["lang"])["text"].strip()}

print(json.dumps({"ready": True, "device": dev}), flush=True)
for line in sys.stdin:
    if not line.strip(): continue
    q = json.loads(line)
    try: r = {"ok": True, **(say(q) if q["op"] == "say" else hear(q))}
    except Exception as e: r = {"ok": False, "error": f"{type(e).__name__}: {e}"}
    print(json.dumps({"id": q.get("id"), **r}, ensure_ascii=False), flush=True)
