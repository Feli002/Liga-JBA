/* =====================================================================
   Liga de Karate WUKF — Informe de la temporada en PDF
   Documento A4 vertical con texto real (se puede buscar e imprimir),
   generado en el navegador con jsPDF a partir de los datos ya cargados
   en tabla-general.html. Secciones (cada una opcional):
     1. Tabla general            2. Posiciones por categoría
     3. Rendimiento por competidor
   Uso: TablaPDF.informe({ temp, filas, eliminados, porCat, rendimiento,
                           fechasJugadas, disputadas, incluirAtenai, dAtenai,
                           secciones: { general, categorias, rendimiento } })
   Devuelve { blob, nombre, file }.
   ===================================================================== */
(function () {
  const LIBS = [
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
  ];

  // Paleta del sitio
  const INK = [28, 35, 32], GOLD = [201, 138, 46], MUTED = [103, 108, 102], LINE = [220, 214, 200],
        SOFT = [245, 242, 234], SILVER = [143, 149, 155], BRONZE = [176, 108, 59], AKA = [200, 38, 44], WHITE = [255, 255, 255],
        ZEBRA = [252, 251, 248];
  const POS_COLOR = { 1: GOLD, 2: SILVER, 3: BRONZE };

  // A4 en mm
  const PW = 210, PH = 297, MX = 14, TOP = 40, BOTTOM = 16, ANCHO = PW - MX * 2;

  const num = (n) => Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 2 });
  const hoy = () => new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
  const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  const ord = (n) => n ? `${n}º` : '';
  const mmss = (s) => { s = Number(s); if (!s) return ''; const m = Math.floor(s / 60), r = Math.round(s % 60); return m ? `${m}:${String(r).padStart(2, '0')} min` : `${r} s`; };

  function cargarJsPDF() {
    if (window.jspdf) return Promise.resolve();
    const intentar = (i) => new Promise((ok, mal) => {
      if (i >= LIBS.length) return mal(new Error('No se pudo cargar el generador de PDF. Revisa tu conexión.'));
      const s = document.createElement('script');
      s.src = LIBS[i]; s.onload = ok; s.onerror = () => { s.remove(); intentar(i + 1).then(ok, mal); };
      document.head.appendChild(s);
    });
    return intentar(0);
  }

  /* ---------- Documento con cabecera, pie y salto de página automático ---------- */
  function Documento(temp, titulo, subtitulo) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    doc.setProperties({ title: `${titulo} · ${temp.nombre}`, author: 'Liga de Karate WUKF', subject: subtitulo || '' });
    let y = TOP, seccion = '';

    const cabecera = () => {
      doc.setFillColor(...INK); doc.rect(0, 0, PW, 30, 'F');
      doc.setFillColor(...GOLD); doc.rect(0, 30, PW, 1.2, 'F');
      doc.setTextColor(...GOLD); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setCharSpace(0.6);
      doc.text('LIGA DE KARATE WUKF', MX, 11);
      doc.setCharSpace(0);
      doc.setTextColor(...WHITE); doc.setFontSize(20); doc.text(titulo, MX, 21);
      if (seccion) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(230, 226, 215); doc.text(seccion, MX, 27); }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(230, 226, 215);
      doc.text(temp.nombre, PW - MX, 11, { align: 'right' });
      if (subtitulo) doc.text(subtitulo, PW - MX, 16.5, { align: 'right' });
      doc.text('Generado el ' + hoy(), PW - MX, 22, { align: 'right' });
    };
    const pie = () => {
      const n = doc.getNumberOfPages();
      for (let i = 1; i <= n; i++) {
        doc.setPage(i);
        doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(MX, PH - 11, PW - MX, PH - 11);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
        doc.text('Liga de Karate WUKF · feli002.github.io/Liga-JBA', MX, PH - 7);
        doc.text(`Página ${i} de ${n}`, PW - MX, PH - 7, { align: 'right' });
      }
    };
    cabecera();

    return {
      doc,
      get y() { return y; },
      set y(v) { y = v; },
      // Garantiza espacio; si no cabe, nueva página con cabecera
      asegurar(alto) {
        if (y + alto > PH - BOTTOM) { doc.addPage(); cabecera(); y = TOP; return true; }
        return false;
      },
      // Empieza una sección: en página nueva salvo que sea la primera
      seccion(nombre) {
        seccion = nombre;
        if (y > TOP) { doc.addPage(); y = TOP; }
        else { doc.deletePage(doc.getNumberOfPages()); doc.addPage(); y = TOP; }
        cabecera();
      },
      terminar() { pie(); return doc; }
    };
  }

  /* ---------- Tabla con cabecera repetida en cada página ----------
     cols: [{ titulo, ancho, align, clave | render(fila) -> texto | [líneas], esPos, esNombre, sub(f), esTotal, muted, color(f), chico }]
     filas: objetos; op: { posClave, filaAlto, totalFila: índice de fila a resaltar } */
  function tabla(D, cols, filas, op = {}) {
    const { doc } = D;
    const alto = op.filaAlto || 7.6, hAlto = 7, LH = 3.4;
    const x0 = MX, anchoTotal = cols.reduce((s, c) => s + c.ancho, 0);

    const cabeceraTabla = () => {
      doc.setFillColor(...SOFT); doc.rect(x0, D.y, anchoTotal, hAlto, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...MUTED); doc.setCharSpace(0.3);
      let x = x0;
      cols.forEach(c => {
        const tx = c.align === 'right' ? x + c.ancho - 2 : c.align === 'center' ? x + c.ancho / 2 : x + 2;
        doc.text(String(c.titulo).toUpperCase(), tx, D.y + 4.7, { align: c.align || 'left' });
        x += c.ancho;
      });
      doc.setCharSpace(0);
      D.y += hAlto;
    };

    // Prepara celdas y alto de cada fila
    const prep = filas.map(f => {
      const celdas = cols.map(c => {
        let v = c.render ? c.render(f) : f[c.clave];
        const lineas = Array.isArray(v) ? v.map(String) : [v == null ? '' : String(v)];
        const sub = (c.esNombre && c.sub) ? (c.sub(f) || '') : '';
        return { lineas, sub };
      });
      const maxL = Math.max(...celdas.map(c => c.lineas.length + (c.sub ? 1 : 0)));
      const h = Math.max(alto, maxL * LH + 3.6);
      return { f, celdas, h };
    });

    D.asegurar(hAlto + (prep[0] ? prep[0].h : alto));
    cabeceraTabla();
    prep.forEach(({ f, celdas, h }, i) => {
      if (D.asegurar(h)) cabeceraTabla();
      const pos = op.posClave ? Number(f[op.posClave]) : 0;
      const esTotal = op.totalFila === i;
      if (esTotal) { doc.setFillColor(...SOFT); doc.rect(x0, D.y, anchoTotal, h, 'F'); }
      else if (i % 2) { doc.setFillColor(...ZEBRA); doc.rect(x0, D.y, anchoTotal, h, 'F'); }
      doc.setDrawColor(...LINE); doc.setLineWidth(0.15); doc.line(x0, D.y + h, x0 + anchoTotal, D.y + h);
      let x = x0;
      cols.forEach((c, k) => {
        const { lineas, sub } = celdas[k];
        const tx = c.align === 'right' ? x + c.ancho - 2 : c.align === 'center' ? x + c.ancho / 2 : x + 2;
        let color = INK, estilo = 'normal', tam = 9.5;
        if (c.esPos) { estilo = 'bold'; tam = 11; color = POS_COLOR[pos] || INK; }
        else if (c.esTotal) { estilo = 'bold'; tam = 11; }
        else if (c.esNombre) { estilo = 'bold'; }
        else if (c.muted) { color = MUTED; tam = 8.5; }
        if (c.chico) tam = 7.5;
        if (esTotal && !c.esPos) estilo = 'bold';
        if (c.color) color = c.color(f) || color;
        doc.setFont('helvetica', estilo); doc.setFontSize(tam); doc.setTextColor(...color);
        const maxW = c.ancho - 4;
        const nL = lineas.length + (sub ? 1 : 0);
        const multi = nL > 1;
        let by = multi ? D.y + 4.6 : D.y + h / 2 + 1.3;
        lineas.forEach(l => { doc.text(doc.splitTextToSize(l, maxW)[0] || '', tx, by, { align: c.align || 'left' }); by += LH; });
        if (sub) {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUTED);
          doc.text(doc.splitTextToSize(sub, maxW)[0], tx, by - 0.4);
        }
        x += c.ancho;
      });
      D.y += h;
    });
  }

  function parrafo(D, texto, op = {}) {
    const { doc } = D;
    const tam = op.tam || 8.5;
    doc.setFont('helvetica', op.bold ? 'bold' : 'normal'); doc.setFontSize(tam); doc.setTextColor(...(op.color || MUTED));
    const lineas = doc.splitTextToSize(texto, ANCHO);
    const h = lineas.length * tam * 0.45 + 1;
    D.asegurar(h);
    doc.text(lineas, MX, D.y + 3);
    D.y += h + (op.despues ?? 2);
  }

  function titulo(D, texto, sub, op = {}) {
    const { doc } = D;
    D.asegurar(sub ? 14 : 10);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(op.tam || 13); doc.setTextColor(...INK);
    doc.text(texto, MX, D.y + 5);
    D.y += 7.5;
    if (sub) { doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MUTED); doc.text(sub, MX, D.y + 2.5); D.y += 5; }
    D.y += 1.5;
  }

  function banda(D, texto) {
    const { doc } = D;
    D.asegurar(16);
    D.y += 2;
    doc.setFillColor(...INK); doc.roundedRect(MX, D.y, 34, 8, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...WHITE); doc.setCharSpace(0.8);
    doc.text(texto.toUpperCase(), MX + 17, D.y + 5.5, { align: 'center' });
    doc.setCharSpace(0);
    D.y += 13;
  }

  /* =====================================================================
     SECCIÓN 1 — TABLA GENERAL
     ===================================================================== */
  function seccionGeneral(D, { temp, filas, eliminados = [], incluirAtenai = true, dAtenai = 0 }) {
    D.seccion('Tabla general');
    titulo(D, 'Posiciones de la temporada', incluirAtenai
      ? 'Clasificación oficial: incluye el descuento por Atenai.'
      : 'Puntaje SIN el descuento por Atenai. La clasificación oficial es la que lo incluye.');

    const desc = (r) => Number(r.atenai) * dAtenai;
    tabla(D, [
      { titulo: '#', ancho: 10, align: 'center', clave: 'posVista', esPos: true },
      { titulo: 'Competidor', ancho: 58, clave: 'competidor', esNombre: true, sub: (r) => r.dojo || '' },
      { titulo: 'Fechas', ancho: 15, align: 'right', clave: 'fechas_asistidas' },
      { titulo: 'Asist.', ancho: 15, align: 'right', render: (r) => num(r.pts_asistencia) },
      { titulo: 'Kata', ancho: 15, align: 'right', render: (r) => num(r.pts_kata) },
      { titulo: 'Kumite', ancho: 17, align: 'right', render: (r) => num(r.pts_kumite) },
      { titulo: 'Ippones', ancho: 17, align: 'right', render: (r) => num(r.ippones) },
      { titulo: 'Atenai', ancho: 16, align: 'right', render: (r) => desc(r) ? '-' + num(desc(r)) : '—',
        color: (r) => desc(r) ? (incluirAtenai ? AKA : MUTED) : MUTED },
      { titulo: 'Total', ancho: 19, align: 'right', render: (r) => num(r.totalVista), esTotal: true }
    ], filas.map(r => ({ ...r, posVista: r.posVista ?? r.posicion, totalVista: r.totalVista ?? r.total })), { posClave: 'posVista', filaAlto: 8.4 });

    D.y += 4;
    parrafo(D, `Puntaje: ${num(temp.pts_asistencia)} por asistir a cada fecha · 1º ${num(temp.pts_primero)}, 2º ${num(temp.pts_segundo)} y 3º ${num(temp.pts_tercero)} en Kata y Kumite · -${num(dAtenai)} por cada Atenai.`);
    parrafo(D, 'Desempate: más Ippones directos en la liga; luego menos faltas (Atenai + Kinshi). Si persiste, es empate técnico.');

    if (eliminados.length) {
      D.y += 4;
      titulo(D, 'Fuera de la temporada', 'Hansoku: el competidor pierde la temporada.');
      tabla(D, [
        { titulo: 'Competidor', ancho: 100, clave: 'competidor', esNombre: true, sub: (r) => r.dojo || '' },
        { titulo: 'Fechas', ancho: 20, align: 'right', clave: 'fechas_asistidas' },
        { titulo: 'Motivo', ancho: 62, muted: true, render: () => 'Hansoku' }
      ], eliminados);
    }
  }

  /* =====================================================================
     SECCIÓN 2 — POSICIONES POR CATEGORÍA
     ===================================================================== */
  function seccionCategorias(D, { temp, porCat, fechasJugadas }) {
    D.seccion('Posiciones por categoría');
    parrafo(D, `Posiciones de la temporada dentro de cada categoría. Puntos: solo los del podio en esa categoría (1º ${num(temp.pts_primero)}, 2º ${num(temp.pts_segundo)}, 3º ${num(temp.pts_tercero)}). En cada fecha: 1º/2º/3º = lugar obtenido · "part." = participó sin podio · "—" = no participó.`, { despues: 4 });

    const anchoF = Math.min(13, (ANCHO - 10 - 18 - 60) / Math.max(1, fechasJugadas.length));
    const anchoNombre = ANCHO - 10 - 18 - anchoF * fechasJugadas.length;
    const lugarTxt = (l, jugo) => !jugo ? '—' : l ? ord(l) : 'part.';

    ['Kata', 'Kumite'].forEach(m => {
      const cats = [...new Set(porCat.filter(r => r.modalidad === m).map(r => r.categoria))];
      if (!cats.length) return;
      banda(D, m);
      cats.forEach(c => {
        const filas = porCat.filter(r => r.modalidad === m && r.categoria === c);
        const cont = {}; filas.forEach(r => cont[r.posicion] = (cont[r.posicion] || 0) + 1);
        D.asegurar(12 + 7 + 8 * Math.min(filas.length, 4));   // mantener junta si cabe
        titulo(D, c, `${filas.length} competidor${filas.length === 1 ? '' : 'es'} en la temporada`);
        tabla(D, [
          { titulo: '#', ancho: 10, align: 'center', clave: 'posicion', esPos: true },
          { titulo: 'Competidor', ancho: anchoNombre, clave: 'competidor', esNombre: true,
            sub: (r) => [r.dojo, cont[r.posicion] > 1 ? 'Empate' : ''].filter(Boolean).join(' · ') },
          ...fechasJugadas.map(n => ({ titulo: `F${n}`, ancho: anchoF, align: 'center',
            render: (r) => lugarTxt(r.lugares[n], n in r.lugares),
            color: (r) => !(n in r.lugares) ? LINE : POS_COLOR[r.lugares[n]] || MUTED })),
          { titulo: 'Pts', ancho: 18, align: 'right', render: (r) => num(r.puntos), esTotal: true }
        ], filas, { posClave: 'posicion', filaAlto: 8 });
        D.y += 5;
      });
    });
  }

  /* =====================================================================
     SECCIÓN 3 — RENDIMIENTO POR COMPETIDOR
     rendimiento: v_rendimiento (una fila por competidor y fecha)
     filas: tabla general (para orden, posición y total)
     ===================================================================== */
  function seccionRendimiento(D, { temp, filas, eliminados = [], rendimiento, fechasJugadas, dAtenai = 0 }) {
    D.seccion('Rendimiento por competidor');
    parrafo(D, 'Detalle fecha a fecha de cada competidor: categorías en que compitió y lugar obtenido, puntos de asistencia, Kata y Kumite, ippones y faltas, mejor puntaje de Kata y combates ganados. Los competidores van en el orden de la tabla general.', { despues: 4 });

    const todos = [...filas.map(r => ({ ...r, posVista: r.posVista ?? r.posicion, totalVista: r.totalVista ?? r.total })),
                   ...eliminados.map(r => ({ ...r, posVista: null, totalVista: r.total }))];
    const porComp = {};
    rendimiento.forEach(r => (porComp[r.competidor_id] = porComp[r.competidor_id] || []).push(r));

    todos.forEach((c, idx) => {
      const fs = (porComp[c.competidor_id] || []).sort((a, b) => a.fecha_numero - b.fecha_numero);
      const sum = (k) => fs.reduce((s, r) => s + Number(r[k] || 0), 0);
      const oros = fs.reduce((s, r) => s + r.categorias.filter(x => x.lugar === 1).length, 0);
      const podios = fs.reduce((s, r) => s + r.categorias.filter(x => x.lugar && x.lugar <= 3).length, 0);
      const mejorKata = Math.max(0, ...fs.map(r => Number(r.mejor_kata || 0)));
      const combates = sum('combates'), ganados = sum('ganados');
      const durs = fs.filter(r => r.duracion_prom).map(r => Number(r.duracion_prom));
      const durProm = durs.length ? durs.reduce((a, b) => a + b, 0) / durs.length : 0;

      // Bloque del competidor: mantenerlo junto si cabe (título + kpi + cabecera + filas + total)
      D.asegurar(10 + 6 + 7 + fs.length * 10.5 + 8 + 4);
      const { doc } = D;
      // Título con posición
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...(POS_COLOR[c.posVista] || INK));
      const posTxt = c.posVista ? `${c.posVista}` : '—';
      doc.text(posTxt, MX, D.y + 5);
      doc.setTextColor(...INK); doc.text(c.competidor, MX + 10, D.y + 5);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(`${num(c.totalVista)} pts`, PW - MX, D.y + 5, { align: 'right' });
      D.y += 7.5;
      const meta = [c.dojo, `${fs.length} fecha${fs.length === 1 ? '' : 's'}`,
        c.eliminado ? 'Fuera de la temporada (Hansoku)' : (c.posVista ? `${ord(c.posVista)} en la tabla general` : '')].filter(Boolean).join(' · ');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MUTED); doc.text(meta, MX + 10, D.y + 2.5);
      D.y += 5;
      const kpi = [
        `${podios} podio${podios === 1 ? '' : 's'}${oros ? ` (${oros} oro${oros === 1 ? '' : 's'})` : ''}`,
        mejorKata ? `mejor Kata ${num(mejorKata)}` : '',
        combates ? `Kumite ${ganados}/${combates} combates ganados` : '',
        durProm ? `duración media ${mmss(durProm)}` : '',
        `${sum('ippones')} ippon${sum('ippones') === 1 ? '' : 'es'}`,
        `${sum('atenai')} atenai`, `${sum('kinshi')} kinshi`
      ].filter(Boolean).join(' · ');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...INK); doc.text(doc.splitTextToSize(kpi, ANCHO - 10)[0], MX + 10, D.y + 2.5);
      D.y += 6;

      const catTxt = (x) => `${x.modalidad} · ${x.categoria}${x.lugar ? ` — ${ord(x.lugar)}` : ' — part.'}${x.rivales ? ` de ${x.rivales}` : ''}`;
      const filasT = fs.map(r => ({ ...r, esFila: true }));
      filasT.push({ total: true, pts_asistencia: sum('pts_asistencia'), pts_kata: sum('pts_kata'), pts_kumite: sum('pts_kumite'),
        ippones: sum('ippones'), atenai: sum('atenai'), kinshi: sum('kinshi'), puntos: sum('puntos') });
      tabla(D, [
        { titulo: 'Fecha', ancho: 16, render: (r) => r.total ? 'Total' : `F${r.fecha_numero}`, esNombre: true },
        { titulo: 'Categorías y lugar', ancho: 74, chico: true, render: (r) => r.total ? '' : (r.categorias.length ? r.categorias.map(catTxt) : ['—']),
          color: () => MUTED },
        { titulo: 'Kata', ancho: 14, align: 'right', render: (r) => r.total ? num(r.pts_kata) : (r.mejor_kata ? `${num(r.pts_kata)}` : num(r.pts_kata)) },
        { titulo: 'Pje. Kata', ancho: 18, align: 'right', muted: true, render: (r) => r.total ? '' : (r.mejor_kata ? num(r.mejor_kata) : '—') },
        { titulo: 'Kumite', ancho: 16, align: 'right', render: (r) => num(r.pts_kumite) },
        { titulo: 'Ippon', ancho: 13, align: 'right', render: (r) => num(r.ippones) },
        { titulo: 'Atenai', ancho: 14, align: 'right', render: (r) => Number(r.atenai) ? num(r.atenai) : '—', color: (r) => Number(r.atenai) ? AKA : MUTED },
        { titulo: 'Pts', ancho: 17, align: 'right', render: (r) => num(r.puntos), esTotal: true }
      ], filasT, { filaAlto: 7.6, totalFila: filasT.length - 1 });
      D.y += 6;
    });
  }

  /* =====================================================================
     INFORME COMPLETO
     ===================================================================== */
  async function informe(op) {
    await cargarJsPDF();
    const sec = Object.assign({ general: true, categorias: true, rendimiento: true }, op.secciones || {});
    const partes = [sec.general && 'Tabla general', sec.categorias && 'Por categoría', sec.rendimiento && 'Rendimiento por competidor'].filter(Boolean);
    if (!partes.length) throw new Error('Elige al menos una sección para el PDF.');
    const soloUna = partes.length === 1;
    const tituloDoc = soloUna ? partes[0] : 'Informe de la temporada';
    const D = new Documento(op.temp, tituloDoc, `${op.disputadas} de ${op.temp.n_fechas} fechas disputadas`);

    if (sec.general) seccionGeneral(D, op);
    if (sec.categorias) seccionCategorias(D, op);
    if (sec.rendimiento) seccionRendimiento(D, op);

    const doc = D.terminar();
    const nombre = `${slug(op.temp.nombre)}_${soloUna ? slug(partes[0]) : 'Informe'}.pdf`;
    const blob = doc.output('blob');
    return { blob, nombre, file: new File([blob], nombre, { type: 'application/pdf' }), paginas: doc.getNumberOfPages() };
  }

  window.TablaPDF = { informe };
})();
