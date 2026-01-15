#!/bin/bash

# Setup Claude Code agents for this project
# Run this script after cloning the repo or when agents are updated

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
AGENTS_SOURCE="$PROJECT_ROOT/.claude-agents"
AGENTS_DEST="$HOME/.claude/agents"

echo "Setting up Claude Code agents..."

# Create destination directory if it doesn't exist
if [ ! -d "$AGENTS_DEST" ]; then
    echo "Creating agents directory: $AGENTS_DEST"
    mkdir -p "$AGENTS_DEST"
fi

# Check if source directory exists
if [ ! -d "$AGENTS_SOURCE" ]; then
    echo "Error: Source agents directory not found: $AGENTS_SOURCE"
    exit 1
fi

# Count agents to install
AGENT_COUNT=$(find "$AGENTS_SOURCE" -name "*.md" | wc -l | tr -d ' ')

if [ "$AGENT_COUNT" -eq 0 ]; then
    echo "No agent files found in $AGENTS_SOURCE"
    exit 0
fi

echo "Found $AGENT_COUNT agent(s) to install"

# Copy each agent file
for agent_file in "$AGENTS_SOURCE"/*.md; do
    if [ -f "$agent_file" ]; then
        filename=$(basename "$agent_file")
        echo "  Installing: $filename"
        cp "$agent_file" "$AGENTS_DEST/$filename"
    fi
done

echo ""
echo "Done! Installed $AGENT_COUNT agent(s) to $AGENTS_DEST"
echo ""
echo "Available agents:"
for agent_file in "$AGENTS_SOURCE"/*.md; do
    if [ -f "$agent_file" ]; then
        filename=$(basename "$agent_file" .md)
        echo "  - $filename"
    fi
done
