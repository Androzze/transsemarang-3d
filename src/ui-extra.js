// ---------- Loading ----------
export function buatLoading() {
  const el = document.createElement('div');
  el.className = 'loading';
  el.innerHTML = '<div class="spin"></div><p id="loading-teks">Memuat peta…</p>';
  document.body.appendChild(el);
  const teks = el.querySelector('#loading-teks');

  return {
    ubah(t) { teks.textContent = t; },
    galat(t) {
      el.classList.add('galat');
      teks.textContent = t;
    },
    selesai() {
      el.classList.add('hilang');
      setTimeout(() => el.remove(), 400);
    },
  };
}

// ---------- Pencarian halte ----------
export function buatPencarian({ halte, onPilih }) {
  const daftar = halte.features
    .filter((f) => f.properties?.nama_halte)
    .map((f) => ({ f, kunci: String(f.properties.nama_halte).toLowerCase() }));

  const el = document.createElement('div');
  el.className = 'cari';
  el.innerHTML = `
    <input type="search" placeholder="Cari halte…" aria-label="Cari halte" autocomplete="off">
    <ul class="cari-hasil" hidden></ul>`;
  document.body.appendChild(el);

  const input = el.querySelector('input');
  const ul = el.querySelector('ul');
  let hasil = [];

  const tutup = () => { ul.hidden = true; };

  const pilih = (i) => {
    const h = hasil[i];
    if (!h) return;
    input.value = h.f.properties.nama_halte;
    tutup();
    input.blur();
    onPilih(h.f);
  };

  const cari = () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { hasil = []; return tutup(); }
    hasil = daftar
      .filter((d) => d.kunci.includes(q))
      .sort((a, b) => a.kunci.indexOf(q) - b.kunci.indexOf(q))
      .slice(0, 8);

    ul.innerHTML = '';
    if (!hasil.length) {
      const li = document.createElement('li');
      li.className = 'kosong';
      li.textContent = 'Halte tidak ditemukan';
      ul.appendChild(li);
    } else {
      hasil.forEach((h, i) => {
        const li = document.createElement('li');
        li.dataset.i = i;
        li.textContent = h.f.properties.nama_halte;
        ul.appendChild(li);
      });
    }
    ul.hidden = false;
  };

  input.addEventListener('input', cari);
  input.addEventListener('focus', cari);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') pilih(0);
    if (e.key === 'Escape') { input.value = ''; tutup(); input.blur(); }
  });
  ul.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li[data-i]');
    if (li) { e.preventDefault(); pilih(Number(li.dataset.i)); }
  });
  document.addEventListener('click', (e) => { if (!el.contains(e.target)) tutup(); });

  return { kosongkan() { input.value = ''; tutup(); } };
}