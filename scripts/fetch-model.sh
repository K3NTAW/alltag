#!/bin/sh
# Downloads the Gemma 3 1B web model into public/models/ so the native app ships it.
# Uses the hf CLI when present, else curl with HF_TOKEN (the repo is gated).
set -eu

REPO="litert-community/Gemma3-1B-IT"
FILE="gemma3-1b-it-int4-web.task"
DIR="public/models"
MIN_BYTES=600000000

cd "$(dirname "$0")/.."

echo "Gemma is provided under the Gemma Terms of Use: https://ai.google.dev/gemma/terms"
echo "Prohibited use policy: https://ai.google.dev/gemma/prohibited_use_policy"
echo "Accept the licence on https://huggingface.co/$REPO first. The app must show this notice."
echo

mkdir -p "$DIR"

if command -v hf >/dev/null 2>&1; then
  hf download "$REPO" "$FILE" --local-dir "$DIR"
else
  if [ -z "${HF_TOKEN:-}" ]; then
    echo "error: no hf CLI and HF_TOKEN is not set" >&2
    exit 1
  fi
  # The header comes from stdin so the token never shows up in ps or in the output.
  printf 'Authorization: Bearer %s\n' "$HF_TOKEN" |
    curl -fL --progress-bar -H @- -o "$DIR/$FILE.part" \
      "https://huggingface.co/$REPO/resolve/main/$FILE"
  mv "$DIR/$FILE.part" "$DIR/$FILE"
fi

size=$(wc -c < "$DIR/$FILE" | tr -d ' ')
if [ "$size" -le "$MIN_BYTES" ]; then
  echo "error: $DIR/$FILE is $size bytes, expected more than 600 MB" >&2
  exit 1
fi
echo "ok: $DIR/$FILE ($size bytes)"
