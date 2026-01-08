class MultiSelect extends HTMLElement {
  private _label: string = '';
  private _placeholder: string = '';
  private _options: Array<{ value: string; label: string }> = [];
  private _selectedValues: Set<string> = new Set();
  private _open: boolean = false;

  static get observedAttributes() {
    return ['label', 'placeholder', 'options'];
  }

  get label(): string {
    return this._label;
  }

  set label(value: string) {
    this._label = value;
    this.setAttribute('label', value);
  }

  get placeholder(): string {
    return this._placeholder;
  }

  set placeholder(value: string) {
    this._placeholder = value;
    this.setAttribute('placeholder', value);
  }

  get options(): Array<{ value: string; label: string }> {
    return this._options;
  }

  set options(value: Array<{ value: string; label: string }>) {
    this._options = value;
    this.setAttribute('options', JSON.stringify(value));
  }

  get selected(): string[] {
    return Array.from(this._selectedValues);
  }

  set selected(values: string[]) {
    this._selectedValues = new Set(values);
    this.render();
    this.dispatchChangeEvent();
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue !== newValue) {
      if (name === 'label') {
        this._label = newValue || '';
      } else if (name === 'placeholder') {
        this._placeholder = newValue || '';
      } else if (name === 'options') {
        try {
          this._options = newValue ? JSON.parse(newValue) : [];
        } catch (e) {
          console.error('Invalid options JSON:', e);
          this._options = [];
        }
      }
      this.render();
    }
  }

  connectedCallback() {
    this._label = this.getAttribute('label') || '';
    this._placeholder = this.getAttribute('placeholder') || 'Select options...';
    
    const optionsAttr = this.getAttribute('options');
    if (optionsAttr) {
      try {
        this._options = JSON.parse(optionsAttr);
      } catch (e) {
        console.error('Invalid options JSON:', e);
        this._options = [];
      }
    }

    this.render();
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (this._open && !this.shadowRoot?.contains(e.target as Node)) {
        this._open = false;
        this.render();
      }
    });

    // Handle escape key
    this.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._open) {
        this._open = false;
        this.render();
      }
    });
  }

  private toggleDropdown() {
    this._open = !this._open;
    this.render();
  }

  private toggleOption(value: string) {
    if (this._selectedValues.has(value)) {
      this._selectedValues.delete(value);
    } else {
      this._selectedValues.add(value);
    }
    this.render();
    this.dispatchChangeEvent();
  }

  private dispatchChangeEvent() {
    this.dispatchEvent(new CustomEvent('change', {
      detail: { selected: this.selected },
      bubbles: true,
      composed: true
    }));
  }

  private getDisplayText(): string {
    if (this._selectedValues.size === 0) {
      return this._placeholder;
    }
    if (this._selectedValues.size === 1) {
      const selectedOption = this._options.find(opt => this._selectedValues.has(opt.value));
      return selectedOption?.label || selectedOption?.value || '';
    }
    return `${this._selectedValues.size} selected`;
  }

  private render() {
    const displayText = this.getDisplayText();

    this.attachShadow({ mode: 'open' });
    
    this.shadowRoot!.innerHTML = `
      <style>
        :host {
          display: block;
          position: relative;
          width: 100%;
        }

        .multi-select-container {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .label {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.78);
          font-weight: 500;
        }

        .select-button {
          position: relative;
          width: 100%;
          padding: 10px 12px;
          padding-right: 36px;
          border-radius: 12px;
          border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
          background: rgba(0, 0, 0, 0.25);
          color: var(--text, rgba(255, 255, 255, 0.92));
          font: inherit;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s ease;
          min-height: 42px;
          display: flex;
          align-items: center;
        }

        .select-button:hover {
          border-color: rgba(255, 255, 255, 0.2);
          background: rgba(0, 0, 0, 0.35);
        }

        .select-button:focus {
          outline: none;
          border-color: rgba(125, 211, 252, 0.45);
          box-shadow: 0 0 0 2px rgba(125, 211, 252, 0.1);
        }

        .select-button[aria-expanded="true"] {
          border-color: rgba(125, 211, 252, 0.45);
          background: rgba(0, 0, 0, 0.35);
        }

        .select-button-text {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .select-button-text.placeholder {
          color: rgba(255, 255, 255, 0.5);
        }

        .select-button-icon {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          transition: transform 0.2s ease;
          color: rgba(255, 255, 255, 0.6);
        }

        .select-button[aria-expanded="true"] .select-button-icon {
          transform: translateY(-50%) rotate(180deg);
        }

        .dropdown {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          z-index: 1000;
          background: rgba(7, 10, 18, 0.98);
          border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
          max-height: 300px;
          overflow-y: auto;
          display: none;
        }

        .dropdown.open {
          display: block;
        }

        .option {
          padding: 10px 12px;
          cursor: pointer;
          transition: background 0.15s ease;
          display: flex;
          align-items: center;
          gap: 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .option:last-child {
          border-bottom: none;
        }

        .option:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .option-checkbox {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.15s ease;
        }

        .option.selected .option-checkbox {
          background: rgba(125, 211, 252, 0.2);
          border-color: rgba(125, 211, 252, 0.6);
        }

        .option-checkbox::after {
          content: '✓';
          color: rgba(125, 211, 252, 1);
          font-size: 12px;
          display: none;
        }

        .option.selected .option-checkbox::after {
          display: block;
        }

        .option-label {
          flex: 1;
          color: rgba(255, 255, 255, 0.92);
          font-size: 14px;
        }

        .option.selected .option-label {
          color: rgba(255, 255, 255, 0.95);
        }

        /* Scrollbar styling */
        .dropdown::-webkit-scrollbar {
          width: 8px;
        }

        .dropdown::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 4px;
        }

        .dropdown::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
        }

        .dropdown::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      </style>
      <div class="multi-select-container">
        ${this._label ? `<div class="label">${this._label}</div>` : ''}
        <button 
          class="select-button" 
          type="button"
          aria-expanded="${this._open}"
          aria-haspopup="listbox"
          role="combobox"
        >
          <span class="select-button-text ${this._selectedValues.size === 0 ? 'placeholder' : ''}">
            ${displayText}
          </span>
          <span class="select-button-icon">▼</span>
        </button>
        <div class="dropdown ${this._open ? 'open' : ''}" role="listbox">
          ${this._options.map(option => {
            const isSelected = this._selectedValues.has(option.value);
            return `
              <div 
                class="option ${isSelected ? 'selected' : ''}" 
                role="option"
                aria-selected="${isSelected}"
                data-value="${option.value}"
              >
                <div class="option-checkbox"></div>
                <span class="option-label">${option.label}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Attach event listeners
    const button = this.shadowRoot!.querySelector('.select-button');
    const options = this.shadowRoot!.querySelectorAll('.option');

    button?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDropdown();
    });

    options.forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        const value = option.getAttribute('data-value');
        if (value) {
          this.toggleOption(value);
        }
      });
    });
  }
}

customElements.define('multi-select', MultiSelect);

