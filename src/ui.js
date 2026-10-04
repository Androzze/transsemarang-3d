import { METER_PER_MENIT, KATEGORI, WARNA_LAIN } from './config.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

const fmtJarak = (m) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`);

// ---------- Panel kiri ----------
export function buatPanelKiri(o) {
  let aktif = null;
  const el = document.createElement('aside');
  el.className = 'panel panel-kiri';

  const item = (r) => `
    <li class="rute" data-id="${esc(r.id)}">
      <input type="checkbox" checked aria-label="Tampilkan ${esc(r.id)}">
      <span class="swatch" style="background:${esc(r.warna)}"></span>
      <button type="button" class="rute-nama" title="Klik untuk fokus">${esc(r.nama)}</button>
    </li>`;

  el.innerHTML = `
    <h1>TransSemarang 3D</h1>

    <section>
      <h2>Lapisan</h2>
      <label class="baris"><input type="checkbox" data-layer="halte" checked> Titik halte</label>
      <label class="baris"><input type="checkbox" data-layer="poi" checked> Titik POI</label>
    </section>

    <section>
      <h2>Radius jangkauan: <output id="radius-nilai"></output></h2>
      <input type="range" id="radius" min="100" max="800" step="50" value="${o.radiusAwal}">
      <small id="radius-menit"></small>
    </section>

    <section>
      <h2>Koridor</h2>
      <ul>${o.koridor.map(item).join('')}</ul>
      <h2>Feeder</h2>
      <ul>${o.feeder.map(item).join('')}</ul>
    </section>

    <section>
      <h2>Simbol</h2>
      <div class="baris"><span class="dot" style="background:#fff;border:2px solid #1a237e"></span> Halte</div>
      <div class="baris"><span class="dot" style="background:#ff9800;border:1px solid #fff"></span> POI</div>
      <div class="baris"><span class="dot" style="background:#ff9800;border:3px solid #00E5FF"></span> POI dalam jangkauan</div>
      <div class="baris"><span class="dot" style="background:#fff;border:3px solid #FFC400"></span> Halte rute terpilih</div>
      <div class="baris"><span class="dot" style="background:#1E88E5;border:2px solid #fff"></span> Bus (simulasi)</div>
    </section>

    <button type="button" id="btn-semua">Lihat semua rute</button>
  `;
  document.body.appendChild(el);

  const label = (r) => {
    el.querySelector('#radius-nilai').textContent = `${r} m`;
    el.querySelector('#radius-menit').textContent =
      `≈ ${Math.max(1, Math.round(r / METER_PER_MENIT))} menit jalan kaki (garis lurus)`;
  };
  label(o.radiusAwal);

  el.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.layer) o.onToggleLayer(t.dataset.layer, t.checked);
    else if (t.closest('.rute')) o.onToggleRute(t.closest('.rute').dataset.id, t.checked);
  });

  el.addEventListener('click', (e) => {
    const b = e.target.closest('.rute-nama');
    if (b) {
      const id = b.closest('.rute').dataset.id;
      o.onSorot(id === aktif ? null : id); // klik lagi = batal fokus
    }
    if (e.target.id === 'btn-semua') o.onLihatSemua();
  });

  el.querySelector('#radius').addEventListener('input', (e) => {
    const r = Number(e.target.value);
    label(r);
    o.onRadius(r);
  });

  return {
    tandaiAktif(id) {
      aktif = id;
      el.querySelectorAll('.rute').forEach((li) =>
        li.classList.toggle('aktif', li.dataset.id === id)
      );
    },
  };
}

// ---------- Popup POI ----------
export function htmlPoi(p) {
  return `<strong>POI: ${esc(p.nama_poi || 'Tanpa Nama')}</strong><br>Kategori: ${esc(p.kategori || '-')}`;
}

// ---------- Popup bus ----------
export function htmlBus(i) {
  return `<strong>${esc(i.id)}</strong>
    <span class="badge" style="background:${esc(i.warna)};color:#fff">${esc(i.koridor)}</span><br>
    ${esc(i.namaRute)}<br>
    Kecepatan: <strong>${i.kec} km/jam</strong><br>
    ${esc(i.status)}<hr>
    <small>⚠ Data simulasi, bukan posisi bus sebenarnya</small>`;
}

// ---------- Panel kanan ----------
export function buatPanelKanan(o) {
  const el = document.createElement('aside');
  el.className = 'panel panel-kanan';
  document.body.appendChild(el);

  const chip = (id) =>
    `<button type="button" class="chip" data-rute="${esc(id)}" style="background:${esc(o.warna[id] ?? WARNA_LAIN)}">${esc(id)}</button>`;
  const chips = (arr) => (arr.length ? arr.map(chip).join('') : '<span class="redup">-</span>');
  const stat = (nilai, label) => `<div class="stat"><b>${nilai}</b><span>${label}</span></div>`;
  const kepala = (judul, sub = '') => `
    <div class="kepala">
      <div><h1>${esc(judul)}</h1>${sub}</div>
      <button type="button" class="tutup" aria-label="Tutup">×</button>
    </div>`;
  const pasang = (html) => { el.innerHTML = html; el.scrollTop = 0; };

  const kosongkan = () =>
    pasang(`<h1>Hasil analisis</h1>
      <p class="redup">Klik <b>halte</b> untuk melihat fasilitas di sekitarnya, klik <b>garis rute</b>
      untuk melihat statistik dan daftar halte, atau klik <b>area kosong</b> untuk mencari halte terdekat.</p>`);
  kosongkan();

  el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-lng]');
    if (t) return o.onTerbang([Number(t.dataset.lng), Number(t.dataset.lat)]);
    const r = e.target.closest('[data-rute]');
    if (r) return o.onSorot(r.dataset.rute);
    if (e.target.closest('.tutup')) o.onTutup();
  });

  const item = (koordinat, isi) =>
    `<li class="klik" data-lng="${koordinat[0]}" data-lat="${koordinat[1]}">${isi}</li>`;

  return {
    kosongkan,

    tampilHalte({ props, koridor, ringkas, radius, halteLain }) {
      const kat = Object.entries(ringkas.kategori).sort((a, b) => b[1] - a[1]);
      const maks = Math.max(1, ...kat.map(([, n]) => n));
      const info = (k) => KATEGORI[k] ?? { label: k, warna: KATEGORI.lainnya.warna };
      const adaKategori = kat.some(([k]) => k !== 'lainnya');
      const variasi = kat.filter(([k]) => k !== 'lainnya').length;

      const bar = kat.map(([k, n]) => `
        <div class="bar">
          <span class="bar-label">${esc(info(k).label)}</span>
          <div class="bar-track"><div class="bar-isi" style="width:${(n / maks) * 100}%;background:${info(k).warna}"></div></div>
          <span class="bar-n">${n}</span>
        </div>`).join('');

      let insight = '';
      if (ringkas.total === 0) insight = 'Tidak ada POI dalam jangkauan ini.';
      else if (adaKategori) insight = `Didominasi <b>${esc(info(kat[0][0]).label.toLowerCase())}</b> (${kat[0][1]} dari ${ringkas.total} POI).`;

      const daftar = ringkas.daftar.slice(0, 10).map((p) =>
        item(p.koordinat, `
          <span class="titik" style="background:${info(p.kategori).warna}"></span>
          <span class="nama">${esc(p.nama)}</span>
          <span class="redup">${fmtJarak(p.meter)} · ${p.menit} mnt</span>`)).join('');
      const sisa = ringkas.daftar.length > 10 ? `<li class="redup">…dan ${ringkas.daftar.length - 10} lainnya</li>` : '';

      pasang(`
        ${kepala(props.nama_halte || 'Halte', koridor.length > 1 ? '<span class="badge">Halte transit</span>' : '')}
        <h2>Dilayani koridor</h2>
        <div>${koridor.length ? chips(koridor) : '<span class="redup">Tidak terdeteksi (jauh dari garis rute)</span>'}</div>

        <h2>Jangkauan ${radius} m · ±${Math.max(1, Math.round(radius / METER_PER_MENIT))} menit jalan</h2>
        <div class="stats">
          ${stat(ringkas.total, 'POI')}
          ${stat(halteLain, 'halte lain')}
          ${stat(variasi || '-', 'jenis fasilitas')}
        </div>
        ${insight ? `<p class="insight">${insight}</p>` : ''}

        ${ringkas.total ? `<h2>POI per kategori</h2>${bar}` : ''}
        ${ringkas.total && !adaKategori
          ? '<p class="redup">Kolom <code>kategori</code> belum ada di data POI, jadi semua masuk "Lainnya".</p>' : ''}

        ${ringkas.total ? `<h2>Terdekat dari halte</h2><ul class="daftar">${daftar}${sisa}</ul>` : ''}
        <p class="redup kecil">Jarak garis lurus, bukan jarak jalan sebenarnya.</p>`);
    },

    tampilRute(s) {
      const daftar = s.halte.map((h, i) =>
        item(h.koordinat, `
          <span class="no">${i + 1}</span>
          <span class="nama">${esc(h.nama)}</span>
          ${h.transit.length ? `<span class="transit">${h.transit.map(chip).join('')}</span>` : ''}`)).join('');

      pasang(`
        ${kepala(s.nama, `<span class="badge" style="background:${esc(o.warna[s.id] ?? WARNA_LAIN)};color:#fff">${esc(s.id)}</span>`)}
        <div class="stats">
          ${stat(s.halte.length, 'halte')}
          ${stat(s.panjangKm.toFixed(1) + ' km', s.jumlahArah > 1 ? 'panjang / arah' : 'panjang')}
          ${stat(s.rataJarakM ? Math.round(s.rataJarakM) + ' m' : '-', 'rata² antarhalte')}
          ${stat(s.jumlahTransit, 'titik transit')}
        </div>
        <h2>Halte sepanjang rute</h2>
        <ol class="daftar urut">${daftar || '<li class="redup">Tidak ada halte terdeteksi.</li>'}</ol>
        <p class="redup kecil">Halte di seberang jalan ikut terhitung. Chip warna = koridor lain yang bisa disambung di halte itu.</p>`);
    },

    tampilTerdekat(t, koridor) {
      pasang(`
        ${kepala('Halte terdekat')}
        <ul class="daftar">${item(t.halte.geometry.coordinates,
          `<span class="nama"><b>${esc(t.halte.properties.nama_halte || '-')}</b></span>`)}</ul>
        <div class="stats">
          ${stat(fmtJarak(t.meter), 'garis lurus')}
          ${stat('±' + t.menit + ' mnt', 'jalan kaki')}
        </div>
        <h2>Dilayani koridor</h2>
        <div>${chips(koridor)}</div>
        <p class="redup kecil">Estimasi 4,8 km/jam. Jarak asli di jalan bisa lebih jauh.</p>`);
    },
  };
}

// ---------- Kontrol simulasi ----------
export function buatKontrolSimulasi(o) {
  const el = document.createElement('div');
  el.className = 'sim-bar';
  el.innerHTML = `
    <button type="button" id="sim-play" aria-label="Jeda simulasi">⏸</button>
    <span class="sim-jam" id="sim-jam">--:--</span>
    <label>Kecepatan
      <select id="sim-kec">
        <option value="1">1×</option>
        <option value="5">5×</option>
        <option value="10" selected>10×</option>
        <option value="30">30×</option>
        <option value="60">60×</option>
      </select>
    </label>
    <label><input type="checkbox" id="sim-tampil" checked> Tampilkan bus</label>
    <span id="sim-info" class="redup"></span>
    <span class="sim-label">Data simulasi, bukan posisi bus sebenarnya</span>`;
  document.body.appendChild(el);

  const tombol = el.querySelector('#sim-play');
  const jam = el.querySelector('#sim-jam');
  let jamLama = '';

  tombol.addEventListener('click', () => o.onToggle());
  el.querySelector('#sim-kec').addEventListener('change', (e) => o.onKecepatan(Number(e.target.value)));
  el.querySelector('#sim-tampil').addEventListener('change', (e) => o.onTampil(e.target.checked));

  return {
    setMain(main) {
      tombol.textContent = main ? '⏸' : '▶';
      tombol.setAttribute('aria-label', main ? 'Jeda simulasi' : 'Putar simulasi');
    },
    setJam(teks) {
      if (teks === jamLama) return;
      jamLama = teks;
      jam.textContent = teks;
    },
    setJumlah(n) {
      el.querySelector('#sim-info').textContent = `${n} bus`;
    },
  };
}