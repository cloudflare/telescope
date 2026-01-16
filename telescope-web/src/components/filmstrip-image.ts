class FilmstripImage extends HTMLElement {
  private _src: string = '';
  private _frameNumber: number = 0;
  private _time: number = 0;
  private _lcp: number = 0;
  private _fcp: number = 0;
  private _domComplete: number = 0;
  private _layoutShifts: any[] = [];
  private _previousShifts: any[] = [];

  static get observedAttributes() {
    return ['src', 'frame-number', 'time', 'lcp', 'fcp', 'dom-complete', 'layout-shifts', 'previous-shifts'];
  }

  get src(): string {
    return this._src;
  }

  get frameNumber(): number {
    return this._frameNumber;
  }

  get time(): number {
    return this._time;
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue !== newValue) {
      console.log(`[FilmstripImage] Attribute changed: ${name} = ${newValue}`);
      if (name === 'src') {
        this._src = newValue || '';
      } else if (name === 'frame-number') {
        this._frameNumber = parseInt(newValue) || 0;
      } else if (name === 'time') {
        this._time = parseFloat(newValue) || 0;
      } else if (name === 'lcp') {
        this._lcp = parseFloat(newValue) || 0;
      } else if (name === 'fcp') {
        this._fcp = parseFloat(newValue) || 0;
      } else if (name === 'dom-complete') {
        this._domComplete = parseFloat(newValue) || 0;
      } else if (name === 'layout-shifts') {
        try {
          this._layoutShifts = newValue ? JSON.parse(newValue) : [];
          console.log(`[FilmstripImage] Frame ${this._frameNumber}: Parsed ${this._layoutShifts.length} layout shifts`);
        } catch (error) {
          console.error(`[FilmstripImage] Error parsing layout-shifts:`, error);
          this._layoutShifts = [];
        }
      } else if (name === 'previous-shifts') {
        try {
          this._previousShifts = newValue ? JSON.parse(newValue) : [];
          console.log(`[FilmstripImage] Frame ${this._frameNumber}: Parsed ${this._previousShifts.length} previous shifts`);
        } catch (error) {
          console.error(`[FilmstripImage] Error parsing previous-shifts:`, error);
          this._previousShifts = [];
        }
      }
      this.render();
    }
  }

  connectedCallback() {
    console.log(`[FilmstripImage] Component connected for frame ${this._frameNumber}`);
    this.render();
  }

  private getBorderClass(): string {
    const classes: string[] = [];
    const timeMs = this._time * 1000;
    
    const fcpDiff = Math.abs(timeMs - this._fcp);
    const lcpDiff = Math.abs(timeMs - this._lcp);
    const domCompleteDiff = Math.abs(timeMs - this._domComplete);
    
    if (fcpDiff < 100) {
      classes.push('border-fcp');
      console.log(`[FilmstripImage] Frame ${this._frameNumber}: FCP match (diff: ${fcpDiff.toFixed(2)}ms)`);
    }
    if (lcpDiff < 100) {
      classes.push('border-lcp');
      console.log(`[FilmstripImage] Frame ${this._frameNumber}: LCP match (diff: ${lcpDiff.toFixed(2)}ms)`);
    }
    if (domCompleteDiff < 100) {
      classes.push('border-dom-complete');
      console.log(`[FilmstripImage] Frame ${this._frameNumber}: DOM Complete match (diff: ${domCompleteDiff.toFixed(2)}ms)`);
    }
    
    if (classes.length > 0) {
      console.log(`[FilmstripImage] Frame ${this._frameNumber}: Border classes: ${classes.join(', ')}`);
    }
    
    return classes.join(' ');
  }

  private render() {
    console.log(`[FilmstripImage] Rendering frame ${this._frameNumber}`);
    const borderClass = this.getBorderClass();
    const hasShifts = this._layoutShifts.length > 0 || this._previousShifts.length > 0;
    
    if (hasShifts) {
      console.log(`[FilmstripImage] Frame ${this._frameNumber}: Has ${this._layoutShifts.length} current shifts, ${this._previousShifts.length} previous shifts`);
    }
    
    this.innerHTML = `
      <style>
        :host {
          display: inline-block;
          position: relative;
          flex-shrink: 0;
        }

        .filmstrip-container {
          position: relative;
          border-radius: 6px;
          overflow: hidden;
          border: 3px solid transparent;
          transition: border-color 0.2s;
        }

        .filmstrip-container.border-fcp {
          border-color: #60a5fa;
        }

        .filmstrip-container.border-lcp {
          border-color: #34d399;
        }

        .filmstrip-container.border-dom-complete {
          border-color: #fbbf24;
        }

        .filmstrip-container.border-fcp.border-lcp {
          border-image: linear-gradient(90deg, #60a5fa 0%, #60a5fa 33%, #34d399 33%, #34d399 100%) 3;
        }

        .filmstrip-container.border-fcp.border-dom-complete {
          border-image: linear-gradient(90deg, #60a5fa 0%, #60a5fa 50%, #fbbf24 50%, #fbbf24 100%) 3;
        }

        .filmstrip-container.border-lcp.border-dom-complete {
          border-image: linear-gradient(90deg, #34d399 0%, #34d399 50%, #fbbf24 50%, #fbbf24 100%) 3;
        }

        .filmstrip-container.border-fcp.border-lcp.border-dom-complete {
          border-image: linear-gradient(90deg, #60a5fa 0%, #60a5fa 33%, #34d399 33%, #34d399 66%, #fbbf24 66%, #fbbf24 100%) 3;
        }

        .filmstrip-image {
          display: block;
          width: 200px;
          height: auto;
          max-height: 150px;
          object-fit: contain;
          background: rgba(0, 0, 0, 0.2);
        }

        .filmstrip-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
        }

        .shift-overlay {
          position: absolute;
          border: 2px solid;
          pointer-events: none;
        }

        .shift-old {
          border-color: #3b82f6;
          background: rgba(59, 130, 246, 0.2);
        }

        .shift-new {
          border-color: #10b981;
          background: rgba(16, 185, 129, 0.2);
        }

        .frame-info {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 4px 8px;
          font-size: 11px;
          text-align: center;
        }
      </style>
      <div class="filmstrip-container ${borderClass}">
        <img class="filmstrip-image" src="${this._src}" alt="Frame ${this._frameNumber}" />
        ${hasShifts ? this.renderShifts() : ''}
        <div class="frame-info">Frame ${this._frameNumber} - ${this._time.toFixed(2)}s</div>
      </div>
    `;
  }

  private renderShifts(): string {
    const overlays: string[] = [];
    
    // Image dimensions (filmstrip images are typically 1366x768)
    const imageWidth = 1366;
    const imageHeight = 768;
    const displayWidth = 200;
    const displayHeight = (displayWidth * imageHeight) / imageWidth; // Maintain aspect ratio
    
    const scaleX = displayWidth / imageWidth;
    const scaleY = displayHeight / imageHeight;
    
    // Render previous positions (blue)
    this._previousShifts.forEach((shift) => {
      if (shift.sources && shift.sources.length > 0) {
        shift.sources.forEach((source: any) => {
          if (source.previousRect) {
            const rect = source.previousRect;
            
            overlays.push(`
              <div class="shift-overlay shift-old" style="
                left: ${rect.x * scaleX}px;
                top: ${rect.y * scaleY}px;
                width: ${rect.width * scaleX}px;
                height: ${rect.height * scaleY}px;
              "></div>
            `);
          }
        });
      }
    });
    
    // Render new positions (green)
    this._layoutShifts.forEach((shift) => {
      if (shift.sources && shift.sources.length > 0) {
        shift.sources.forEach((source: any) => {
          if (source.currentRect) {
            const rect = source.currentRect;
            
            overlays.push(`
              <div class="shift-overlay shift-new" style="
                left: ${rect.x * scaleX}px;
                top: ${rect.y * scaleY}px;
                width: ${rect.width * scaleX}px;
                height: ${rect.height * scaleY}px;
              "></div>
            `);
          }
        });
      }
    });
    
    return `<div class="filmstrip-overlay">${overlays.join('')}</div>`;
  }
}

customElements.define('filmstrip-image', FilmstripImage);

