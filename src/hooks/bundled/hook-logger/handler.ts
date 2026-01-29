/**
 * Hook Logger - Log all internal hook events for debugging
 *
 * This handler logs all internal hook events (command, agent, gateway, session)
 * to a JSONL file with automatic rotation to prevent unbounded disk growth.
 */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { HookHandler } from "../../hooks.js";

const DEFAULT_MAX_EVENTS = 1000;

// Write queue to prevent race conditions
let writeQueue = Promise.resolve();

/**
 * Safely serialize objects, handling circular references, functions, and other
 * non-serializable values.
 */
function safeSerialize(obj: unknown): unknown {
  const seen = new WeakSet();

  const replacer = (_key: string, value: unknown): unknown => {
    // Handle functions
    if (typeof value === "function") {
      return "[Function]";
    }

    // Handle circular references
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return "[Circular]";
      }
      seen.add(value);
    }

    // Handle undefined (JSON.stringify drops these)
    if (value === undefined) {
      return "[undefined]";
    }

    return value;
  };

  try {
    const jsonString = JSON.stringify(obj, replacer);
    return JSON.parse(jsonString);
  } catch (err) {
    return `[Serialization Error: ${err instanceof Error ? err.message : String(err)}]`;
  }
}

/**
 * Read existing log entries from file
 */
async function readLogEntries(logPath: string): Promise<string[]> {
  try {
    const content = await fs.readFile(logPath, "utf-8");
    return content.trim().split("\n").filter(Boolean);
  } catch (err) {
    // File doesn't exist yet or can't be read - that's fine
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

/**
 * Write log entries to file
 */
async function writeLogEntries(logPath: string, entries: string[]): Promise<void> {
  const content = entries.join("\n") + "\n";
  await fs.writeFile(logPath, content, "utf-8");
}

/**
 * Main hook handler - logs all internal hook events
 */
const hookLogger: HookHandler = async (event) => {
  // Queue write to prevent race conditions (multiple hooks firing at once)
  writeQueue = writeQueue.then(async () => {
    try {
      // Create log directory
      const logDir = path.join(os.homedir(), ".clawdbot", "logs");
      await fs.mkdir(logDir, { recursive: true });

      const logPath = path.join(logDir, "hooks-internal.jsonl");

      // Read existing log entries
      const existingLines = await readLogEntries(logPath);

      // Create new log entry
      const logEntry = {
        timestamp: event.timestamp.toISOString(),
        type: event.type,
        action: event.action,
        sessionKey: event.sessionKey,
        context: safeSerialize(event.context),
        messageCount: event.messages.length,
      };

      // Append new entry
      existingLines.push(JSON.stringify(logEntry));

      // Get maxEvents from config (TODO: wire this up properly)
      // For now, use default
      const maxEvents = DEFAULT_MAX_EVENTS;

      // Rotate: keep only last N events
      const rotatedLines =
        existingLines.length > maxEvents ? existingLines.slice(-maxEvents) : existingLines;

      // Write back to file
      await writeLogEntries(logPath, rotatedLines);
    } catch (err) {
      // Log error but don't throw - hooks should fail gracefully
      console.error(
        "[hook-logger] Failed to log hook event:",
        err instanceof Error ? err.message : String(err),
      );
    }
  });
};

export default hookLogger;
