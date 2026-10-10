#!/bin/sh
# Downloads the Gemma 4 E2B web model into public/models/ so the native app ships it.
# Uses the hf CLI when present, else curl. The repo is not gated; HF_TOKEN is optional.
set -eu

REPO="litert-community/gemma-4-E2B-it-litert-lm"
FILE="gemma-4-E2B-it-web.task"
DIR="public/models"
MIN_BYTES=1500000000

cd "$(dirname "$0")/.."

echo "Gemma 4 is released under Apache 2.0: https://www.apache.org/licenses/LICENSE-2.0"
echo "Model: https://huggingface.co/$REPO (about 2 GB)"
echo

mkdir -p "$DIR"

if command -v hf >/dev/null 2>&1; then
  hf download "$REPO" "$FILE" --local-dir "$DIR"
elif [ -n "${HF_TOKEN:-}" ]; then
  # The header comes from stdin so the token never shows up in ps or in the output.
  printf 'Authorization: Bearer %s\n' "$HF_TOKEN" |
    curl -fL --progress-bar -H @- -o "$DIR/$FILE.part" \
      "https://huggingface.co/$REPO/resolve/main/$FILE"
  mv "$DIR/$FILE.part" "$DIR/$FILE"
else
  curl -fL --progress-bar -o "$DIR/$FILE.part" \
    "https://huggingface.co/$REPO/resolve/main/$FILE"
  mv "$DIR/$FILE.part" "$DIR/$FILE"
fi

size=$(wc -c < "$DIR/$FILE" | tr -d ' ')
if [ "$size" -le "$MIN_BYTES" ]; then
  echo "error: $DIR/$FILE is $size bytes, expected more than 1500 MB" >&2
  exit 1
fi
echo "ok: $DIR/$FILE ($size bytes)"
