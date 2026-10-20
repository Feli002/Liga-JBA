/* =====================================================================
   Liga de Karate WUKF — Hoja de resultados por fecha
   Genera páginas verticales 1080×1920 (9:16) con los podios de Kata,
   de Kumite y la tabla general hasta esa fecha, y las entrega como
   PDF (una página por hoja) o como imágenes PNG para WhatsApp.
   Uso: HojaResultados.pdf(2026, 2)  ·  HojaResultados.imagenes(2026, 2)
   ===================================================================== */
(function () {
  const SB_URL = 'https://esycnxngndybogjlscjd.supabase.co';
  const SB_KEY = 'sb_publishable_9e6qqnmHHkYTwX1-HMH7XQ_iOmTQXUt';
  const LIBS = {
    html2canvas: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
  };
  const W = 1080, H = 1920;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 2 });
  const diaLargo = (d) => {
    if (!d) return '';
    const s = new Date(d + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const CSS = `
  .hoja{ position:relative; width:${W}px; height:${H}px; overflow:hidden; background:#faf8f3; color:#1c2320;
    font-family:'Oswald','Arial Narrow',sans-serif; display:flex; flex-direction:column; box-sizing:border-box; }
  .hoja *{ box-sizing:border-box; }
  .hoja .h-banner{ width:100%; height:154px; flex:none; background:#1c2320 center/cover no-repeat; }
  .hoja .h-head{ padding:44px 56px 28px; flex:none; }
  .hoja .h-kicker{ font-weight:500; font-size:24px; letter-spacing:0.14em; text-transform:uppercase; color:#a06a1f; }
  .hoja .h-title{ font-family:'Bebas Neue',Oswald,sans-serif; font-size:132px; line-height:0.9; letter-spacing:0.01em; margin:10px 0 6px; white-space:nowrap; }
  .hoja .h-title span{ color:var(--acc); }
  .hoja .h-sub{ font-size:28px; color:#676c66; }
  .hoja.compact .h-grid{ gap:16px; }
  .hoja.compact .h-card{ padding:16px 22px 18px; }
  .hoja.compact .h-bar{ margin-bottom:10px; }
  .hoja.compact .h-cat{ margin-bottom:8px; }
  .hoja.compact .h-row{ padding:3px 0; }
  .hoja.cont .h-head{ padding-top:36px; padding-bottom:22px; }
  .hoja.cont .h-title{ font-size:84px; }
  .hoja .h-body{ flex:1; min-height:0; padding:0 56px; }
  .hoja .h-grid{ display:grid; grid-template-columns:1fr 1fr; gap:24px; align-items:start; }
  .hoja .h-card{ background:#fff; border:1px solid #dcd6c8; border-radius:20px; padding:22px 24px 24px; }
  .hoja .h-bar{ width:48px; height:6px; border-radius:3px; background:var(--acc); margin-bottom:14px; }
  .hoja .h-cat{ font-weight:600; font-size:22px; line-height:1.25; letter-spacing:0.06em; text-transform:uppercase; margin-bottom:14px; }
  .hoja .h-row{ display:flex; align-items:center; gap:16px; padding:6px 0; }
  .hoja .h-medal{ width:48px; height:48px; border-radius:50%; flex:none; display:flex; align-items:center; justify-content:center;
    font-weight:700; font-size:24px; color:#fff; }
  .hoja .m1{ background:#c98a2e; color:#1c2320; } .hoja .m2{ background:#8f959b; } .hoja .m3{ background:#b5733f; }
  .hoja .h-name{ flex:1; min-width:0; font-weight:500; font-size:28px; line-height:1.15; }
  .hoja .h-row.l1 .h-name{ font-weight:600; font-size:32px; }
  .hoja .h-pts{ font-size:24px; color:#676c66; font-variant-numeric:tabular-nums; }
  .hoja .h-list{ display:flex; flex-direction:column; gap:12px; }
  .hoja .h-trow{ display:flex; align-items:center; gap:20px; background:#fff; border:1px solid #dcd6c8; border-radius:16px; padding:14px 28px 14px 24px; }
  .hoja .h-trow.t1{ background:#f8ecd6; }
  .hoja .h-trow .h-pos{ width:48px; flex:none; text-align:center; font-weight:600; font-size:26px; color:#676c66; }
  .hoja .h-trow .h-name{ font-size:30px; }
  .hoja .h-total{ font-family:'Bebas Neue',Oswald,sans-serif; font-size:44px; line-height:1; white-space:nowrap; }
  .hoja .h-total small{ font-family:Oswald,sans-serif; font-size:20px; letter-spacing:0.08em; color:#676c66; margin-left:4px; }
  .hoja .h-note{ font-size:24px; line-height:1.4; color:#676c66; margin-top:22px; }
  .hoja .h-foot{ flex:none; display:flex; justify-content:space-between; align-items:center; background:#1c2320; padding:28px 56px;
    font-weight:500; font-size:24px; letter-spacing:0.06em; color:#fff; }
  .hoja .h-foot b{ font-weight:500; color:#f1cf7a; letter-spacing:0.04em; }`;

  function cargarScript(url, global) {
    if (window[global]) return Promise.resolve();
    return new Promise((ok, mal) => {
      const s = document.createElement('script');
      s.src = url; s.onload = ok; s.onerror = () => mal(new Error('No se pudo cargar ' + url));
      document.head.appendChild(s);
    });
  }

  async function datos(anio, numero) {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/hoja_resultados`, {
      method: 'POST',
      headers: { apikey: SB_KEY, 'Content-Type': 'application/json', ...(window.LIGA_PERFIL || {}) },
      body: JSON.stringify({ p_anio: anio, p_numero: numero })
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    if (!d || !d.podios || !d.podios.length) throw new Error('Esta fecha todavía no tiene podios.');
    return d;
  }

  /* Agrupa los podios por categoría manteniendo el orden */
  function categorias(podios, modalidad) {
    const out = [];
    podios.filter(p => p.modalidad === modalidad).forEach(p => {
      let c = out.find(x => x.nombre === p.categoria);
      if (!c) { c = { nombre: p.categoria, lugares: [] }; out.push(c); }
      c.lugares.push(p);
    });
    out.forEach(c => c.lugares.sort((a, b) => a.lugar - b.lugar));
    return out;
  }

  function banner() {
    const img = document.querySelector('.site-banner img');
    return img ? `background-image:url('${img.src}')` : '';
  }

  function pagina(d, { titulo, acento, sub, cont }) {
    const el = document.createElement('div');
    el.className = 'hoja' + (cont ? ' cont' : '');
    el.style.setProperty('--acc', acento);
    el.innerHTML = `
      ${cont ? '' : `<div class="h-banner" style="${banner()}"></div>`}
      <div class="h-head">
        <div class="h-kicker">Liga de Karate WUKF · Temporada ${esc(d.anio)}</div>
        <div class="h-title">Fecha ${esc(d.numero)} <span>${esc(titulo)}</span></div>
        <div class="h-sub">${esc(sub)}</div>
      </div>
      <div class="h-body"></div>
      <div class="h-foot"><b>feli002.github.io/Liga-JBA</b><span class="h-num"></span></div>`;
    return el;
  }

  function tarjeta(c, modalidad) {
    const el = document.createElement('div');
    el.className = 'h-card';
    el.innerHTML = `<div class="h-bar"></div><div class="h-cat">${esc(c.nombre)}</div>` +
      c.lugares.map(p => `<div class="h-row l${p.lugar}"><div class="h-medal m${p.lugar}">${p.lugar}</div>
        <div class="h-name">${esc(p.competidor)}</div>
        ${modalidad === 'Kata' && p.puntaje != null ? `<div class="h-pts">${Number(p.puntaje).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</div>` : ''}</div>`).join('');
    return el;
  }

  /* Reparte las tarjetas en páginas: si una no cabe, abre una página de continuación */
  function paginasModalidad(d, cont, modalidad, acento, sub) {
    const cats = categorias(d.podios, modalidad);
    if (!cats.length) return [];
    const paginas = [];
    let pag, grid;
    const nueva = (esCont) => {
      pag = pagina(d, { titulo: esCont ? `${modalidad} (cont.)` : modalidad, acento, sub, cont: esCont });
      cont.appendChild(pag);
      grid = document.createElement('div'); grid.className = 'h-grid';
      pag.querySelector('.h-body').appendChild(grid);
      paginas.push(pag);
    };
    nueva(false);
    for (const c of cats) {
      const t = tarjeta(c, modalidad);
      grid.appendChild(t);
      const body = pag.querySelector('.h-body');
      if (grid.offsetHeight > body.clientHeight && !pag.classList.contains('compact')) pag.classList.add('compact');
      if (grid.offsetHeight > body.clientHeight && grid.children.length > 1) {
        t.remove(); nueva(true); grid.appendChild(t);
      }
    }
    return paginas;
  }

  function paginaTabla(d, cont) {
    if (!d.tabla.length) return [];
    const pag = pagina(d, {
      titulo: 'Tabla', acento: '#c98a2e',
      sub: `Tabla general tras ${d.fechas_con_resultados} de ${d.n_fechas} fechas`
    });
    cont.appendChild(pag);
    const body = pag.querySelector('.h-body');
    const list = document.createElement('div'); list.className = 'h-list'; body.appendChild(list);
    const note = document.createElement('div'); note.className = 'h-note';
    note.textContent = 'Puntaje: 1 por asistir · 1º 3, 2º 2 y 3º 1 en Kata y Kumite · −0,5 por cada Atenai. Empates: más Ippones, luego menos faltas.';
    body.appendChild(note);
    for (const r of d.tabla.filter(x => x.posicion <= 10)) {
      const row = document.createElement('div');
      row.className = 'h-trow t' + r.posicion;
      row.innerHTML = (r.posicion <= 3 ? `<div class="h-medal m${r.posicion}">${r.posicion}</div>` : `<div class="h-pos">${r.posicion}</div>`) +
        `<div class="h-name">${esc(r.competidor)}</div><div class="h-total">${num(r.total)}<small>PTS</small></div>`;
      list.appendChild(row);
      if (list.offsetHeight + note.offsetHeight + 22 > body.clientHeight) { row.remove(); break; }
    }
    return [pag];
  }

  async function construir(anio, numero) {
    const d = await datos(anio, numero);
    d.anio = anio;
    if (!document.getElementById('hoja-css')) {
      const st = document.createElement('style'); st.id = 'hoja-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    const cont = document.createElement('div');
    cont.style.cssText = `position:fixed; left:-${W * 3}px; top:0; width:${W}px; pointer-events:none;`;
    cont.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cont);
    await document.fonts.ready;
    const nCat = new Set(d.podios.map(p => p.categoria)).size;
    const dia = diaLargo(d.dia);
    const paginas = [
      ...paginasModalidad(d, cont, 'Kata', '#c98a2e', [dia, d.competidores ? `${d.competidores} competidores` : null, `${new Set(d.podios.filter(p => p.modalidad === 'Kata').map(p => p.categoria)).size} categorías`].filter(Boolean).join(' · ')),
      ...paginasModalidad(d, cont, 'Kumite', '#c8262c', [dia, `${new Set(d.podios.filter(p => p.modalidad === 'Kumite').map(p => p.categoria)).size} categorías`].filter(Boolean).join(' · ')),
      ...paginaTabla(d, cont)
    ];
    paginas.forEach((p, i) => p.querySelector('.h-num').textContent = `${i + 1} / ${paginas.length}`);
    return { d, cont, paginas };
  }

  async function renderizar(anio, numero) {
    await cargarScript(LIBS.html2canvas, 'html2canvas');
    const { d, cont, paginas } = await construir(anio, numero);
    try {
      const lienzos = [];
      for (const p of paginas) {
        lienzos.push(await window.html2canvas(p, { width: W, height: H, scale: 1, backgroundColor: '#faf8f3', logging: false, useCORS: true }));
      }
      return { d, lienzos };
    } finally { cont.remove(); }
  }

  const nombreBase = (d) => `Liga-WUKF-${d.temporada.replace(/\D/g, '') || ''}-Fecha-${d.numero}`;
  const aBlob = (c, tipo = 'image/png', q) => new Promise(ok => c.toBlob(ok, tipo, q));
  function bajar(blob, nombre) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  async function pdf(anio, numero) {
    await cargarScript(LIBS.jspdf, 'jspdf');
    const { d, lienzos } = await renderizar(anio, numero);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'px', format: [W, H], hotfixes: ['px_scaling'], compress: true });
    lienzos.forEach((c, i) => {
      if (i) doc.addPage([W, H], 'portrait');
      doc.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, W, H);
    });
    doc.setProperties({ title: `Resultados Fecha ${d.numero} · Liga de Karate WUKF` });
    const blob = doc.output('blob');
    const nombre = nombreBase(d) + '.pdf';
    const file = new File([blob], nombre, { type: 'application/pdf' });
    return { blob, nombre, file };
  }

  async function imagenes(anio, numero) {
    const { d, lienzos } = await renderizar(anio, numero);
    const files = [];
    for (let i = 0; i < lienzos.length; i++) {
      const b = await aBlob(lienzos[i]);
      files.push(new File([b], `${nombreBase(d)}-${i + 1}.png`, { type: 'image/png' }));
    }
    return files;
  }

  /* Comparte con el menú del teléfono (WhatsApp aparece ahí); si no se puede, descarga */
  async function entregar(files, titulo) {
    if (navigator.canShare && navigator.canShare({ files })) {
      try { await navigator.share({ files, title: titulo }); return 'compartido'; }
      catch (e) { if (e.name === 'AbortError') return 'cancelado'; }
    }
    for (const f of files) { bajar(f, f.name); await new Promise(r => setTimeout(r, 350)); }
    return 'descargado';
  }

  window.HojaResultados = { construir, pdf, imagenes, entregar, bajar };
})();
