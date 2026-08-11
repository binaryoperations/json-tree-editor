import { type Component } from 'solid-js';

export type TreeSearchBarProps = {
  value: string;
  onInput: (next: string) => void;
  /** 1-based active index, or 0 when no matches. */
  activeIndex: number;
  matchCount: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  /** Focus the input after mount / reopen. */
  inputRef?: (el: HTMLInputElement) => void;
};

/**
 * Find bar: query input, match count, prev/next, close.
 */
export const TreeSearchBar: Component<TreeSearchBarProps> = (props) => {
  return (
    <div class="json-tree__search" part="search" role="search">
      <label class="json-tree__search-label">
        <span class="json-tree__search-icon" aria-hidden="true">
          ⌕
        </span>
        <input
          class="json-tree__search-input"
          type="search"
          role="searchbox"
          aria-label="Search keys and values"
          placeholder="Search keys and values…"
          value={props.value}
          ref={(el) => props.inputRef?.(el)}
          onInput={(e) => props.onInput(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              props.onClose();
              return;
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              if (e.shiftKey) props.onPrev();
              else props.onNext();
            }
          }}
        />
      </label>

      <span class="json-tree__search-count" aria-live="polite">
        {props.matchCount === 0
          ? '0 / 0'
          : `${props.activeIndex} / ${props.matchCount}`}
      </span>

      <button
        type="button"
        class="json-tree__search-btn"
        part="action"
        title="Previous match"
        aria-label="Previous match"
        disabled={props.matchCount === 0}
        onClick={() => props.onPrev()}
      >
        ↑
      </button>
      <button
        type="button"
        class="json-tree__search-btn"
        part="action"
        title="Next match"
        aria-label="Next match"
        disabled={props.matchCount === 0}
        onClick={() => props.onNext()}
      >
        ↓
      </button>
      <button
        type="button"
        class="json-tree__search-btn json-tree__search-btn--close"
        part="action"
        title="Close search"
        aria-label="Close search"
        onClick={() => props.onClose()}
      >
        ×
      </button>
    </div>
  );
};
