import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';

import {
  KOSONG, PUSAT, RADIUS_AWAL, WARNA_KORIDOR, WARNA_FEEDER, WARNA_LAIN,
} from './config.js';
import {
  daftarRute, bufferHalte, poiDalamArea, halteDalamArea, ringkasPoi,
  halteTerdekat, koridorDiHalte, halteDiRute, bboxRute, statistikRute,
} from './analysis.js';
import {
  LAYER_RUTE, tambahLayer, setTampil, setRuteTersembunyi, sorotRute, resetSorot,
} from './layers.js';
import {
  buatPanelKiri, buatPanelKanan, htmlPoi, buatKontrolSimulasi, htmlBus,
} from './ui.js';
import { buatLoading, buatPencarian } from './ui-extra.js';
import { buatSimulasi } from './simulation.js';

const base = import.meta.env.BASE_URL;
const loading = buatLoading();

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://tiles.openfreemap.org/styles/positron',
  center: PUSAT,
  zoom: 15.5,
  pitch: 60,
  bearing: -20,
  attributionControl: { compact: true, customAttribution: 'Data rute & halte: Trans Semarang' },
});

window.map = map; // untuk tes lewat Console (boleh dihapus nanti)
map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
map.on('error', (e) => console.error('MAP ERROR:', e.error));

const ambil = (url) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);
    return r.json();
  });

map.on('load', async () => {
  loading.ubah('Memuat data rute, halte, dan POI…');

  let koridorData, feederData, halteData, poiData;
  try {
    [koridorData, feederData, halteData, poiData] = await Promise.all([
      ambil(`${base}data/rute_koridor.geojson`),
      ambil(`${base}data/rute_feeder.geojson`),
      ambil(`${base}data/halte.geojson`),
      ambil(`${base}data/titik_poi.geojson`),
    ]);
  } catch (err) {
    console.error('Error memuat data:', err.message);
    loading.galat(`Gagal memuat data: ${err.message}`);
    return;
  }

  loading.ubah('Menyiapkan layer dan simulasi…');

  const semuaRute = [...koridorData.features, ...feederData.features];

  // Daftar rute + warna (dipakai layer, legenda, chip panel kanan, dan bus)
  const koridor = daftarRute(koridorData).map((r) => ({
    ...r, warna: WARNA_KORIDOR[r.id] ?? WARNA_LAIN,
  }));
  const feeder = daftarRute(feederData).map((r, i) => ({
    ...r, warna: WARNA_FEEDER[i % WARNA_FEEDER.length],
  }));
  const peta = (arr) => Object.fromEntries(arr.map((r) => [r.id, r.warna]));
  const warnaSemua = { ...peta(koridor), ...peta(feeder) };

  tambahLayer(map, {
    koridorData, feederData, halteData, poiData,
    warnaKoridor: peta(koridor), warnaFeeder: peta(feeder),
  });

  // ---------- State ----------
  let radius = RADIUS_AWAL;
  let halteAktif = null; // { koordinat, props }
  let popup = null;
  const tersembunyi = new Set();

  const tampilPopup = (lngLat, html, maxWidth = '240px') => {
    popup?.remove();
    popup = new maplibregl.Popup({ maxWidth }).setLngLat(lngLat).setHTML(html).addTo(map);
  };

  const bersih = () => {
    halteAktif = null;
    ['buffer', 'poi-dalam', 'nearest'].forEach((s) => map.getSource(s).setData(KOSONG));
  };

  const boundsHalte = new maplibregl.LngLatBounds();
  halteData.features.forEach((f) => boundsHalte.extend(f.geometry.coordinates));

  // ---------- Aksi ----------
  function renderHalte() {
    const { koordinat, props } = halteAktif;
    const area = bufferHalte(koordinat, radius);
    const dalam = poiDalamArea(poiData, area);
    map.getSource('buffer').setData(area);
    map.getSource('poi-dalam').setData(dalam);

    kanan.tampilHalte({
      props,
      koridor: koridorDiHalte(koordinat, props.halte_id, semuaRute),
      ringkas: ringkasPoi(dalam, koordinat),
      radius,
      halteLain: Math.max(0, halteDalamArea(halteData, area).features.length - 1),
    });
  }

  // Dipakai oleh klik halte DAN pencarian
  function pilihHalte(koordinat, props) {
    halteAktif = { koordinat, props };
    map.getSource('nearest').setData(KOSONG);
    popup?.remove();
    renderHalte();
  }

  function fokusRute(id) {
    bersih();
    popup?.remove();
    const terpilih = halteDiRute(id, semuaRute, halteData);
    sorotRute(map, id, terpilih);
    const kotak = bboxRute(id, semuaRute);
    if (kotak) {
      map.fitBounds(kotak, {
        padding: { top: 60, bottom: 100, left: 300, right: 340 },
        pitch: 50,
        duration: 1000,
      });
    }
    ui.tandaiAktif(id);
    kanan.tampilRute(statistikRute(id, semuaRute, terpilih));
  }

  function resetFokus() {
    bersih();
    resetSorot(map);
    popup?.remove();
    ui.tandaiAktif(null);
    kanan.kosongkan();
  }

  // ---------- Panel ----------
  const ui = buatPanelKiri({
    koridor, feeder, radiusAwal: RADIUS_AWAL,
    onToggleLayer: (nama, tampil) => {
      if (nama === 'halte') setTampil(map, ['halte-circle', 'halte-sorot'], tampil);
      if (nama === 'poi') setTampil(map, ['poi-circle', 'poi-dalam'], tampil);
    },
    onToggleRute: (id, tampil) => {
      tampil ? tersembunyi.delete(id) : tersembunyi.add(id);
      setRuteTersembunyi(map, tersembunyi);
    },
    onSorot: (id) => (id ? fokusRute(id) : resetFokus()),
    onRadius: (r) => {
      radius = r;
      if (halteAktif) renderHalte();
    },
    onLihatSemua: () => {
      resetFokus();
      map.fitBounds(boundsHalte, { padding: 50, maxZoom: 15, pitch: 50, bearing: -15 });
    },
  });

  const kanan = buatPanelKanan({
    warna: warnaSemua,
    onSorot: (id) => fokusRute(id),
    onTerbang: (pusat) =>
      map.flyTo({ center: pusat, zoom: Math.max(map.getZoom(), 16), pitch: 60, duration: 900 }),
    onTutup: resetFokus,
  });

  // ---------- Pencarian halte ----------
  const cari = buatPencarian({
    halte: halteData,
    onPilih: (f) => {
      map.flyTo({
        center: f.geometry.coordinates,
        zoom: Math.max(map.getZoom(), 16),
        pitch: 60,
        duration: 1000,
      });
      pilihHalte(f.geometry.coordinates, f.properties);
    },
  });

  // ---------- Simulasi bus (dibungkus agar error tidak mematikan fitur lain) ----------
  try {
    let sim;
    const kontrol = buatKontrolSimulasi({
      onToggle: () => sim.toggle(),
      onKecepatan: (x) => sim.setKecepatan(x),
      onTampil: (t) => setTampil(map, ['bus-circle', 'bus-pilih'], t),
    });
    sim = buatSimulasi({
      map, semuaRute, halteData,
      warna: warnaSemua,
      renderPopup: htmlBus,
      onTick: (jam) => kontrol.setJam(jam),
      onMain: (main) => kontrol.setMain(main),
    });
    kontrol.setJumlah(sim.jumlahBus);
  } catch (err) {
    console.error('SIMULASI GAGAL:', err);
  }

  // ---------- Tooltip hover (halte dan POI) ----------
  const tip = new maplibregl.Popup({
    closeButton: false, closeOnClick: false, offset: 12, className: 'tip',
  });
  const pasangTip = (layer, ambilNama) => {
    map.on('mousemove', layer, (e) => {
      const f = e.features[0];
      tip.setLngLat(f.geometry.coordinates).setText(ambilNama(f.properties)).addTo(map);
    });
    map.on('mouseleave', layer, () => tip.remove());
  };
  pasangTip('halte-circle', (p) => p.nama_halte || 'Halte');
  pasangTip('poi-circle', (p) => p.nama_poi || 'Tanpa nama');

  // ---------- Klik halte ----------
  map.on('click', 'halte-circle', (e) => {
    const f = e.features[0];
    pilihHalte(f.geometry.coordinates, f.properties);
  });

  // ---------- Klik POI ----------
  map.on('click', 'poi-circle', (e) => {
    tampilPopup(e.lngLat, htmlPoi(e.features[0].properties));
  });

  // ---------- Klik rute / area kosong ----------
  map.on('click', (e) => {
    const kena = map.queryRenderedFeatures(e.point, {
      layers: ['halte-circle', 'halte-sorot', 'poi-circle', 'bus-circle'].filter((l) => map.getLayer(l)),
    });
    if (kena.length > 0) return;

    const bbox = [
      [e.point.x - 6, e.point.y - 6],
      [e.point.x + 6, e.point.y + 6],
    ];
    const rute = map.queryRenderedFeatures(bbox, { layers: LAYER_RUTE });

    if (rute.length > 0) {
      fokusRute(rute[0].properties.koridor_id);
      return;
    }

    // Area kosong: reset sorotan lalu cari halte terdekat
    resetSorot(map);
    ui.tandaiAktif(null);
    bersih();
    popup?.remove();
    const t = halteTerdekat(e.lngLat.lng, e.lngLat.lat, halteData);
    map.getSource('nearest').setData(t.garis);
    kanan.tampilTerdekat(
      t,
      koridorDiHalte(t.halte.geometry.coordinates, t.halte.properties.halte_id, semuaRute)
    );
  });

  // Tombol Esc = batalkan fokus
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.activeElement?.tagName !== 'INPUT') {
      resetFokus();
      cari.kosongkan();
    }
  });

  // Kursor pointer saat hover
  const setCursor = (c) => () => (map.getCanvas().style.cursor = c);
  ['halte-circle', 'poi-circle', ...LAYER_RUTE].forEach((id) => {
    map.on('mouseenter', id, setCursor('pointer'));
    map.on('mouseleave', id, setCursor(''));
  });

  loading.selesai();
});