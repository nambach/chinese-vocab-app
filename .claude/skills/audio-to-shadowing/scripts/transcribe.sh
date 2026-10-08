#!/usr/bin/env bash
# Usage: transcribe.sh SOURCE.mp3 WORK_DIR
# Writes WORK_DIR/audio16k.wav (ASR input only) and WORK_DIR/asr.json (whisper.cpp full JSON).
#
# No --vad on purpose: with whisper.cpp VAD, segment offsets are mapped back to the
# original timeline but token offsets are not. -mc 0 keeps Whisper from repeating text
# into the silent "repeat after me" gaps.
set -euo pipefail

SOURCE="${1:?usage: transcribe.sh SOURCE.mp3 WORK_DIR}"
WORK="${2:?usage: transcribe.sh SOURCE.mp3 WORK_DIR}"
MODEL="${WHISPER_MODEL:-$HOME/.cache/whisper/ggml-large-v3.bin}"
PROMPT="以下是普通话课文，使用简体中文。"

command -v whisper-cli >/dev/null || { echo "whisper-cli missing: brew install whisper-cpp" >&2; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg missing: brew install ffmpeg" >&2; exit 1; }
[[ -f "$MODEL" ]] || { echo "model missing: $MODEL" >&2; exit 1; }

mkdir -p "$WORK"
ffmpeg -v error -y -i "$SOURCE" -ar 16000 -ac 1 -c:a pcm_s16le "$WORK/audio16k.wav"
whisper-cli -m "$MODEL" -l zh --prompt "$PROMPT" -mc 0 -ojf -np \
  -of "$WORK/asr" -f "$WORK/audio16k.wav" > "$WORK/asr.txt" 2> "$WORK/asr.log"

echo "wrote $WORK/asr.json ($(grep -c '"offsets"' "$WORK/asr.json") offset entries)"
