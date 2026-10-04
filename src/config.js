export const KOSONG = { type: 'FeatureCollection', features: [] };

export const PUSAT = [110.4203, -6.9903]; // Simpang Lima
export const RADIUS_AWAL = 400;           // meter
export const METER_PER_MENIT = 80;        // 4,8 km/jam
export const JARAK_HALTE_M = 60;          // halte <= 60 m dari garis dianggap dilewati

// Kunci = koridor_id di GeoJSON (harus persis sama)
export const WARNA_KORIDOR = {
  K1: '#E53935',
  K2: '#D81B60',
  K3A: '#8E24AA',
  K3B: '#5E35B1',
  K4: '#1E88E5',
  K5: '#00ACC1',
  K6: '#00897B',
  K7: '#FDD835',
  K8: '#FB8C00',
};

export const WARNA_FEEDER = ['#43A047', '#7CB342', '#6D4C41', '#546E7A', '#F4511E', '#3949AB'];
export const WARNA_LAIN = '#757575';

export const LEBAR_RUTE = { 'koridor-line': 4, 'feeder-line': 3 };
export const OPASITAS_RUTE = { 'koridor-line': 1, 'feeder-line': 0.85 };

// Offset pisah dua arah (membesar saat zoom dekat)
export const OFFSET_ARAH = ['interpolate', ['linear'], ['zoom'], 11, -1.5, 15, -3.5, 18, -7];

export const KATEGORI = {
  pendidikan:   { label: 'Pendidikan',   warna: '#42A5F5' },
  kesehatan:    { label: 'Kesehatan',    warna: '#EF5350' },
  perbelanjaan: { label: 'Perbelanjaan', warna: '#FFA726' },
  pemerintahan: { label: 'Pemerintahan', warna: '#AB47BC' },
  lainnya:      { label: 'Lainnya',      warna: '#9E9E9E' },
};

export const SIM = {
  kmPerBus: 6,          // 1 bus per ~6 km panjang rute
  maxBusPerRute: 3,
  kecMin: 20,           // km/jam
  kecMax: 32,
  dwellMin: 6,          // detik simulasi berhenti di halte
  dwellMax: 12,
  dwellTerminal: 20,
  jarakHalteM: 50,      // halte <= 50 m dari garis dianggap halte rute itu
  jamAwal: 6 * 3600,    // jam simulasi mulai 06:00
  kecAwal: 10,          // pengali waktu awal
};