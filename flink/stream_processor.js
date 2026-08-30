/**
 * ORBIT Real-Time Stream Processing Engine
 * Implements sliding-window stream analytics:
 * - 5-minute sliding window average temperature
 * - Minimum & Maximum tracking
 * - Trend direction detection (rising/falling/stable)
 * - Thermal anomaly spike detector
 */

export class StreamWindowAnalytics {
  constructor(windowDurationMs = 5 * 60 * 1000) {
    this.windowDurationMs = windowDurationMs;
    this.readings = [];
  }

  /**
   * Adds a new temperature reading to the sliding stream
   * @param {number} temp Temperature value in Celsius
   * @param {number} timestamp Timestamp in ms
   */
  addReading(temp, timestamp = Date.now()) {
    if (temp === null || temp === undefined || isNaN(temp)) return null;

    const numTemp = Number(temp);
    this.readings.push({ temp: numTemp, timestamp });

    // Evict readings older than windowDuration
    const cutoff = timestamp - this.windowDurationMs;
    this.readings = this.readings.filter(r => r.timestamp >= cutoff);

    return this.computeMetrics();
  }

  /**
   * Computes stream metrics across current window
   */
  computeMetrics() {
    if (this.readings.length === 0) {
      return {
        avgTemp5m: null,
        minTemp: null,
        maxTemp: null,
        trend: 'stable',
        anomalyDetected: false,
        sampleCount: 0
      };
    }

    const temps = this.readings.map(r => r.temp);
    const sum = temps.reduce((acc, v) => acc + v, 0);
    const avg = Number((sum / temps.length).toFixed(2));
    const min = Number(Math.min(...temps).toFixed(2));
    const max = Number(Math.max(...temps).toFixed(2));

    // Trend detection: Compare first half of window vs second half
    let trend = 'stable';
    if (temps.length >= 4) {
      const half = Math.floor(temps.length / 2);
      const firstHalfAvg = temps.slice(0, half).reduce((a, b) => a + b, 0) / half;
      const secondHalfAvg = temps.slice(half).reduce((a, b) => a + b, 0) / (temps.length - half);
      const diff = secondHalfAvg - firstHalfAvg;

      if (diff > 0.4) trend = 'rising';
      else if (diff < -0.4) trend = 'falling';
    }

    // Anomaly detection: Current reading deviates by > 3.5°C from rolling average
    const latest = temps[temps.length - 1];
    const anomalyDetected = Math.abs(latest - avg) > 3.5;

    return {
      avgTemp5m: avg,
      minTemp: min,
      maxTemp: max,
      trend,
      anomalyDetected,
      sampleCount: temps.length,
      latestTemp: latest,
      lastUpdated: new Date().toISOString()
    };
  }

  reset() {
    this.readings = [];
  }
}
