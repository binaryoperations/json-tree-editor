/** Demo page ids used by the shared header / drawer nav. */
export type DemoPage = 'main' | 'large' | 'wc' | 'history';

export type DemoNavItem = {
  id: DemoPage;
  href: string;
  label: string;
  description: string;
};

/** Grouped drawer sections. `label` is a sub-header when present. */
export type DemoNavSection = {
  id: string;
  /** Optional section sub-header shown above the links. */
  label?: string;
  items: readonly DemoNavItem[];
};

export const DEMO_NAV_SECTIONS: readonly DemoNavSection[] = [
  {
    id: 'core',
    items: [
      {
        id: 'main',
        href: '/',
        label: 'Main demo',
        description: 'Three-pane Solid editor',
      },
      {
        id: 'large',
        href: '/large.html',
        label: 'Large tree',
        description: 'Stress test · ~5k nodes',
      },
      {
        id: 'wc',
        href: '/wc.html',
        label: 'Web component',
        description: 'Vanilla custom element host',
      },
    ],
  },
  {
    id: 'plugins',
    label: 'Plugins',
    items: [
      {
        id: 'history',
        href: '/history.html',
        label: 'History plugin',
        description: 'Path-scoped undo / redo',
      },
    ],
  },
] as const;

/** Flat list for simple iteration (status bars, etc.). */
export const DEMO_NAV: readonly DemoNavItem[] = DEMO_NAV_SECTIONS.flatMap(
  (section) => section.items,
);

export const DEMO_PAGE_LABEL: Record<DemoPage, string> = {
  main: 'Main',
  large: 'Large',
  wc: 'Web component',
  history: 'History',
};

export const DRAWER_ID = 'demo-nav-drawer';
