---
name: hook-logger
description: "Log all internal hook events for debugging and documentation"
homepage: https://docs.molt.bot/hooks#hook-logger
metadata:
  {
    "moltbot":
      {
        "emoji": "🪝",
        "events": ["command", "agent", "gateway", "session"],
        "install": [{ "id": "bundled", "kind": "bundled", "label": "Bundled with Moltbot" }],
      },
  }
---

# Hook Logger

Logs all internal hook events (commands, agent lifecycle, gateway startup, sessions) to a centralized debug log for understanding the hook system and debugging hook-related issues.

## What It Does

Every time an internal hook event fires:

1. **Captures complete event data** - Type, action, session key, context, timestamp
2. **Safely serializes** - Handles circular references, functions, and complex objects
3. **Rotates automatically** - Keeps only the last N events (default: 1000) to prevent unbounded disk growth
4. **Writes to JSONL** - Appends to `~/.clawdbot/logs/hooks-internal.jsonl`

## Events Logged

This hook captures ALL internal hook events:

- **command** - All command events (new, reset, stop, etc.)
- **agent** - Agent lifecycle events (bootstrap, etc.)
- **gateway** - Gateway events (startup, shutdown, etc.)
- **session** - Session lifecycle events (start, end, etc.)

## Output Format

Log entries are written in JSONL (JSON Lines) format:

```json
{"timestamp":"2026-01-29T12:00:00.000Z","type":"command","action":"new","sessionKey":"agent:main:main","context":{"senderId":"+1234567890","commandSource":"telegram"},"messageCount":0}
{"timestamp":"2026-01-29T12:00:01.000Z","type":"gateway","action":"startup","sessionKey":"gateway:startup","context":{"workspaceDir":"/home/user/clawd"},"messageCount":0}
```

## Use Cases

- **Discovery** - See what hooks are available and when they fire
- **Debugging** - Understand hook execution order and data flow
- **Documentation** - Auto-generates "living documentation" via event logs
- **Development** - Build new hooks by seeing what data is available

## Log File Location

`~/.clawdbot/logs/hooks-internal.jsonl`

## Requirements

No requirements - this hook works out of the box on all platforms.

## Configuration

### Basic Usage

Enable the hook (disabled by default):

```bash
moltbot hooks enable hook-logger
```

### Advanced Configuration

Configure maximum events to keep:

```json
{
  "hooks": {
    "internal": {
      "entries": {
        "hook-logger": {
          "enabled": true,
          "maxEvents": 1000
        }
      }
    }
  }
}
```

**Options:**
- `enabled` - Enable/disable logging (default: false)
- `maxEvents` - Maximum events to keep in log file (default: 1000)

## Log Rotation

The hook automatically rotates logs to keep only the most recent N events (default: 1000). This prevents unbounded disk growth while preserving recent history for debugging.

**How it works:**
1. Reads existing log file
2. Appends new event
3. Keeps only last N events
4. Writes back to file

**Note:** This means very old events will be automatically pruned. If you need long-term archival, copy the log file periodically.

## Disabling

To disable this hook:

```bash
moltbot hooks disable hook-logger
```

Or via config:

```json
{
  "hooks": {
    "internal": {
      "entries": {
        "hook-logger": { "enabled": false }
      }
    }
  }
}
```

## Viewing Logs

View recent events:

```bash
tail -n 20 ~/.clawdbot/logs/hooks-internal.jsonl
```

Pretty-print with jq:

```bash
cat ~/.clawdbot/logs/hooks-internal.jsonl | jq .
```

Filter by event type:

```bash
grep '"type":"command"' ~/.clawdbot/logs/hooks-internal.jsonl | jq .
```

Filter by specific action:

```bash
grep '"action":"new"' ~/.clawdbot/logs/hooks-internal.jsonl | jq .
```

View only recent command events:

```bash
tail -100 ~/.clawdbot/logs/hooks-internal.jsonl | grep '"type":"command"' | jq .
```

## Privacy Note

This hook logs **complete event payloads** including any data in the context object. This may include:
- Message content
- Session keys
- Sender IDs
- Configuration values
- File paths

**Security considerations:**
- Log files are stored in `~/.clawdbot/logs/` with default user permissions
- Control access via file system permissions
- Disable this hook when handling highly sensitive data
- The hook does NOT redact any fields

## Performance

The hook performs a read-modify-write operation on each event to maintain rotation. For very high-throughput scenarios (thousands of events per second), this may add latency. In typical usage, the performance impact is negligible.
