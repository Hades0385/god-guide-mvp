'use strict';
// LINE Mini App bridge with graceful fallbacks:
// Bridge -> navigator.geolocation -> DEMO mock (25.0330, 121.5654).
const MiniApp = {
  mock: { lat: 25.033, lng: 121.5654 },
  // MVP single-user identity. Persisted locally, sent as userIdHash.
  uid() {
    let id = localStorage.getItem('gg-uid');
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
      localStorage.setItem('gg-uid', id);
    }
    return id;
  },
  async getLocation() {
    if (window.lineMiniApp && typeof window.lineMiniApp.getLocation === 'function') {
      return window.lineMiniApp.getLocation();
    }
    if (navigator.geolocation) {
      try {
        const p = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 }));
        return { lat: p.coords.latitude, lng: p.coords.longitude };
      } catch (_) { /* fall through to mock */ }
    }
    return { ...this.mock, mocked: true };
  },
};
