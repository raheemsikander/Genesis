#!/bin/bash
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
RULES_FILE="$PROJECT_DIR/docs/engineering/proposed-rules.md"

if [ ! -f "$RULES_FILE" ]; then
  exit 0
fi

# Count entries (lines starting with "- ")
ENTRIES=$(grep -c '^- ' "$RULES_FILE" 2>/dev/null || true)
ENTRIES=${ENTRIES:-0}

if [ "$ENTRIES" -gt 0 ]; then
  echo "There are $ENTRIES pending rule proposal(s) in docs/engineering/proposed-rules.md."
  echo "Please review them with the user and ask which to promote to CLAUDE.md Gotchas section, reject, or keep pending."
  echo ""
  cat "$RULES_FILE"
fi

exit 0
