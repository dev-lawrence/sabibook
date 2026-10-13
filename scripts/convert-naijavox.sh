#!/usr/bin/env bash
# Convert Axiveri/NaijaVox-2.0 to CTranslate2 (float16) so Speaches can serve it.
#
# Runs the conversion inside Docker (python:3.11-slim), so no local Python is needed.
# Output lands in ./models/naijavox-2.0-ct2.
#
# Note: the model adds custom <|pcm|> and <|ig|> language tokens that faster-whisper's
# language list does not know. SabiBook therefore sends no language code for Pidgin and
# Igbo and lets the model detect the language itself.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MODELS_DIR="${PROJECT_ROOT}/models"
OUTPUT_NAME="naijavox-2.0-ct2"

mkdir -p "${MODELS_DIR}"

docker run --rm \
  -v "${MODELS_DIR}:/out" \
  python:3.11-slim \
  sh -c 'pip install --no-cache-dir "ctranslate2" "transformers[torch]" && \
    ct2-transformers-converter \
      --model Axiveri/NaijaVox-2.0 \
      --output_dir /out/'"${OUTPUT_NAME}"' \
      --copy_files tokenizer.json preprocessor_config.json \
      --quantization float16'

echo
echo "Converted model written to: ${MODELS_DIR}/${OUTPUT_NAME}"
echo
echo "Next steps:"
echo "  1. Upload the folder to your own Hugging Face repo:"
echo "       huggingface-cli upload <you>/${OUTPUT_NAME} ./models/${OUTPUT_NAME}"
echo "  2. Register it with Speaches (server must be running on port 8000):"
echo "       curl -X POST http://localhost:8000/v1/models/<you>/${OUTPUT_NAME}"
echo "  3. Set the model id for SabiBook:"
echo "       pnpm exec convex env set ASR_MODEL_NAIJA <you>/${OUTPUT_NAME}"
echo "     and add the same value to .env so docker compose pre-downloads it."
