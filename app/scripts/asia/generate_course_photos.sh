#!/usr/bin/env bash
# Generate photographic course hero images via Higgsfield (gpt_image_2) for the
# top 12 most-played Asian courses. Output: public/courses/photos/<slug>.png
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT_DIR="$ROOT/public/courses/photos"
REF="$ROOT/public/assets/hero/flightpath-hero.png"
MANIFEST="$OUT_DIR/manifest.json"
mkdir -p "$OUT_DIR"

[[ -f "$MANIFEST" ]] || echo '{}' > "$MANIFEST"

# slug|Name|scene
COURSES=(
  "laem-sor-beach-disc-golf-course|Laem Sor Beach Disc Golf Course|a disc golf basket on a tropical beach course at golden hour, palm trees and white sand, turquoise ocean in the background"
  "samui-disc-golf|Samui Disc Golf|a disc golf basket on a lush tropical island course on Koh Samui, palm trees and dense green vegetation, golden hour"
  "gymkhana-disc-golf|Gymkhana Disc Golf|a disc golf basket on a mature tree-lined park course in northern Thailand, golden hour"
  "lanna-rocks-disc-golf-course|Lanna Rocks Disc Golf Course|a disc golf basket on a rocky jungle course in northern Thailand, boulders and tropical trees, golden hour"
  "mango-valley-dg|Mango Valley DG|a disc golf basket on a course winding through a mango orchard valley, golden hour"
  "rock-n-river-disc-golf-course|Rock N River Disc Golf Course|a disc golf basket beside a rocky river in a forested Thai valley, golden hour"
  "sand-creek-disc-golf|Sand Creek Disc Golf|a disc golf basket on a course along a sandy creek bed in northern Thailand, golden hour"
  "bei-jing-wen-yu-he-fei-gao-gong-yuan|Beijing Wenyu River Park|a disc golf basket on a riverside park course in Beijing, willow trees and a calm river, golden hour"
  "ngp-hitachi-kaihin|Hitachi Seaside Park|a disc golf basket on a coastal park course in Japan with blooming blue nemophila flowers overlooking the Pacific, golden hour"
  "siem-reap-disc-golf-course|Siem Reap Disc Golf Course|a disc golf basket on a course near Siem Reap Cambodia, palm trees and tropical scrub, temple silhouettes in the distance, golden hour"
  "wat-chedi-temple-course|Wat Chedi Temple Course|a disc golf basket beside an ancient Khmer temple ruin in Cambodia, golden hour"
  "daegu-environment-resources-park|Daegu Environment & Resources Park|a disc golf basket on a hillside park course in Daegu South Korea, autumn trees and distant mountains, golden hour"
)

STYLE='Photorealistic, wide cinematic landscape, golden-hour light, crisp fine detail, natural colors, a single disc golf basket as the focal point, no text, no watermark, no logo, no people, shot on 35mm, high dynamic range, clean modern editorial disc golf photography.'

write_entry() {
  python3 - "$MANIFEST" "$1" "$2" "$3" <<'PY'
import json, sys
path, slug, name, url = sys.argv[1:5]
with open(path) as f:
    data = json.load(f)
data[slug] = {"slug": slug, "name": name, "file": f"{slug}.png", "result_url": url}
with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PY
}

for row in "${COURSES[@]}"; do
  IFS='|' read -r slug name scene <<<"$row"
  out="$OUT_DIR/${slug}.png"

  if [[ -f "$out" ]] && [[ $(stat -f%z "$out" 2>/dev/null || stat -c%s "$out") -gt 100000 ]]; then
    echo "skip $slug — already have $out"
    continue
  fi

  prompt="Course hero photo for ${name}. Scene: ${scene}. ${STYLE}"

  echo "=== generating $slug ($name) ==="
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
    echo "attempt $attempt failed for $slug — retrying in 20s" >&2
    sleep 20
  done
  if [[ -z "$result_json" ]]; then
    echo "FAILED $slug after retries" >&2
    continue
  fi

  url=$(echo "$result_json" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d[0]["result_url"] if isinstance(d,list) else d["result_url"])')
  echo "url: $url"
  curl -fsSL -A "Mozilla/5.0" "$url" -o "$out"
  file "$out"
  write_entry "$slug" "$name" "$url"
done

echo "Done. Manifest → $MANIFEST"
ls -la "$OUT_DIR"
