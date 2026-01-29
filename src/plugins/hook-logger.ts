/**
 * Plugin Hook Logger
 *
 * Logs all plugin hook events to a JSONL file for debugging and documentation.
 */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const DEFAULT_MAX_EVENTS = 1000;
const DEFAULT_LOG_DIR = path.join(os.homedir(), ".clawdbot", "logs");
const LOG_FILE = "hooks-plugin.jsonl";

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

    // Handle undefined
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
 * Create a plugin hook event logger callback
 */
export function createPluginHookLogger(options?: {
  maxEvents?: number;
  logDir?: string;
}): (params: {
  hookName: string;
  event: unknown;
  ctx: unknown;
  handlerCount: number;
  startTime: number;
}) => void {
  const maxEvents = options?.maxEvents ?? DEFAULT_MAX_EVENTS;
  const logDir = options?.logDir ?? DEFAULT_LOG_DIR;
  const logPath = path.join(logDir, LOG_FILE);

  return (params) => {
    // Queue write to prevent race conditions (multiple hooks firing at once)
    writeQueue = writeQueue.then(async () => {
      try {
        // Ensure log directory exists
        await fs.mkdir(logDir, { recursive: true });

        // Read existing entries
        const existingLines = await readLogEntries(logPath);

        // Create log entry
        const logEntry = {
          timestamp: new Date().toISOString(),
          hookName: params.hookName,
          event: safeSerialize(params.event),
          context: safeSerialize(params.ctx),
          handlerCount: params.handlerCount,
          executionStartedAt: params.startTime,
        };

        // Append and rotate
        existingLines.push(JSON.stringify(logEntry));
        const rotatedLines =
          existingLines.length > maxEvents ? existingLines.slice(-maxEvents) : existingLines;

        // Write back
        await writeLogEntries(logPath, rotatedLines);
      } catch (err) {
        // Log to console but don't throw - logging should fail silently
        console.error(
          "[plugin-hook-logger] Failed to log hook event:",
          err instanceof Error ? err.message : String(err),
        );
      }
    });
  };
}
