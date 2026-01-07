export class MetricItem extends HTMLElement {
  static observedAttributes = ['label', 'value', 'unit', 'description', 'size', 'border-color', 'subtitle'];
  private _label = '';
  private _value: string | number | null = null;
  private _unit = '';
  private _description = '';
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
    const hasBorder = this._borderColor !== '';
    const hasSubtitle = this._subtitle !== '';
    const hasDescription = this._description !== '';

    const borderStyle = hasBorder ? `--metric-border-color: ${this._borderColor};` : '';
    this.innerHTML = `
      <div class="metric-item" style="${borderStyle}">
        <div class="label">${this._label}</div>
        <div class="value">${this.formatValue()}</div>
        ${hasSubtitle ? `<div class="subtitle">${this._subtitle}</div>` : ''}
        ${hasDescription ? `<div class="description">${this._description}</div>` : ''}
      </div>
    `;
  }
}

customElements.define('metric-item', MetricItem);

