#!/usr/bin/env bash
# Generate photographic country card images via Higgsfield (gpt_image_2).
# Replaces the topographic line-art heroes with real-photo-style landmarks.
# Output: public/countries/photos/<key>.png + manifest.json
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT_DIR="$ROOT/public/countries/photos"
REF="$ROOT/public/assets/hero/flightpath-hero.png"
MANIFEST="$OUT_DIR/manifest.json"
mkdir -p "$OUT_DIR"

[[ -f "$MANIFEST" ]] || echo '{}' > "$MANIFEST"

# key|Name|photographic subject
COUNTRIES=(
  "jp|Japan|Mount Fuji at sunrise reflected in Lake Kawaguchi, cherry blossoms in the foreground"
  "cn|China|The Great Wall of China winding over green mountain ridges at golden hour"
  "th|Thailand|Wat Arun golden temple spires on the Chao Phraya River at sunset"
  "ph|Philippines|Mayon Volcano perfect cone rising above tropical rice fields at dawn"
  "kr|South Korea|Gyeongbokgung palace rooflines with Bukhansan mountains behind, autumn light"
  "sg|Singapore|Marina Bay Sands skyline and Gardens by the Bay at blue hour"
  "my|Malaysia|Petronas Twin Towers at dusk against a deep purple sky"
  "tw|Chinese Taipei|Taipei 101 rising above clouds with green mountains behind at sunrise"
  "vn|Vietnam|Ha Long Bay limestone karsts emerging from misty water at dawn"
  "kh|Cambodia|Angkor Wat temple silhouetted at sunrise with a reflection in the moat"
  "hk|Hong Kong|Victoria Harbour skyline of Hong Kong at night with illuminated skyscrapers"
  "mn|Mongolia|Mongolian steppe grassland with white ger yurts and distant mountains at golden hour"
)

STYLE='Photorealistic travel photograph, golden-hour light, wide cinematic landscape, crisp fine detail, natural colors, no text, no watermark, no logo, no captions, no people in foreground, shot on 35mm, high dynamic range, clean modern editorial travel aesthetic.'

write_entry() {
  python3 - "$MANIFEST" "$1" "$2" "$3" <<'PY'
import json, sys
path, key, name, url = sys.argv[1:5]
with open(path) as f:
    data = json.load(f)
data[key] = {"key": key, "name": name, "file": f"{key}.png", "result_url": url}
with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PY
}

for row in "${COUNTRIES[@]}"; do
  IFS='|' read -r key name subject <<<"$row"
  out="$OUT_DIR/${key}.png"

  if [[ -f "$out" ]] && [[ $(stat -f%z "$out" 2>/dev/null || stat -c%s "$out") -gt 100000 ]]; then
    echo "skip $key — already have $out"
    continue
  fi

  prompt="Photographic country card for ${name}. Subject: ${subject}. ${STYLE}"

  echo "=== generating $key ($name) ==="
  result_json=""
  for attempt in 1 2 3; do
    if result_json=$(higgsfield generate create gpt_image_2 \
      --prompt "$prompt" \
      --image-references "$REF" \
      --aspect_ratio 16:9 \
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
  write_entry "$key" "$name" "$url"
done

echo "Done. Manifest → $MANIFEST"
ls -la "$OUT_DIR"
