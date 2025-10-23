/**
 * Controller for the Illustrator-exported SVG gauge (assets/guage.svg).
 *
 * The gauge file exposes a pointer group (id="pointer") with
 * data-min-angle/data-max-angle attributes that describe the sweep of
 * the dial in degrees. The actual needle has already been rotated so
 * that a transform of 0deg points at the minimum mark; rotating the
 * pointer group moves between the minimum and maximum stops.
 */
export class SvgGaugeController {
  /**
   * @param {SVGSVGElement} svgElement - The loaded gauge SVG element.
   * @param {Object} [options]
   * @param {string} [options.pointerSelector="#pointer"]
   * @param {number} [options.minAngle] - Override for the gauge sweep start.
   * @param {number} [options.maxAngle] - Override for the gauge sweep end.
   * @param {number} [options.minValue=0]
   * @param {number} [options.maxValue=100]
   * @param {number|null} [options.initialValue=options.minValue]
   * @param {string} [options.readoutSelector="#gauge_readout"]
   * @param {boolean} [options.enableTransition=true]
   */
  constructor(svgElement, options = {}) {
    if (!(svgElement instanceof SVGElement)) {
      throw new TypeError('SvgGaugeController requires an <svg> element that has already loaded.');
    }

    this.svg = svgElement;
    const {
      pointerSelector = '#pointer',
      minValue = 0,
      maxValue = 100,
      initialValue = minValue,
      readoutSelector = '#gauge_readout',
      enableTransition = true,
      centerX = null,
      centerY = null,
      angleStops = null,
      minAngle = null,
      maxAngle = null,
    } = options;

    if (minValue === maxValue) {
      throw new Error('SvgGaugeController minValue and maxValue must be different.');
    }

    this.pointer = options.pointer instanceof SVGElement
      ? options.pointer
      : svgElement.querySelector(pointerSelector);

    if (!this.pointer) {
      throw new Error(`Pointer element not found with selector "${pointerSelector}".`);
    }

    this.minValue = Number(minValue);
    this.maxValue = Number(maxValue);

    this.readout = options.readout instanceof SVGTextElement
      ? options.readout
      : svgElement.querySelector(readoutSelector) ?? null;

    this.center = {
      x: parseFloat(centerX ?? this.pointer.dataset.centerX),
      y: parseFloat(centerY ?? this.pointer.dataset.centerY),
    };

    if (!Number.isFinite(this.center.x) || !Number.isFinite(this.center.y)) {
      throw new Error('Gauge pointer must declare data-center-x and data-center-y (the pivot point in SVG units).');
    }

    this.angleStops = this._buildAngleStops({ angleStops, minAngle, maxAngle });

    if (this.angleStops.length < 2) {
      throw new Error('Unable to determine gauge sweep. Provide angleStops or data-min-angle/data-max-angle attributes.');
    }

    this.minAngle = this.angleStops[0].angle;
    this.maxAngle = this.angleStops[this.angleStops.length - 1].angle;

    if (enableTransition) {
      const current = this.pointer.style.transition;
      if (!current) {
        this.pointer.style.transition = 'transform 0.4s ease-in-out';
      }
    } else {
      this.pointer.style.transition = 'none';
    }

    this.pointer.setAttribute('role', this.pointer.getAttribute('role') ?? 'meter');
    this.pointer.setAttribute('aria-valuemin', String(this.minValue));
    this.pointer.setAttribute('aria-valuemax', String(this.maxValue));

    this._percent = 0;
    this.setValue(initialValue);
  }

  /**
    * Clamp helper.
    * @private
    */
  static _clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  static _decodePercentId(id) {
    if (typeof id !== 'string') return Number.NaN;
    const decoded = id.replace(/_x([0-9A-Fa-f]{2})_/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    const match = decoded.match(/([0-9]{1,3})\s*percent$/i);
    if (!match) return Number.NaN;
    return Number(match[1]);
  }

  static _angleFromPoint(x, y, originX, originY) {
    const angle = Math.atan2(y - originY, x - originX) * (180 / Math.PI);
    return angle;
  }

  _normaliseAngleStops(stops) {
    if (!stops.length) return [];
    const normalised = [{ ...stops[0] }];
    let lastAngle = normalised[0].angle;

    for (let i = 1; i < stops.length; i += 1) {
      let { angle } = stops[i];
      while (angle < lastAngle) {
        angle += 360;
      }
      normalised.push({ percent: stops[i].percent, angle });
      lastAngle = angle;
    }

    return normalised;
  }

  _buildAngleStops({ angleStops, minAngle, maxAngle }) {
    if (Array.isArray(angleStops) && angleStops.length >= 2) {
      const sorted = angleStops
        .map((stop) => ({
          percent: Number(stop.percent),
          angle: Number(stop.angle),
        }))
        .filter((stop) => Number.isFinite(stop.percent) && Number.isFinite(stop.angle))
        .sort((a, b) => a.percent - b.percent);

      return this._normaliseAngleStops(sorted);
    }

    const extracted = this._extractMarkerAngles();
    if (extracted.length >= 2) {
      return extracted;
    }

    const fallbackMin = parseFloat(minAngle ?? this.pointer.dataset.minAngle);
    const fallbackMax = parseFloat(maxAngle ?? this.pointer.dataset.maxAngle);

    if (Number.isFinite(fallbackMin) && Number.isFinite(fallbackMax)) {
      return this._normaliseAngleStops([
        { percent: 0, angle: fallbackMin },
        { percent: 100, angle: fallbackMax },
      ]);
    }

    return [];
  }

  _extractMarkerAngles() {
    const markersGroup = this.svg.getElementById('markers');
    if (!markersGroup) {
      return [];
    }

    const markers = Array.from(markersGroup.querySelectorAll('[id]'));
    const stops = markers
      .map((node) => {
        const percent = SvgGaugeController._decodePercentId(node.id);
        if (!Number.isFinite(percent)) return null;
        const box = node.getBBox();
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        const angle = SvgGaugeController._angleFromPoint(cx, cy, this.center.x, this.center.y);
        return { percent, angle };
      })
      .filter(Boolean)
      .sort((a, b) => a.percent - b.percent);

    return this._normaliseAngleStops(stops);
  }

  _percentToAngle(percent) {
    const stops = this.angleStops;
    if (stops.length === 0) return 0;

    const clampedPercent = SvgGaugeController._clamp(percent, stops[0].percent, stops[stops.length - 1].percent);

    if (clampedPercent <= stops[0].percent) {
      return stops[0].angle;
    }

    for (let i = 0; i < stops.length - 1; i += 1) {
      const start = stops[i];
      const end = stops[i + 1];
      if (clampedPercent >= end.percent) {
        continue;
      }
      const span = end.percent - start.percent;
      const t = span === 0 ? 0 : (clampedPercent - start.percent) / span;
      return start.angle + (end.angle - start.angle) * t;
    }

    return stops[stops.length - 1].angle;
  }

  /**
   * Convert an absolute value to a gauge percentage.
   * @param {number} value
   * @returns {number}
   */
  valueToPercent(value) {
    const span = this.maxValue - this.minValue;
    return ((value - this.minValue) / span) * 100;
  }

  /**
   * Convert a gauge percentage back into the absolute domain.
   * @param {number} percent
   * @returns {number}
   */
  percentToValue(percent) {
    const clamped = SvgGaugeController._clamp(percent, 0, 100);
    const span = this.maxValue - this.minValue;
    return this.minValue + (span * (clamped / 100));
  }

  /**
   * Update the gauge using a percentage (0–100).
   * @param {number} percent
   * @returns {number} The clamped percentage that was applied.
   */
  setPercent(percent) {
    const clamped = SvgGaugeController._clamp(Number(percent), 0, 100);
    const angle = this._percentToAngle(clamped);
    const rotation = angle - this.minAngle;
    this.pointer.style.transform = `rotate(${rotation}deg)`;
    this._percent = clamped;
    this.pointer.setAttribute('data-percent', clamped.toFixed(2));
    this.pointer.setAttribute('aria-valuenow', this.percentToValue(clamped).toFixed(2));
    this.pointer.setAttribute('aria-valuetext', `${clamped.toFixed(1)}%`);

    if (this.readout) {
      this.readout.textContent = `${clamped.toFixed(0)}%`;
    }

    return clamped;
  }

  /**
   * Update the gauge using a value within the configured domain.
   * @param {number} value
   * @returns {number} The clamped value that was applied.
   */
  setValue(value) {
    const numeric = Number(value);
    const clamped = SvgGaugeController._clamp(numeric, this.minValue, this.maxValue);
    const percent = this.valueToPercent(clamped);
    this.setPercent(percent);
    return clamped;
  }

  /**
   * Current percentage (0–100).
   * @returns {number}
   */
  getPercent() {
    return this._percent;
  }

  /**
   * Current value within the configured domain.
   * @returns {number}
   */
  getValue() {
    return this.percentToValue(this._percent);
  }

  /**
   * Bind the gauge to an input element (range/number/text).
   * Returns an unsubscribe function.
   *
   * @param {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} input
   * @param {Object} [options]
   * @param {(value:string)=>number} [options.parser=parseFloat]
   * @param {boolean} [options.asPercent=false] - Treat the input as a 0–100 percent value.
   * @returns {() => void}
   */
  bindInput(input, options = {}) {
    const { parser = parseFloat, asPercent = false } = options;

    if (!(input instanceof EventTarget)) {
      throw new TypeError('bindInput expects a DOM input element.');
    }

    const handler = () => {
      const raw = 'value' in input ? input.value : null;
      if (raw == null) return;
      const parsed = parser(raw);
      if (Number.isNaN(parsed)) return;
      if (asPercent) {
        this.setPercent(parsed);
      } else {
        this.setValue(parsed);
      }
    };

    input.addEventListener('input', handler);
    input.addEventListener('change', handler);
    handler();

    return () => {
      input.removeEventListener('input', handler);
      input.removeEventListener('change', handler);
    };
  }

  /**
   * Create a controller from an <object> or <embed> tag that loads the SVG.
   * @param {HTMLObjectElement|HTMLEmbedElement} host
   * @param {Object} [options]
   * @returns {Promise<SvgGaugeController>}
   */
  static async fromExternalObject(host, options = {}) {
    if (!(host instanceof HTMLObjectElement || host instanceof HTMLEmbedElement)) {
      throw new TypeError('fromExternalObject expects an <object> or <embed> element.');
    }

    const loadDocument = () => {
      const doc = host.contentDocument;
      if (!doc) {
        throw new Error('Failed to access the SVG document. Ensure it is served from the same origin.');
      }
      return new SvgGaugeController(doc.documentElement, options);
    };

    if (host.contentDocument) {
      return loadDocument();
    }

    await new Promise((resolve, reject) => {
      const onLoad = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error('Unable to load the gauge SVG.'));
      };
      const cleanup = () => {
        host.removeEventListener('load', onLoad);
        host.removeEventListener('error', onError);
      };
      host.addEventListener('load', onLoad);
      host.addEventListener('error', onError);
    });

    return loadDocument();
  }
}

export default SvgGaugeController;
