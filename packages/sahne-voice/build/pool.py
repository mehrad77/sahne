# The candidate voices sahne-voice auditions: short read-speech clips from Google's FLEURS (CC BY 4.0: consenting, paid
# readers), several languages so a character can speak Turkish with their own accent (a Persian sample gives a Persian
# accent). FLEURS has no speaker ids, so the clips are told apart by Chatterbox's voice encoder and only distinct voices
# are kept. Writes <out>/<id>.wav (24 kHz mono, -20 LUFS) and <out>/pool.json. Run with the Python that has chatterbox-tts:
#   python packages/sahne-voice/build/pool.py <out> tr_tr:train:FEMALE:12 tr_tr:dev:MALE:12 fa_ir:train:FEMALE:6 … children:3
# (`children:3`: three child candidates, raised from the highest Turkish women's voices, since FLEURS has no children)
import csv, io, json, os, subprocess, sys, tarfile, tempfile, urllib.request
import numpy as np, librosa, torch
from chatterbox.models.voice_encoder import VoiceEncoder
from huggingface_hub import hf_hub_download

HF = "https://huggingface.co/datasets/google/fleurs/resolve/main/data"
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
pool_file = f"{out}/pool.json"
pool = json.load(open(pool_file)) if os.path.exists(pool_file) else []
ve = VoiceEncoder(); ve.load_state_dict(torch.load(hf_hub_download("ResembleAI/chatterbox", "ve.pt"), map_location="cpu", weights_only=True)); ve.eval()

def measure(y, sr=16000):
    f0 = librosa.yin(y, fmin=70, fmax=450, sr=sr); rms = librosa.feature.rms(y=y)[0]
    loud = rms[:len(f0)] > np.percentile(rms, 40)
    snr = 20 * np.log10(np.percentile(rms, 90) / max(np.percentile(rms, 10), 1e-6))
    return float(np.median(f0[loud])), float(snr)

def derive_children(want):
    """FLEURS has no children: a child's candidate is a young Turkish woman's voice raised four semitones (marked so)."""
    import soundfile as sf
    src = sorted([p for p in pool if p["lang"] == "tr" and p["gender"] == "female"], key=lambda p: -p["f0"])[:want]
    for i, p in enumerate(src, 1):
        y, sr = librosa.load(f"{out}/{p['id']}.wav", sr=24000)
        z = librosa.effects.pitch_shift(y, sr=sr, n_steps=4)
        pid = f"tr_c{i:02d}"; sf.write(f"{out}/{pid}.wav", z, sr)
        pool[:] = [x for x in pool if x["id"] != pid]
        pool.append({**p, "id": pid, "gender": "child", "f0": round(p["f0"] * 2 ** (4 / 12)), "source": p["source"] + ", raised 4 semitones"})
        print(pid, "from", p["id"], flush=True)
    json.dump(pool, open(pool_file, "w"), indent=1)

for spec in sys.argv[2:]:
    if spec.startswith("children:"): derive_children(int(spec.split(":")[1])); continue
    lang, split, gender, want = spec.split(":"); want = int(want)
    rows = {r[1]: r for r in csv.reader(io.TextIOWrapper(urllib.request.urlopen(f"{HF}/{lang}/{split}.tsv"), "utf-8"), delimiter="\t", quoting=csv.QUOTE_NONE) if r[-1] == gender}
    cands = []
    with tarfile.open(fileobj=urllib.request.urlopen(f"{HF}/{lang}/audio/{split}.tar.gz"), mode="r|gz") as t:
        for m in t:
            b = os.path.basename(m.name)
            if not (m.isfile() and b in rows): continue
            y, _ = librosa.load(io.BytesIO(t.extractfile(m).read()), sr=16000)
            y, _ = librosa.effects.trim(y, top_db=30)
            if not 6 <= len(y) / 16000 <= 14: continue
            f0, snr = measure(y)
            if snr < 30: continue
            cands.append((snr, b, y, f0))
            if len(cands) >= want * 40: break
    cands.sort(key=lambda c: -c[0])
    # a voice added by hand (the developer's own sample) has no fingerprint yet: take it from its file
    for p in pool:
        if "emb" not in p:
            y, _ = librosa.load(f"{out}/{p['id']}.wav", sr=16000)
            p["emb"] = [round(float(x), 5) for x in ve.embeds_from_wavs([y], sample_rate=16000)[0]]
    kept, embs = 0, [np.array(p["emb"]) for p in pool]
    for snr, b, y, f0 in cands:
        e = ve.embeds_from_wavs([y], sample_rate=16000)[0]
        if any(float(np.dot(e, x) / np.linalg.norm(e) / np.linalg.norm(x)) > 0.82 for x in embs): continue  # the same speaker (one speaker scores 0.85–0.95, two 0.6–0.75)
        pid = f"{lang[:2]}_{gender[0].lower()}{sum(1 for p in pool if p['lang'] == lang[:2] and p['gender'] == gender.lower()) + 1:02d}"
        with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
            import soundfile as sf; sf.write(tmp.name, y, 16000)
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", tmp.name, "-af", "loudnorm=I=-20:TP=-2", "-ar", "24000", "-ac", "1", f"{out}/{pid}.wav"], check=True)
        pool.append({"id": pid, "lang": lang[:2], "gender": gender.lower(), "f0": round(f0), "snr": round(snr, 1),
                     "source": f"FLEURS {lang} {split} {b}", "license": "CC BY 4.0", "emb": [round(float(x), 5) for x in e]})
        embs.append(e); kept += 1
        print(pid, round(f0), "Hz", round(snr), "dB", flush=True)
        if kept >= want: break
    json.dump(pool, open(pool_file, "w"), indent=1)
    print(spec, "kept", kept, "of", len(cands), flush=True)
