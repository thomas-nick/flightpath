#!/usr/bin/env bash
# Generate national crest stickers matching hero lithograph style (Higgs GPT Image 2).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HEROES="$ROOT/public/countries/heroes"
CRESTS="$ROOT/public/countries/crests"
MANIFEST="$CRESTS/manifest.json"
mkdir -p "$CRESTS"

# key|Name|landmark subject for the crest center
COUNTRIES=(
  "jp|Japan|Mount Fuji silhouette with red hinomaru sun and a few sakura branch lines"
  "cn|China|Great Wall ridge silhouette with a classic pavilion roof line and red lantern accent dots"
  "th|Thailand|Golden Thai temple chedi/stupa silhouette with river curve and palm fronds"
  "ph|Philippines|Mayon volcano cone silhouette with tropical leaf accents and sunburst rays"
  "kr|South Korea|Gyeongbokgung palace roof silhouette with bold taegeuk-inspired red-blue accent (not full flag collage)"
  "sg|Singapore|Merlion and harbor skyline silhouette with orchid line accents"
  "my|Malaysia|Petronas Towers twin silhouette with mosque dome curve and tropical leaf lines"
  "tw|Chinese Taipei|Taipei 101 silhouette with mountain ridges and plum blossom line accents"
  "vn|Vietnam|Ha Long Bay limestone karst silhouettes with lotus flower line accents"
  "kh|Cambodia|Angkor Wat temple towers silhouette with tropical foliage lines"
  "hk|Hong Kong|Victoria Harbour skyline silhouette with junk sail line accent"
  "mn|Mongolia|Ger (yurt) and steppe mountain silhouette with wind-horse banner lines — heraldic only, not a cartoon animal"
)

STYLE='Die-cut circular national crest sticker for a disc golf national kit. Heraldic seal / collectible postage-stamp emblem. NOT a cartoon mascot. NO cute animals, NO characters, NO faces, NO chibi, NO winking. Style MUST match the attached retro lithograph travel-label reference: aged cream paper, indigo/navy ink, terracotta/warm red, muted gold accents, grainy printed texture, thick cream sticker border with subtle drop shadow on pure white background. Small country code letters only — no English slogans, no fake prices, no disc golf discs as toys. Clean and readable at small sizes. Premium national team crest vibe.'

[[ -f "$MANIFEST" ]] || echo '{}' > "$MANIFEST"

write_manifest_entry() {
  python3 - "$MANIFEST" "$1" "$2" "$3" <<'PY'
import json, sys
path, key, name, url = sys.argv[1:5]
with open(path) as f:
    data = json.load(f)
data[key] = {
    "key": key,
    "name": name,
    "file": f"{key}.png",
    "symbol": "crest",
    "result_url": url,
}
with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PY
}

for row in "${COUNTRIES[@]}"; do
  IFS='|' read -r key name landmark <<<"$row"
  hero="$HEROES/${key}.png"
  out="$CRESTS/${key}.png"

  if [[ ! -f "$hero" ]]; then
    echo "skip $key — missing hero $hero" >&2
    continue
  fi

  # Resume: skip if file already exists and non-trivial size
  if [[ -f "$out" ]] && [[ $(stat -f%z "$out" 2>/dev/null || stat -c%s "$out") -gt 100000 ]]; then
    echo "skip $key — already have $out"
    continue
  fi

  code=$(printf '%s' "$key" | tr '[:lower:]' '[:upper:]')
  prompt="Die-cut circular national crest sticker for ${name}. Center emblem: ${landmark}. Country code \"${code}\". ${STYLE}"

  echo "=== generating $key ($name) ==="
  result_json=""
  for attempt in 1 2 3; do
    if result_json=$(higgsfield generate create gpt_image_2 \
      --prompt "$prompt" \
      --image-references "$hero" \
      --aspect_ratio 1:1 \
      --quality high \
      --resolution 2k \
      --wait --wait-timeout 15m --json); then
      break
    fi
    echo "attempt $attempt failed for $key — retrying in 20s" >&2
    sleep 20
  done
  if [[ -z "$result_json" ]]; then
    echo "FAILED $key after retries" >&2
    continue
  fi

  url=$(echo "$result_json" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d[0]["result_url"] if isinstance(d,list) else d["result_url"])')
  echo "url: $url"
  curl -fsSL -A "Mozilla/5.0" "$url" -o "$out"
  file "$out"
  write_manifest_entry "$key" "$name" "$url"
done

# Backfill manifest URLs from log-ish known files without entries
python3 - "$MANIFEST" "$CRESTS" <<'PY'
import json, sys
from pathlib import Path
manifest_path = Path(sys.argv[1])
crests = Path(sys.argv[2])
data = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
names = {
  "jp":"Japan","cn":"China","th":"Thailand","ph":"Philippines","kr":"South Korea",
  "sg":"Singapore","my":"Malaysia","tw":"Chinese Taipei","vn":"Vietnam","kh":"Cambodia",
  "hk":"Hong Kong","mn":"Mongolia",
}
for png in crests.glob("*.png"):
    key = png.stem
    if key not in data:
        data[key] = {"key": key, "name": names.get(key, key.upper()), "file": png.name, "symbol": "crest", "result_url": None}
manifest_path.write_text(json.dumps(data, indent=2) + "\n")
print("manifest keys", sorted(data))
PY

echo "Done. Manifest → $MANIFEST"
ls -la "$CRESTS"
