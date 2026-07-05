#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-check}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

show_usage() {
  cat <<'USAGE'
usage: ./script/build_and_run.sh [mode]

Modes:
  check, run             Check Codex, Supabase, Git, and iOS localhost setup
  --ios, ios             Start the Expo dev server and open iOS Simulator
  --web, web             Start the Expo web dev server
  --export-web, export-web
                         Export the Expo web build locally
  --help, help           Show this help
USAGE
}

case "$MODE" in
  check|run)
    exec npm run codex:check
    ;;
  --ios|ios)
    exec npm run mobile:ios
    ;;
  --web|web)
    exec npm run mobile:web
    ;;
  --export-web|export-web)
    exec npm run mobile:export-web
    ;;
  --help|help)
    show_usage
    ;;
  *)
    show_usage >&2
    exit 2
    ;;
esac
