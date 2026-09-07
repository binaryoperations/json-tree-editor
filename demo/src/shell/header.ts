/**
 * Vanilla mount for the shared demo header + Popover drawer.
 * Used by the web-component demo (no Solid host).
 */
import {
  DEMO_NAV_SECTIONS,
  DEMO_PAGE_LABEL,
  DRAWER_ID,
  type DemoPage,
} from './nav';

import './header.css';

export type MountDemoHeaderOptions = {
  /** Element that will receive the header + drawer (typically a placeholder). */
  target: HTMLElement;
  page: DemoPage;
  /** Optional nodes appended into the header’s right cluster. */
  actions?: Node | null;
};

function hamburgerIcon(): HTMLElement {
  const icon = document.createElement('span');
  icon.className = 'demo-header__menu-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.appendChild(document.createElement('span'));
  return icon;
}

/**
 * Builds and inserts the shared chrome into `target`.
 * Replaces any previous children of `target`.
 */
export function mountDemoHeader(options: MountDemoHeaderOptions): void {
  const { target, page, actions } = options;
  const pageLabel = DEMO_PAGE_LABEL[page];

  const header = document.createElement('header');
  header.className = 'demo-header';

  const left = document.createElement('div');
  left.className = 'demo-header__left';

  const menuBtn = document.createElement('button');
  menuBtn.type = 'button';
  menuBtn.className = 'demo-header__menu';
  menuBtn.setAttribute('popovertarget', DRAWER_ID);
  menuBtn.setAttribute('aria-haspopup', 'dialog');
  menuBtn.setAttribute('aria-label', 'Open navigation menu');
  menuBtn.appendChild(hamburgerIcon());

  const brand = document.createElement('a');
  brand.className = 'demo-header__brand';
  brand.href = '/';
  brand.textContent = 'json-tree-editor';

  const pageBadge = document.createElement('span');
  pageBadge.className = 'demo-header__page';
  pageBadge.textContent = pageLabel;

  left.append(menuBtn, brand, pageBadge);

  const right = document.createElement('div');
  right.className = 'demo-header__right';
  if (actions) right.appendChild(actions);

  header.append(left, right);

  const drawer = document.createElement('div');
  drawer.id = DRAWER_ID;
  drawer.className = 'demo-drawer';
  drawer.setAttribute('popover', 'auto');
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-label', 'Demo navigation');

  const inner = document.createElement('div');
  inner.className = 'demo-drawer__inner';

  const top = document.createElement('div');
  top.className = 'demo-drawer__top';

  const title = document.createElement('p');
  title.className = 'demo-drawer__title';
  title.textContent = 'Demos';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'demo-drawer__close';
  closeBtn.setAttribute('aria-label', 'Close navigation menu');
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => {
    if (typeof drawer.hidePopover === 'function') {
      drawer.hidePopover();
    }
  });

  top.append(title, closeBtn);

  const nav = document.createElement('nav');
  nav.className = 'demo-drawer__nav';
  nav.setAttribute('aria-label', 'Demo pages');

  for (const section of DEMO_NAV_SECTIONS) {
    const sectionEl = document.createElement('div');
    sectionEl.className = 'demo-drawer__section';

    if (section.label) {
      const sectionLabel = document.createElement('p');
      sectionLabel.className = 'demo-drawer__section-label';
      sectionLabel.textContent = section.label;
      sectionEl.appendChild(sectionLabel);
    }

    for (const item of section.items) {
      const link = document.createElement('a');
      link.className = 'demo-drawer__link';
      if (item.id === page) {
        link.classList.add('demo-drawer__link--current');
        link.setAttribute('aria-current', 'page');
      }
      link.href = item.href;

      const label = document.createElement('span');
      label.className = 'demo-drawer__link-label';
      label.textContent = item.label;

      const desc = document.createElement('span');
      desc.className = 'demo-drawer__link-desc';
      desc.textContent = item.description;

      link.append(label, desc);
      sectionEl.appendChild(link);
    }

    nav.appendChild(sectionEl);
  }

  const footer = document.createElement('p');
  footer.className = 'demo-drawer__footer';
  footer.textContent = 'json-tree-editor demos';

  inner.append(top, nav, footer);
  drawer.appendChild(inner);

  target.replaceChildren(header, drawer);
}
