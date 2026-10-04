import * as turf from '@turf/turf';
import { JARAK_HALTE_M, METER_PER_MENIT } from './config.js';

const menitJalan = (m) => Math.max(1, Math.round(m / METER_PER_MENIT));

// Daftar rute unik: [{ id, nama }] terurut
export function daftarRute(fc) {
  const m = new Map();
  fc.features.forEach((f) => {
    const id = f.properties.koridor_id;
    if (id && !m.has(id)) m.set(id, f.properties.nama_koridor || id);
  });
  return [...m]
    .map(([id, nama]) => ({ id, nama }))
    .sort((a, b) => a.id.localeCompare(b.id, 'id', { numeric: true }));
}

export function bufferHalte(koordinat, radiusM) {
  return turf.buffer(turf.point(koordinat), radiusM, { units: 'meters' });
}

export function poiDalamArea(poiData, area) {
  return turf.pointsWithinPolygon(poiData, area);
}

export function halteDalamArea(halteData, area) {
  return turf.pointsWithinPolygon(halteData, area);
}

// Ringkasan POI: total, per kategori, dan daftar terurut dari yang terdekat
export function ringkasPoi(dalam, pusat) {
  const kategori = {};
  const daftar = dalam.features
    .map((x) => {
      const k = x.properties.kategori || 'lainnya';
      kategori[k] = (kategori[k] || 0) + 1;
      const meter = turf.distance(pusat, x.geometry.coordinates, { units: 'meters' });
      return {
        nama: x.properties.nama_poi || 'Tanpa nama',
        kategori: k,
        meter,
        menit: menitJalan(meter),
        koordinat: x.geometry.coordinates,
      };
    })
    .sort((a, b) => a.meter - b.meter);
  return { total: daftar.length, kategori, daftar };
}

export function halteTerdekat(lng, lat, halteData) {
  const klik = turf.point([lng, lat]);
  const halte = turf.nearestPoint(klik, halteData);
  const meter = turf.distance(klik, halte, { units: 'meters' });
  return {
    halte,
    meter,
    menit: menitJalan(meter),
    garis: turf.lineString([klik.geometry.coordinates, halte.geometry.coordinates]),
  };
}

// Koridor/feeder yang melewati sebuah halte (dihitung dari geometri)
const cacheKor = new Map();
export function koridorDiHalte(koordinat, kunci, semuaRute) {
  const k = kunci ?? koordinat.join(',');
  if (cacheKor.has(k)) return cacheKor.get(k);
  const titik = turf.point(koordinat);
  const ids = new Set();
  semuaRute.forEach((r) => {
    if (turf.nearestPointOnLine(r, titik, { units: 'meters' }).properties.dist <= JARAK_HALTE_M) {
      ids.add(r.properties.koridor_id);
    }
  });
  const hasil = [...ids].sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
  cacheKor.set(k, hasil);
  return hasil;
}

// Halte yang berjarak <= JARAK_HALTE_M dari garis rute
const cacheRute = new Map();
export function halteDiRute(id, semuaRute, halteData) {
  if (cacheRute.has(id)) return cacheRute.get(id);
  const garis = semuaRute.filter((f) => f.properties.koridor_id === id);
  const features = halteData.features.filter((h) =>
    garis.some(
      (r) => turf.nearestPointOnLine(r, h, { units: 'meters' }).properties.dist <= JARAK_HALTE_M
    )
  );
  const hasil = { type: 'FeatureCollection', features };
  cacheRute.set(id, hasil);
  return hasil;
}

export function bboxRute(id, semuaRute) {
  const bagian = semuaRute.filter((f) => f.properties.koridor_id === id);
  if (!bagian.length) return null;
  const [w, s, e, n] = turf.bbox({ type: 'FeatureCollection', features: bagian });
  return [[w, s], [e, n]];
}

// Statistik rute: panjang, halte berurutan, jarak antarhalte, titik transit
export function statistikRute(id, semuaRute, halteTerpilih) {
  const garis = semuaRute.filter((f) => f.properties.koridor_id === id);
  const panjang = garis.map((g) => turf.length(g, { units: 'kilometers' }));
  const acuan = garis[panjang.indexOf(Math.max(...panjang))];

  const halte = halteTerpilih.features
    .map((h) => {
      const lokasi = turf.nearestPointOnLine(acuan, h, { units: 'kilometers' }).properties.location;
      const koordinat = h.geometry.coordinates;
      return {
        nama: h.properties.nama_halte || 'Tanpa nama',
        koordinat,
        lokasi,
        transit: koridorDiHalte(koordinat, h.properties.halte_id, semuaRute).filter((k) => k !== id),
      };
    })
    .sort((a, b) => a.lokasi - b.lokasi);

  const n = halte.length;
  return {
    id,
    nama: garis[0]?.properties.nama_koridor || id,
    jumlahArah: garis.length,
    panjangKm: panjang.reduce((a, b) => a + b, 0) / (panjang.length || 1),
    halte,
    rataJarakM: n > 1 ? ((halte[n - 1].lokasi - halte[0].lokasi) / (n - 1)) * 1000 : null,
    jumlahTransit: halte.filter((h) => h.transit.length).length,
  };
}