#!/bin/sh
# Builds the web sizes for the "Who NextGen is for" section from the originals in source-images/gen.
# Trims the film-rebate border the generator adds, crops to the exact frame ratio, then writes
# 600/900/1200px-wide greyscale JPEGs into public/assets/img (1200 covers the largest slot at 2-3x density). Usage: sh tools/make-gen-images.sh
set -e
cd "$(dirname "$0")/.."
SRC=source-images/gen
OUT=public/assets/img
TMP=$(mktemp -d)
GRAY="/System/Library/ColorSync/Profiles/Generic Gray Gamma 2.2 Profile.icc"   # one channel: smaller files, no colour cast

build() { # slug  crop-height crop-width  [offset-y offset-x]  (centered unless an offset is given)
  if [ -n "$4" ]; then
    sips -c "$2" "$3" --cropOffset "$4" "$5" "$SRC/gen-$1.png" --out "$TMP/$1.png" >/dev/null
  else
    sips -c "$2" "$3" "$SRC/gen-$1.png" --out "$TMP/$1.png" >/dev/null
  fi
  for w in 600 900 1200; do
    sips --matchTo "$GRAY" --resampleWidth "$w" -s format jpeg -s formatOptions 72 "$TMP/$1.png" --out "$OUT/gen-$1-$w.jpg" >/dev/null
  done
}

build high-school 1968 1476          # 3:4 from 1536x2048
build college 1470 1960              # 4:3 from 2048x1536
build young-professional 1880 1410 64 40   # 3:4, cropped past the film-edge lettering top and bottom
rm -rf "$TMP"
ls -la "$OUT"/gen-*.jpg
