import fs from 'fs';

const poi = JSON.parse(fs.readFileSync('public/data/titik_poi.geojson', 'utf8'));

// Aturan, urutan = prioritas
const ATURAN = [
  ['kesehatan',    /(hospital|clinic|doctors|pharmacy|dentist|healthcare|puskesmas|rumah sakit|\brsu\b|\brsud\b|\brsup\b|klinik|apotek)/],
  ['pendidikan',   /(school|university|college|kindergarten|sekolah|universitas|kampus|madrasah|\bsd\b|\bsmp\b|\bsma\b|\bsmk\b|\bmts\b|\btk\b|paud|politeknik)/],
  ['pemerintahan', /(townhall|government|courthouse|police|post_office|kantor|kelurahan|kecamatan|dinas|pemkot|pengadilan|polres|polsek|dprd|balai kota)/],
  ['perbelanjaan', /(mall|supermarket|marketplace|market|department_store|convenience|shop|retail|pasar|toko|plaza|swalayan|mart\b)/],
];

const KUNCI_TAG = /amenity|shop|building|office|fclass|type|jenis|kategori|tourism|landuse|government|healthcare|class|sub/i;
const KUNCI_NAMA = /^(nama_poi|name|nama)$/i;

const cari = (teks) => ATURAN.find(([, re]) => re.test(teks))?.[0] ?? null;

const kolom = new Set();
const hitung = {};
const contohKosong = [];

poi.features.forEach((f) => {
  const p = f.properties;
  Object.keys(p).forEach((k) => kolom.add(k));

  if (['pendidikan', 'kesehatan', 'perbelanjaan', 'pemerintahan'].includes(p.kategori)) {
    hitung[p.kategori] = (hitung[p.kategori] || 0) + 1;
    return; // sudah benar, jangan ditimpa
  }

  const teksTag = Object.entries(p)
    .filter(([k, v]) => KUNCI_TAG.test(k) && typeof v === 'string')
    .map(([, v]) => v.toLowerCase()).join(' | ');
  const nama = Object.entries(p)
    .filter(([k, v]) => KUNCI_NAMA.test(k) && typeof v === 'string')
    .map(([, v]) => v.toLowerCase()).join(' ');

  const k = cari(teksTag) ?? cari(nama);
  if (k) p.kategori = k;
  else { p.kategori = 'lainnya'; if (contohKosong.length < 15) contohKosong.push(p.nama_poi || '(tanpa nama)'); }
  hitung[p.kategori] = (hitung[p.kategori] || 0) + 1;
});

fs.writeFileSync('shp/titik_poi_baru.geojson', JSON.stringify(poi));
console.log('Kolom yang ada     :', [...kolom].join(', '));
console.log('Hasil per kategori :', hitung);
console.log('Contoh "lainnya"   :', contohKosong);