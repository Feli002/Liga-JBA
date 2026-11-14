/* =====================================================================
   Liga de Karate WUKF — Tabla general y posiciones por categoría en PDF
   Documentos A4 verticales, con texto real (se puede buscar e imprimir),
   generados en el navegador con jsPDF a partir de los datos ya cargados
   en tabla-general.html.
   Uso: TablaPDF.general({...})  ·  TablaPDF.categorias({...})
   Ambas devuelven { blob, nombre, file } para entregar con HojaResultados.entregar.
   ===================================================================== */
(function () {
  const LIBS = [
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
  ];

  // Paleta del sitio
  const INK = [28, 35, 32], GOLD = [201, 138, 46], MUTED = [103, 108, 102], LINE = [220, 214, 200],
        SOFT = [245, 242, 234], SILVER = [143, 149, 155], BRONZE = [176, 108, 59], AKA = [200, 38, 44], WHITE = [255, 255, 255];
  const POS_COLOR = { 1: GOLD, 2: SILVER, 3: BRONZE };

  // A4 en mm
  const PW = 210, PH = 297, MX = 14, TOP = 40, BOTTOM = 16;

  const num = (n) => Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 2 });
  const hoy = () => new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
  const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');

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
    let y = TOP;

    const cabecera = () => {
      doc.setFillColor(...INK); doc.rect(0, 0, PW, 30, 'F');
      doc.setFillColor(...GOLD); doc.rect(0, 30, PW, 1.2, 'F');
      doc.setTextColor(...GOLD); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setCharSpace(0.6);
      doc.text('LIGA DE KARATE WUKF', MX, 11);
      doc.setCharSpace(0);
      doc.setTextColor(...WHITE); doc.setFontSize(20); doc.text(titulo, MX, 21);
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
      terminar() { pie(); return doc; }
    };
  }

  /* ---------- Tabla genérica con cabecera repetida en cada página ----------
     cols: [{ titulo, ancho, align:'left'|'right'|'center', clave | render(fila) }]
     filas: objetos; opciones: { posClave, filaAlto, antesDe(fila) -> texto secundario } */
  function tabla(D, cols, filas, op = {}) {
    const { doc } = D;
    const alto = op.filaAlto || 7.6, hAlto = 7;
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

    D.asegurar(hAlto + alto * 2);
    cabeceraTabla();
    const colNombre = cols.find(c => c.esNombre && c.sub);
    filas.forEach((f, i) => {
      const sub = colNombre ? (colNombre.sub(f) || '') : '';
      const h = sub ? alto + 3 : alto;          // fila más alta si lleva texto secundario
      if (D.asegurar(h)) cabeceraTabla();
      const pos = op.posClave ? Number(f[op.posClave]) : 0;
      if (i % 2) { doc.setFillColor(252, 251, 248); doc.rect(x0, D.y, anchoTotal, h, 'F'); }
      doc.setDrawColor(...LINE); doc.setLineWidth(0.15); doc.line(x0, D.y + h, x0 + anchoTotal, D.y + h);
      let x = x0;
      cols.forEach(c => {
        const v = c.render ? c.render(f) : f[c.clave];
        const txt = v == null ? '' : String(v);
        const tx = c.align === 'right' ? x + c.ancho - 2 : c.align === 'center' ? x + c.ancho / 2 : x + 2;
        let color = INK, estilo = 'normal', tam = 9.5;
        if (c.esPos) { estilo = 'bold'; tam = 11; color = POS_COLOR[pos] || INK; }
        else if (c.esTotal) { estilo = 'bold'; tam = 11; }
        else if (c.esNombre) { estilo = 'bold'; }
        else if (c.muted) { color = MUTED; tam = 8.5; }
        if (c.color) color = c.color(f) || color;
        doc.setFont('helvetica', estilo); doc.setFontSize(tam); doc.setTextColor(...color);
        const maxW = c.ancho - 4;
        const by = (c.esNombre && sub) ? D.y + 4.9 : D.y + h / 2 + 1.3;
        doc.text(doc.splitTextToSize(txt, maxW)[0] || '', tx, by, { align: c.align || 'left' });
        if (c.esNombre && sub) {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUTED);
          doc.text(doc.splitTextToSize(sub, maxW)[0], tx, D.y + h - 2.4);
        }
        x += c.ancho;
      });
      D.y += h;
    });
  }

  function parrafo(D, texto, op = {}) {
    const { doc } = D;
    doc.setFont('helvetica', op.bold ? 'bold' : 'normal'); doc.setFontSize(op.tam || 8.5); doc.setTextColor(...(op.color || MUTED));
    const lineas = doc.splitTextToSize(texto, PW - MX * 2);
    const h = lineas.length * (op.tam || 8.5) * 0.45 + 1;
    D.asegurar(h);
    doc.text(lineas, MX, D.y + 3);
    D.y += h + (op.despues ?? 2);
  }

  function titulo(D, texto, sub) {
    const { doc } = D;
    D.asegurar(sub ? 14 : 10);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...INK);
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

  const empaquetar = (doc, nombre) => {
    const blob = doc.output('blob');
    return { blob, nombre, file: new File([blob], nombre, { type: 'application/pdf' }) };
  };

  /* =====================================================================
     TABLA GENERAL
     filas: v_tabla_general (activos) con posVista/totalVista ya calculados
     ===================================================================== */
  async function general({ temp, filas, eliminados = [], disputadas, incluirAtenai = true, dAtenai = 0 }) {
    await cargarJsPDF();
    const sub = `${disputadas} de ${temp.n_fechas} fechas disputadas`;
    const D = new Documento(temp, 'Tabla general', sub);

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

    return empaquetar(D.terminar(), `${slug(temp.nombre)}_Tabla-general.pdf`);
  }

  /* =====================================================================
     POSICIONES POR CATEGORÍA
     porCat: v_tabla_categoria; fechasJugadas: números de fecha con podios
     ===================================================================== */
  async function categorias({ temp, porCat, fechasJugadas, disputadas }) {
    await cargarJsPDF();
    const sub = `${disputadas} de ${temp.n_fechas} fechas disputadas`;
    const D = new Documento(temp, 'Posiciones por categoría', sub);

    parrafo(D, `Posiciones de la temporada dentro de cada categoría. Puntos: solo los del podio en esa categoría (1º ${num(temp.pts_primero)}, 2º ${num(temp.pts_segundo)}, 3º ${num(temp.pts_tercero)}). En cada fecha: 1º/2º/3º = lugar obtenido · "part." = participó sin podio · "—" = no participó.`, { despues: 4 });

    const anchoF = Math.min(13, (PW - MX * 2 - 10 - 18 - 60) / Math.max(1, fechasJugadas.length));
    const anchoNombre = PW - MX * 2 - 10 - 18 - anchoF * fechasJugadas.length;
    const lugarTxt = (l, jugo) => !jugo ? '—' : l ? `${l}º` : 'part.';

    ['Kata', 'Kumite'].forEach(m => {
      const cats = [...new Set(porCat.filter(r => r.modalidad === m).map(r => r.categoria))];
      if (!cats.length) return;
      banda(D, m);
      cats.forEach(c => {
        const filas = porCat.filter(r => r.modalidad === m && r.categoria === c);
        const cont = {}; filas.forEach(r => cont[r.posicion] = (cont[r.posicion] || 0) + 1);
        // Mantener junta la categoría si cabe: título + cabecera + hasta 4 filas
        D.asegurar(12 + 7 + 7.6 * Math.min(filas.length, 4));
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

    return empaquetar(D.terminar(), `${slug(temp.nombre)}_Por-categoria.pdf`);
  }

  window.TablaPDF = { general, categorias };
})();
