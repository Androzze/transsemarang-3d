import * as turf from '@turf/turf';
import * as maplibregl from 'maplibre-gl';
import { SIM, WARNA_LAIN } from './config.js';

const acak = (a, b) => a + Math.random() * (b - a);
const dua = (n) => String(n).padStart(2, '0');
const fmtJam = (d) => `${dua(Math.floor(d / 3600) % 24)}:${dua(Math.floor((d % 3600) / 60))}`;
const FILTER_KOSONG = ['==', ['get', 'id'], ''];

// Jarak cepat (meter), cukup akurat untuk skala kota
function jarak(a, b) {
  const dx = (a[0] - b[0]) * Math.cos(((a[1] + b[1]) * Math.PI) / 360);
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy) * 111320;
}

function bersihkan(koord) {
  const hasil = [];
  koord.forEach((c) => {
    if (!Array.isArray(c) || !isFinite(c[0]) || !isFinite(c[1])) return;
    const p = [c[0], c[1]]; // buang Z
    const q = hasil[hasil.length - 1];
    if (q && q[0] === p[0] && q[1] === p[1]) return;
    hasil.push(p);
  });
  return hasil;
}

// Susun bagian MultiLineString: urutan dan arah dengan total celah terkecil
function susunBagian(bagian) {
  const b = bagian.map(bersihkan).filter((x) => x.length >= 2);
  const n = b.length;
  if (n === 0) return [];
  if (n === 1) return b[0];

  let urutanTerbaik = null;

  if (n <= 7) {
    const balik = b.map((x) => x.slice().reverse());
    const pakai = Array(n).fill(false);
    let biayaTerbaik = Infinity;
    const cari = (urutan, akhir, biaya) => {
      if (biaya >= biayaTerbaik) return;
      if (urutan.length === n) {
        biayaTerbaik = biaya;
        urutanTerbaik = urutan.slice();
        return;
      }
      for (let i = 0; i < n; i++) {
        if (pakai[i]) continue;
        for (const seg of [b[i], balik[i]]) {
          const c = akhir ? jarak(akhir, seg[0]) : 0;
          pakai[i] = true;
          urutan.push(seg);
          cari(urutan, seg[seg.length - 1], biaya + c);
          urutan.pop();
          pakai[i] = false;
        }
      }
    };
    cari([], null, 0);
  } else {
    // Terlalu banyak bagian: sambung ke ujung terdekat
    const sisa = b.map((x) => x.slice());
    const hasil = [sisa.shift()];
    while (sisa.length) {
      const akhir = hasil[hasil.length - 1].slice(-1)[0];
      let ti = 0, bl = false, dMin = Infinity;
      sisa.forEach((s, i) => {
        const d1 = jarak(akhir, s[0]);
        const d2 = jarak(akhir, s[s.length - 1]);
        if (d1 < dMin) { dMin = d1; ti = i; bl = false; }
        if (d2 < dMin) { dMin = d2; ti = i; bl = true; }
      });
      const s = sisa.splice(ti, 1)[0];
      hasil.push(bl ? s.reverse() : s);
    }
    urutanTerbaik = hasil;
  }

  return bersihkan(urutanTerbaik.flat());
}

function ambilKoordinat(f) {
  const g = f.geometry;
  if (!g) return [];
  if (g.type === 'LineString') return bersihkan(g.coordinates);
  if (g.type === 'MultiLineString') return susunBagian(g.coordinates);
  return [];
}

function siapkanRute(f, huruf, halteData, warna) {
  const id = f.properties.koridor_id;
  const koord = ambilKoordinat(f);
  if (koord.length < 2) {
    console.warn(`Rute ${id} dilewati: geometri kosong`);
    return null;
  }

  // Laporkan celah di garis (data putus), supaya kelihatan di Console
  for (let i = 1; i < koord.length; i++) {
    const d = jarak(koord[i - 1], koord[i]);
    if (d > 150) console.warn(`CELAH ${Math.round(d)} m di ${id}${huruf}, titik ke-${i}`, koord[i]);
  }

  const garis = turf.lineString(koord);
  const panjang = turf.length(garis, { units: 'kilometers' });
  if (!(panjang >= 0.3)) return null;

  const [w, s, e, n] = turf.bbox(garis);
  const pad = 0.001;
  const mentah = [];
  halteData.features.forEach((h) => {
    const [x, y] = h.geometry.coordinates;
    if (x < w - pad || x > e + pad || y < s - pad || y > n + pad) return;
    const p = turf.nearestPointOnLine(garis, h, { units: 'kilometers' });
    if (p.properties.dist * 1000 <= SIM.jarakHalteM) {
      mentah.push({ km: p.properties.location, nama: h.properties.nama_halte || 'Halte' });
    }
  });
  mentah.sort((a, b) => a.km - b.km);

  const stops = [];
  mentah.forEach((st) => {
    if (!stops.length || st.km - stops[stops.length - 1].km > 0.12) stops.push(st);
  });

  return {
    garis, panjang, stops, huruf,
    koridor: id,
    nama: f.properties.nama_koridor || id,
    warna: warna[id] ?? WARNA_LAIN,
  };
}

export function buatSimulasi({ map, semuaRute, halteData, warna, renderPopup, onTick, onMain }) {
  const hitung = {};
  const rute = [];
  semuaRute.forEach((f) => {
    try {
      const k = f.properties.koridor_id;
      const urut = hitung[k] ?? 0;
      const r = siapkanRute(f, String.fromCharCode(65 + urut), halteData, warna);
      if (r) { hitung[k] = urut + 1; rute.push(r); }
    } catch (err) {
      console.warn('Rute dilewati:', f.properties?.koridor_id, err);
    }
  });

  const buses = [];
  rute.forEach((r) => {
    const n = Math.min(SIM.maxBusPerRute, Math.max(1, Math.round(r.panjang / SIM.kmPerBus)));
    for (let j = 0; j < n; j++) {
      const s = (r.panjang * j) / n;
      const idx = r.stops.findIndex((st) => st.km > s);
      buses.push({
        id: `BRT-${r.koridor}${r.huruf}-${dua(j + 1)}`,
        rute: r,
        s,
        next: idx < 0 ? r.stops.length : idx,
        vBase: acak(SIM.kecMin, SIM.kecMax),
        fase: Math.random() * 6.28,
        v: 0,
        dwell: 0,
        akhir: false,
        lngLat: null,
      });
    }
  });
  console.log(`SIMULASI: ${buses.length} bus di ${rute.length} rute dari ${semuaRute.length} fitur`);

  function langkah(b, dt, t) {
    const r = b.rute;
    if (b.dwell > 0) {
      b.dwell -= dt;
      b.v = 0;
      if (b.dwell <= 0) {
        b.dwell = 0;
        if (b.akhir) { b.s = 0; b.next = 0; b.akhir = false; }
      }
      return;
    }
    b.v = b.vBase * (1 + 0.15 * Math.sin(t / 25 + b.fase));
    const s2 = b.s + (b.v / 3600) * dt;
    if (s2 >= r.panjang) {
      b.s = r.panjang; b.akhir = true; b.dwell = SIM.dwellTerminal; b.v = 0;
      return;
    }
    const stop = r.stops[b.next];
    if (stop && s2 >= stop.km) {
      b.s = stop.km; b.next += 1; b.dwell = acak(SIM.dwellMin, SIM.dwellMax); b.v = 0;
      return;
    }
    b.s = s2;
  }

  function info(b) {
    const r = b.rute;
    const sebelum = r.stops[b.next - 1];
    const berikut = r.stops[b.next];
    let status;
    if (b.dwell > 0) status = b.akhir ? 'Berhenti di terminal akhir' : `Berhenti di ${sebelum?.nama ?? 'halte'}`;
    else status = berikut ? `Menuju ${berikut.nama}` : 'Menuju terminal akhir';
    return { id: b.id, koridor: r.koridor, namaRute: r.nama, warna: r.warna, kec: Math.round(b.v), status };
  }

  let terpilih = null;
  let popup = null;

  function gambar() {
    const fitur = buses.map((b) => {
      const p = turf.along(b.rute.garis, b.s, { units: 'kilometers' });
      b.lngLat = p.geometry.coordinates;
      return {
        type: 'Feature',
        geometry: p.geometry,
        properties: { id: b.id, koridor_id: b.rute.koridor, warna: b.rute.warna, kec: Math.round(b.v) },
      };
    });
    map.getSource('bus').setData({ type: 'FeatureCollection', features: fitur });
    if (terpilih && popup) popup.setLngLat(terpilih.lngLat);
  }

  function pilih(id) {
    const b = buses.find((x) => x.id === id);
    if (!b) return;
    popup?.remove();
    terpilih = b;
    map.setFilter('bus-pilih', ['==', ['get', 'id'], id]);
    popup = new maplibregl.Popup({ maxWidth: '250px', offset: 12 })
      .setLngLat(b.lngLat)
      .setHTML(renderPopup(info(b)))
      .addTo(map);
    popup.on('close', () => {
      if (terpilih === b) {
        terpilih = null;
        map.setFilter('bus-pilih', FILTER_KOSONG);
      }
    });
  }

  map.on('click', 'bus-circle', (e) => pilih(e.features[0].properties.id));
  map.on('mouseenter', 'bus-circle', () => (map.getCanvas().style.cursor = 'pointer'));
  map.on('mouseleave', 'bus-circle', () => (map.getCanvas().style.cursor = ''));

  let jalan = false;
  let pengali = SIM.kecAwal;
  let simT = SIM.jamAwal;
  let terakhir = 0;
  let gambarTerakhir = 0;
  let popupTerakhir = 0;

  function frame(now) {
    if (!jalan) return;
    try {
      const dt = Math.min(Math.max((now - terakhir) / 1000, 0), 0.1) * pengali;
      terakhir = now;
      simT += dt;
      buses.forEach((b) => langkah(b, dt, simT));

      if (now - gambarTerakhir > 33) {
        gambar();
        gambarTerakhir = now;
        onTick?.(fmtJam(simT));
      }
      if (terpilih && popup && now - popupTerakhir > 250) {
        popup.setHTML(renderPopup(info(terpilih)));
        popupTerakhir = now;
      }
    } catch (err) {
      console.error('FRAME ERROR:', err);
    }
    requestAnimationFrame(frame);
  }

  function mulai() {
    if (jalan) return;
    jalan = true;
    onMain?.(true);
    requestAnimationFrame((t) => {
      terakhir = t;
      frame(t);
    });
  }
  function jeda() {
    jalan = false;
    onMain?.(false);
  }

  gambar();
  onTick?.(fmtJam(simT));
  mulai();

  return {
    mulai, jeda,
    toggle: () => (jalan ? jeda() : mulai()),
    setKecepatan: (x) => { pengali = x; },
    jumlahBus: buses.length,
    jumlahRute: rute.length,
  };
}