import {
  KOSONG, WARNA_LAIN, LEBAR_RUTE, OPASITAS_RUTE, OFFSET_ARAH,
} from './config.js';

export const LAYER_RUTE = ['koridor-line', 'feeder-line'];

function ekspresiWarna(peta) {
  const pasangan = Object.entries(peta).flat();
  return pasangan.length
    ? ['match', ['get', 'koridor_id'], ...pasangan, WARNA_LAIN]
    : WARNA_LAIN;
}

export function tambahLayer(map, d) {
  // Bangunan 3D (di bawah label supaya nama jalan tetap terbaca)
  const labelId = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
  map.addLayer(
    {
      id: 'bangunan-3d',
      type: 'fill-extrusion',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 13,
      paint: {
        'fill-extrusion-color': [
          'interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 6],
          0, '#b0bec5', 20, '#78909c', 60, '#455a64',
        ],
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.85,
      },
    },
    labelId
  );

  // Sources
  map.addSource('koridor', { type: 'geojson', data: d.koridorData });
  map.addSource('feeder', { type: 'geojson', data: d.feederData });
  map.addSource('halte', { type: 'geojson', data: d.halteData });
  map.addSource('poi', { type: 'geojson', data: d.poiData });
  ['buffer', 'poi-dalam', 'nearest', 'halte-terpilih', 'bus'].forEach((s) =>
    map.addSource(s, { type: 'geojson', data: KOSONG })
  );

  // Rute
  map.addLayer({
    id: 'feeder-line', type: 'line', source: 'feeder',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': ekspresiWarna(d.warnaFeeder),
      'line-width': LEBAR_RUTE['feeder-line'],
      'line-opacity': OPASITAS_RUTE['feeder-line'],
      'line-offset': OFFSET_ARAH,
    },
  });
  map.addLayer({
    id: 'koridor-line', type: 'line', source: 'koridor',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': ekspresiWarna(d.warnaKoridor),
      'line-width': LEBAR_RUTE['koridor-line'],
      'line-opacity': OPASITAS_RUTE['koridor-line'],
      'line-offset': OFFSET_ARAH,
    },
  });

  // Buffer
  map.addLayer({
    id: 'buffer-3d', type: 'fill-extrusion', source: 'buffer',
    paint: {
      'fill-extrusion-color': '#00E5FF',
      'fill-extrusion-height': 20,
      'fill-extrusion-opacity': 0.4,
    },
  });
  map.addLayer({
    id: 'buffer-outline', type: 'line', source: 'buffer',
    paint: { 'line-color': '#00B8D4', 'line-width': 2 },
  });

  // Garis ke halte terdekat
  map.addLayer({
    id: 'nearest-line', type: 'line', source: 'nearest',
    paint: { 'line-color': '#FF1744', 'line-width': 3, 'line-dasharray': [2, 2] },
  });

  // Halte
  map.addLayer({
    id: 'halte-circle', type: 'circle', source: 'halte',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3, 14, 5, 17, 9],
      'circle-color': '#ffffff',
      'circle-stroke-color': '#1a237e',
      'circle-stroke-width': 2,
    },
  });
  map.addLayer({
    id: 'halte-sorot', type: 'circle', source: 'halte-terpilih',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 5, 14, 8, 17, 12],
      'circle-color': '#ffffff',
      'circle-stroke-color': '#FFC400',
      'circle-stroke-width': 4,
    },
  });

  // POI
  map.addLayer({
    id: 'poi-circle', type: 'circle', source: 'poi',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3, 14, 4, 17, 7],
      'circle-color': '#ff9800',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1,
    },
  });
  map.addLayer({
    id: 'poi-dalam', type: 'circle', source: 'poi-dalam',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 5, 14, 7, 17, 11],
      'circle-color': '#ff9800',
      'circle-stroke-color': '#00E5FF',
      'circle-stroke-width': 3,
    },
  });

  // Bus simulasi (paling atas)
  map.addLayer({
    id: 'bus-circle', type: 'circle', source: 'bus',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 14, 7, 17, 11],
      'circle-color': ['get', 'warna'],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2.5,
    },
  });
  map.addLayer({
    id: 'bus-pilih', type: 'circle', source: 'bus',
    filter: ['==', ['get', 'id'], ''],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 9, 14, 13, 17, 18],
      'circle-color': 'rgba(0,0,0,0)',
      'circle-stroke-color': '#FFC400',
      'circle-stroke-width': 3,
    },
  });
}

// ---- Toggle ----
export function setTampil(map, daftarLayer, tampil) {
  daftarLayer.forEach((id) =>
    map.setLayoutProperty(id, 'visibility', tampil ? 'visible' : 'none')
  );
}

export function setRuteTersembunyi(map, tersembunyi) {
  const filter = tersembunyi.size
    ? ['!', ['in', ['get', 'koridor_id'], ['literal', [...tersembunyi]]]]
    : null;
  LAYER_RUTE.forEach((l) => map.setFilter(l, filter));
  map.setFilter('bus-circle', filter);
}

// ---- Sorot ----
export function sorotRute(map, id, halteTerpilih) {
  const cocok = ['==', ['get', 'koridor_id'], id];
  LAYER_RUTE.forEach((l) => {
    map.setPaintProperty(l, 'line-opacity', ['case', cocok, 1, 0.1]);
    map.setPaintProperty(l, 'line-width', ['case', cocok, 7, LEBAR_RUTE[l]]);
  });
  map.setPaintProperty('halte-circle', 'circle-opacity', 0.15);
  map.setPaintProperty('halte-circle', 'circle-stroke-opacity', 0.15);
  map.setPaintProperty('poi-circle', 'circle-opacity', 0.15);
  map.setPaintProperty('poi-circle', 'circle-stroke-opacity', 0.15);
  map.setPaintProperty('bus-circle', 'circle-opacity', ['case', cocok, 1, 0.15]);
  map.setPaintProperty('bus-circle', 'circle-stroke-opacity', ['case', cocok, 1, 0.15]);
  map.getSource('halte-terpilih').setData(halteTerpilih);
}

export function resetSorot(map) {
  LAYER_RUTE.forEach((l) => {
    map.setPaintProperty(l, 'line-opacity', OPASITAS_RUTE[l]);
    map.setPaintProperty(l, 'line-width', LEBAR_RUTE[l]);
  });
  map.setPaintProperty('halte-circle', 'circle-opacity', 1);
  map.setPaintProperty('halte-circle', 'circle-stroke-opacity', 1);
  map.setPaintProperty('poi-circle', 'circle-opacity', 1);
  map.setPaintProperty('poi-circle', 'circle-stroke-opacity', 1);
  map.setPaintProperty('bus-circle', 'circle-opacity', 1);
  map.setPaintProperty('bus-circle', 'circle-stroke-opacity', 1);
  map.getSource('halte-terpilih').setData(KOSONG);
}