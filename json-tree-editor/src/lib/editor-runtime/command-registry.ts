import type {
  RegisterCommandOptions,
  RegisterCommandResult,
} from './types';

type MasterEntry = {
  masterPluginName: string;
  impl: (...args: unknown[]) => unknown;
};

/**
 * First registrant is master; only master serves `callCommand`.
 * Subordinates are not stored as fallback. Master teardown removes the command
 * (no promote-on-teardown).
 */
export class CommandRegistry {
  #masters = new Map<string, MasterEntry>();

  register(
    pluginName: string,
    command: string,
    impl: (...args: unknown[]) => unknown,
    options?: RegisterCommandOptions,
  ): RegisterCommandResult {
    const existing = this.#masters.get(command);
    if (!existing) {
      this.#masters.set(command, { masterPluginName: pluginName, impl });
      return { role: 'master', masterPluginName: pluginName };
    }

    // Subordinate — do not store impl; optional callback + exclusive error.
    const masterPluginName = existing.masterPluginName;
    options?.onBecomeSubordinate?.({ command, masterPluginName });
    if (options?.exclusive) {
      console.error(
        `[json-tree-editor] exclusive command "${command}" already mastered by plugin "${masterPluginName}"; ` +
          `plugin "${pluginName}" registered as subordinate (broken install — fix plugin order or use packageHistory).`,
      );
    }
    return { role: 'subordinate', masterPluginName };
  }

  /** Remove every command mastered by `pluginName`. */
  unregisterPlugin(pluginName: string): void {
    for (const [command, entry] of this.#masters) {
      if (entry.masterPluginName === pluginName) {
        this.#masters.delete(command);
      }
    }
  }

  callCommand<T = unknown>(
    name: string,
    ...args: unknown[]
  ): T | undefined {
    const entry = this.#masters.get(name);
    if (!entry) return undefined;
    return entry.impl(...args) as T;
  }

  hasCommand(name: string): boolean {
    return this.#masters.has(name);
  }

  clear(): void {
    this.#masters.clear();
  }
}
