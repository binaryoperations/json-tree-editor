import { For, type ParentComponent } from 'solid-js';

import {
  DEMO_NAV,
  DEMO_PAGE_LABEL,
  DRAWER_ID,
  type DemoPage,
} from '../shell/nav';

import '../shell/header.css';

export type DemoHeaderProps = {
  page: DemoPage;
};

/**
 * Shared demo chrome: brand, current-page badge, hamburger menu, and a
 * left-sliding nav drawer built with the HTML Popover API.
 */
export const DemoHeader: ParentComponent<DemoHeaderProps> = (props) => {
  let drawerEl: HTMLDivElement | undefined;

  const closeDrawer = () => {
    drawerEl?.hidePopover?.();
  };

  return (
    <>
      <header class="demo-header">
        <div class="demo-header__left">
          <button
            type="button"
            class="demo-header__menu"
            attr:popovertarget={DRAWER_ID}
            aria-haspopup="dialog"
            aria-label="Open navigation menu"
          >
            <span class="demo-header__menu-icon" aria-hidden="true">
              <span />
            </span>
          </button>
          <a class="demo-header__brand" href="/">
            json-tree-editor
          </a>
          <span class="demo-header__page">{DEMO_PAGE_LABEL[props.page]}</span>
        </div>
        <div class="demo-header__right">{props.children}</div>
      </header>

      <div
        id={DRAWER_ID}
        class="demo-drawer"
        attr:popover="auto"
        role="dialog"
        aria-label="Demo navigation"
        ref={(el) => {
          drawerEl = el;
        }}
      >
        <div class="demo-drawer__inner">
          <div class="demo-drawer__top">
            <p class="demo-drawer__title">Demos</p>
            <button
              type="button"
              class="demo-drawer__close"
              aria-label="Close navigation menu"
              onClick={closeDrawer}
            >
              ×
            </button>
          </div>
          <nav class="demo-drawer__nav" aria-label="Demo pages">
            <For each={[...DEMO_NAV]}>
              {(item) => (
                <a
                  class="demo-drawer__link"
                  classList={{
                    'demo-drawer__link--current': item.id === props.page,
                  }}
                  href={item.href}
                  aria-current={item.id === props.page ? 'page' : undefined}
                >
                  <span class="demo-drawer__link-label">{item.label}</span>
                  <span class="demo-drawer__link-desc">{item.description}</span>
                </a>
              )}
            </For>
          </nav>
          <p class="demo-drawer__footer">json-tree-editor demos</p>
        </div>
      </div>
    </>
  );
};

/** Convenience re-export for page typing at call sites. */
export type { DemoPage };
