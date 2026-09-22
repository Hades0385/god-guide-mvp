'use strict';
// MapProvider interface (plan.md:8): initialize/showUserLocation/addMarker/moveTo/clearMarkers.
// Only LeafletProvider for MVP; never hardcode Google Maps.
class LeafletProvider {
  constructor() { this.map = null; this.markers = []; }
  async initialize(container, opts) {
    if (typeof L === 'undefined') throw new Error('Leaflet CDN not loaded');
    this.map = L.map(container, { zoomControl: false }).setView(opts.center, opts.zoom || 15);
    L.control.zoom({ position: 'bottomleft' }).addTo(this.map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).on('tileerror', () => opts.onTileError?.()).addTo(this.map);
  }
  showUserLocation(lat, lng) {
    if (!this.map) return;
    if (this.userMarker) this.userMarker.remove();
    this.userMarker = L.marker([lat, lng]).addTo(this.map).bindPopup('你在這裡');
  }
  addMarker(m) {
    if (!this.map) return;
    // Colored dot per place type; gold ring for partner shops.
    const COLORS = {
      temple: '#8B0000',
      offering_shop: '#2E7D32',
      joss_paper_shop: '#E65100',
      flower_shop: '#C2185B',
    };
    const color = COLORS[m.type] || '#555555';
    const icon = L.divIcon({
      className: '',
      html: `<div class="mk" style="background:${color};${m.is_partner ? 'border-color:#c9a227;border-width:3px;' : ''}"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    const marker = L.marker([m.lat, m.lng], { icon, title: m.title || '地點', alt: m.title || '地點' }).addTo(this.map);
    marker._placeId = m.id;
    // Bottom sheet owns the detail UI; popup would double up.
    marker.on('click', () => { if (typeof m.onClick === 'function') m.onClick(m.id); });
    this.markers.push(marker);
  }
  moveTo(lat, lng) { if (this.map) this.map.setView([lat, lng]); }
  clearMarkers() { for (const m of this.markers) m.remove(); this.markers = []; }
}
