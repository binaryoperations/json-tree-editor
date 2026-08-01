/** Demo page ids used by the shared header / drawer nav. */
export type DemoPage = 'main' | 'large' | 'wc';

export type DemoNavItem = {
  id: DemoPage;
  href: string;
  label: string;
  description: string;
};

export const DEMO_NAV: readonly DemoNavItem[] = [
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
] as const;

export const DEMO_PAGE_LABEL: Record<DemoPage, string> = {
  main: 'Main',
  large: 'Large',
  wc: 'Web component',
};

export const DRAWER_ID = 'demo-nav-drawer';
