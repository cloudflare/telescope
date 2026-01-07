class MetricItem extends HTMLElement {
  private _label: string = '';
  private _value: string = '';
  private _description: string = '';
  private _status: 'good' | 'needs-improvement' | 'poor' | '' = '';

  static get observedAttributes() {
    return ['label', 'value', 'description', 'status'];
  }

  get label(): string {
    return this._label;
  }

  get value(): string {
    return this._value;
  }

  get description(): string {
    return this._description;
  }

  get status(): string {
    return this._status;
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue !== newValue) {
      if (name === 'label') {
        this._label = newValue || '';
      } else if (name === 'value') {
        this._value = newValue || '';
      } else if (name === 'description') {
        this._description = newValue || '';
      } else if (name === 'status') {
        this._status = (newValue as 'good' | 'needs-improvement' | 'poor' | '') || '';
      }
      this.render();
    }
  }

  connectedCallback() {
    this.render();
  }

  private render() {
    const statusClass = this._status ? `metric-item-${this._status}` : '';
    this.className = statusClass;
    const title = `${this._label}: ${this._value}`;
    this.setAttribute('title', title);
    
    this.innerHTML = `
      <div class="label">${this.escapeHtml(this._label)}</div>
      <div class="value">${this.escapeHtml(this._value)}</div>
      ${this._description ? `<div class="description">${this.escapeHtml(this._description)}</div>` : ''}
    `;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

customElements.define('metric-item', MetricItem);

