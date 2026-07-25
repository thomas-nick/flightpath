#!/usr/bin/env bash
# Generate modern, clean country hero cards matching the topographic landing hero.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HEROES="$ROOT/public/countries/heroes-modern"
REF="$ROOT/public/assets/hero/flightpath-hero.png"
MANIFEST="$HEROES/manifest.json"
mkdir -p "$HEROES"

[[ -f "$MANIFEST" ]] || echo '{}' > "$MANIFEST"

# key|Name|landmark silhouette|flag-color accent
COUNTRIES=(
  "jp|Japan|Mount Fuji with a red hinomaru sun disc and a few sakura branch lines|red sun disc"
  "cn|China|Great Wall ridge line with a classic pavilion roof|red lantern accent"
  "th|Thailand|Golden Thai temple chedi with a river curve and palm frond|gold and navy"
  "ph|Philippines|Mayon volcano cone with tropical leaf accents and sunburst rays|yellow sun and blue"
  "kr|South Korea|Gyeongbokgung palace roof line with a taegeuk-inspired swirl|red and blue"
  "sg|Singapore|Merlion silhouette with harbor skyline and an orchid line|red and white"
  "my|Malaysia|Petronas Towers twin silhouette with a mosque dome curve|blue and gold"
  "tw|Chinese Taipei|Taipei 101 tower with mountain ridges and a plum blossom|blue and red"
  "vn|Vietnam|Ha Long Bay limestone karsts with a lotus flower line|red and yellow"
  "kh|Cambodia|Angkor Wat temple towers with tropical foliage lines|gold and red"
  "hk|Hong Kong|Victoria Harbour skyline with a junk sail line|red and white"
  "mn|Mongolia|Ger (yurt) and steppe mountain ridge with a wind-horse banner line|red and blue"
)

STYLE='Modern, clean editorial hero card for a disc golf national team. Minimal topographic contour-line map aesthetic — fine pine-green hairlines on a warm chalk off-white background, matching the attached reference image style. Center: a single clean line-art silhouette of the landmark. One subtle accent in the flag colors. Lots of negative space, airy, refined, uniform, modern. NO retro lithograph label, NO matchbox art, NO fake prices, NO heavy aged textures, NO cartoon mascots, NO people, NO faces, NO discs as objects. Small country code in a clean geometric cartouche as part of the composition. Subtle fine paper grain. Palette: deep forest pine green #16382c, warm off-white chalk #f2f5f0, muted sage mist #d7e3da, one flag-color accent. Flat modern editorial composition.'

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
  IFS='|' read -r key name landmark accent <<<"$row"
  out="$HEROES/${key}.png"

  if [[ -f "$out" ]] && [[ $(stat -f%z "$out" 2>/dev/null || stat -c%s "$out") -gt 100000 ]]; then
    echo "skip $key — already have $out"
    continue
  fi

  code=$(printf '%s' "$key" | tr '[:lower:]' '[:upper:]')
  prompt="Modern clean hero card for ${name}. Center landmark: ${landmark}. Flag accent: ${accent}. Country code \"${code}\". ${STYLE}"

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
ls -la "$HEROES"
