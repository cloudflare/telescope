export class MetricItem extends HTMLElement {
  static observedAttributes = ['label', 'value', 'unit', 'description', 'size', 'border-color', 'subtitle'];
  private _label = '';
  private _value: string | number | null = null;
  private _unit = '';
  private _description = '';
  private _size: 'small' | 'medium' | 'large' = 'medium';
  private _borderColor = '';
  private _subtitle = '';

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback(name: string, _old: string, newVal: string) {
    if (name === 'label') this._label = newVal;
    if (name === 'value') this._value = newVal === '' ? null : (isNaN(Number(newVal)) ? newVal : Number(newVal));
    if (name === 'unit') this._unit = newVal;
    if (name === 'description') this._description = newVal;
    if (name === 'size') this._size = (newVal as any) || 'medium';
    if (name === 'border-color') this._borderColor = newVal;
    if (name === 'subtitle') this._subtitle = newVal;
    this.render();
  }

  formatValue(): string {
    if (this._value == null || this._value === '') return 'N/A';
    if (typeof this._value === 'number') {
      // For time-based metrics, show as integers; for CLS show 4 decimal places
      const decimals = this._unit === 'ms' ? 0 : this._label === 'CLS' ? 4 : 2;
      return this._value.toFixed(decimals) + this._unit;
    }
    return String(this._value) + (this._unit || '');
  }

  render() {
    const valueSize = {
      small: '16px',
      medium: '18px',
      large: '24px',
    }[this._size];

    const labelSize = {
      small: '11px',
      medium: '12px',
      large: '12px',
    }[this._size];

    const hasBorder = this._borderColor !== '';
    const hasSubtitle = this._subtitle !== '';
    const hasDescription = this._description !== '';

    this.innerHTML = `
      <div style="
        ${hasBorder ? `padding: 16px; background: rgba(255,255,255,0.04); border-radius: 8px; border-left: 4px solid ${this._borderColor};` : ''}
        ${!hasBorder && !hasSubtitle && !hasDescription ? 'display: grid; gap: 4px;' : ''}
      ">
        <div style="font-size: ${labelSize}; color: rgba(255,255,255,0.6); margin-bottom: ${hasSubtitle || hasDescription ? '8px' : '4px'};">
          ${this._label}
        </div>
        <div style="font-size: ${valueSize}; font-weight: ${this._size === 'large' ? '600' : '500'}; ${hasSubtitle || hasDescription ? 'margin-bottom: 4px;' : ''}">
          ${this.formatValue()}
        </div>
        ${hasSubtitle ? `
          <div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 4px;">
            ${this._subtitle}
          </div>
        ` : ''}
        ${hasDescription ? `
          <div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 4px;">
            ${this._description}
          </div>
        ` : ''}
      </div>
    `;
  }
}

customElements.define('metric-item', MetricItem);

