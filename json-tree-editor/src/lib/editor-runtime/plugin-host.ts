import type { CommandRegistry } from './command-registry';
import type {
  JsonTreeEditorPlugin,
  PluginContext,
  TransactionEvent,
} from './types';

type Installed = {
  name: string;
  dispose?: () => void;
};

export type PluginContextFactory = (pluginName: string) => PluginContext;

/**
 * Plugin install table: identity by `name` only.
 * Teardown isolates errors so one failing disposer cannot skip others.
 */
export class PluginHost {
  #installed = new Map<string, Installed>();
  /** Installation order for reverse teardown. */
  #order: string[] = [];
  #txListeners = new Set<(e: TransactionEvent) => void>();
  /** Per-plugin unsubs from `ctx.onTransaction` (auto-cleared on teardown). */
  #txUnsubsByPlugin = new Map<string, Set<() => void>>();
  #commands: CommandRegistry;
  #createContext: PluginContextFactory;
  #tearingDown = new Set<string>();

  constructor(
    commands: CommandRegistry,
    createContext: PluginContextFactory,
  ) {
    this.#commands = commands;
    this.#createContext = createContext;
  }

  get size(): number {
    return this.#installed.size;
  }

  has(name: string): boolean {
    return this.#installed.has(name);
  }

  isTearingDown(name: string): boolean {
    return this.#tearingDown.has(name);
  }

  /**
   * Subscribe to document transactions. When `pluginName` is set, the
   * subscription is removed automatically on that plugin's teardown.
   */
  onTransaction(
    cb: (e: TransactionEvent) => void,
    pluginName?: string,
  ): () => void {
    this.#txListeners.add(cb);
    const unsub = () => {
      this.#txListeners.delete(cb);
      if (pluginName) {
        this.#txUnsubsByPlugin.get(pluginName)?.delete(unsub);
      }
    };
    if (pluginName) {
      let set = this.#txUnsubsByPlugin.get(pluginName);
      if (!set) {
        set = new Set();
        this.#txUnsubsByPlugin.set(pluginName, set);
      }
      set.add(unsub);
    }
    return unsub;
  }

  notifyTransaction(event: TransactionEvent): void {
    // Snapshot so listeners may subscribe/unsubscribe mid-wave.
    const listeners = [...this.#txListeners];
    for (const cb of listeners) {
      try {
        cb(event);
      } catch (err) {
        console.error(
          '[json-tree-editor] plugin onTransaction listener threw:',
          err,
        );
      }
    }
  }

  /**
   * Sync plugin list by name: teardown removed, setup new (list order).
   * Same name → keep existing instance (no option hot-reload).
   */
  setPlugins(plugins: JsonTreeEditorPlugin[]): void {
    const desired = new Set<string>();
    const uniqueInOrder: JsonTreeEditorPlugin[] = [];
    for (const p of plugins) {
      if (desired.has(p.name)) {
        console.error(
          `[json-tree-editor] duplicate plugin name "${p.name}" in plugins list; skipping second setup`,
        );
        continue;
      }
      desired.add(p.name);
      uniqueInOrder.push(p);
    }

    // Teardown names no longer present (reverse install order).
    for (let i = this.#order.length - 1; i >= 0; i -= 1) {
      const name = this.#order[i];
      if (!desired.has(name)) {
        this.teardown(name);
      }
    }

    // Setup new names in list order.
    for (const plugin of uniqueInOrder) {
      if (!this.#installed.has(plugin.name)) {
        this.setup(plugin);
      }
    }
  }

  /**
   * Install one plugin. Duplicate name → console.error, skip setup.
   * Returns dispose that teardowns this install (no-op if skipped).
   */
  use(plugin: JsonTreeEditorPlugin): () => void {
    if (this.#installed.has(plugin.name)) {
      console.error(
        `[json-tree-editor] plugin "${plugin.name}" is already registered; skipping second setup`,
      );
      return () => {
        /* no-op — caller did not own this install */
      };
    }
    this.setup(plugin);
    return () => {
      this.teardown(plugin.name);
    };
  }

  setup(plugin: JsonTreeEditorPlugin): void {
    if (this.#installed.has(plugin.name)) return;

    const ctx = this.#createContext(plugin.name);
    let dispose: (() => void) | undefined;
    try {
      const result = plugin.setup(ctx);
      if (typeof result === 'function') dispose = result;
    } catch (err) {
      console.error(
        `[json-tree-editor] plugin "${plugin.name}" setup threw:`,
        err,
      );
      // Still record as installed so name uniqueness holds; no dispose.
      this.#installed.set(plugin.name, { name: plugin.name });
      this.#order.push(plugin.name);
      return;
    }

    this.#installed.set(plugin.name, { name: plugin.name, dispose });
    this.#order.push(plugin.name);
  }

  teardown(name: string): void {
    const entry = this.#installed.get(name);
    if (!entry) return;

    this.#tearingDown.add(name);
    try {
      // Drop onTransaction subscriptions owned by this plugin first.
      const unsubs = this.#txUnsubsByPlugin.get(name);
      if (unsubs) {
        for (const unsub of [...unsubs]) {
          unsub();
        }
        this.#txUnsubsByPlugin.delete(name);
      }
      if (entry.dispose) {
        try {
          entry.dispose();
        } catch (err) {
          console.error(
            `[json-tree-editor] plugin "${name}" dispose threw:`,
            err,
          );
        }
      }
    } finally {
      this.#commands.unregisterPlugin(name);
      this.#installed.delete(name);
      this.#order = this.#order.filter((n) => n !== name);
      this.#tearingDown.delete(name);
    }
  }

  /** Teardown all plugins in reverse install order. */
  disposeAll(): void {
    const names = [...this.#order].reverse();
    for (const name of names) {
      this.teardown(name);
    }
    this.#txListeners.clear();
    this.#txUnsubsByPlugin.clear();
    this.#commands.clear();
  }
}
