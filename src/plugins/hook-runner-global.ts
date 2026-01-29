/**
 * Global Plugin Hook Runner
 *
 * Singleton hook runner that's initialized when plugins are loaded
 * and can be called from anywhere in the codebase.
 */

import { createSubsystemLogger } from "../logging/subsystem.js";
import { createHookRunner, type HookRunner } from "./hooks.js";
import { createPluginHookLogger } from "./hook-logger.js";
import type { PluginRegistry } from "./registry.js";
import type { MoltbotConfig } from "../config/config.js";

const log = createSubsystemLogger("plugins");

let globalHookRunner: HookRunner | null = null;
let globalRegistry: PluginRegistry | null = null;

/**
 * Initialize the global hook runner with a plugin registry.
 * Called once when plugins are loaded during gateway startup.
 */
export function initializeGlobalHookRunner(registry: PluginRegistry, config?: MoltbotConfig): void {
  globalRegistry = registry;

  // Check if plugin hook logging is enabled
  const loggingEnabled = config?.hooks?.logging?.enabled ?? false;
  const maxEvents = config?.hooks?.logging?.maxEvents ?? 1000;
  const logPath = config?.hooks?.logging?.path;

  globalHookRunner = createHookRunner(registry, {
    logger: {
      debug: (msg) => log.debug(msg),
      warn: (msg) => log.warn(msg),
      error: (msg) => log.error(msg),
    },
    catchErrors: true,
    onHookEvent: loggingEnabled
      ? createPluginHookLogger({ maxEvents, logDir: logPath })
      : undefined,
  });

  const hookCount = registry.hooks.length;
  if (hookCount > 0) {
    log.info(`hook runner initialized with ${hookCount} registered hooks`);
    if (loggingEnabled) {
      log.info("plugin hook logging enabled");
    }
  }
}

/**
 * Get the global hook runner.
 * Returns null if plugins haven't been loaded yet.
 */
export function getGlobalHookRunner(): HookRunner | null {
  return globalHookRunner;
}

/**
 * Get the global plugin registry.
 * Returns null if plugins haven't been loaded yet.
 */
export function getGlobalPluginRegistry(): PluginRegistry | null {
  return globalRegistry;
}

/**
 * Check if any hooks are registered for a given hook name.
 */
export function hasGlobalHooks(hookName: Parameters<HookRunner["hasHooks"]>[0]): boolean {
  return globalHookRunner?.hasHooks(hookName) ?? false;
}

/**
 * Reset the global hook runner (for testing).
 */
export function resetGlobalHookRunner(): void {
  globalHookRunner = null;
  globalRegistry = null;
}
