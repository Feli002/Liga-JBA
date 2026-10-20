/* =====================================================================
   Liga de Karate WUKF — Modo real / modo prueba
   Se carga ANTES que liga.js en todas las páginas.
   En modo prueba el sitio usa el esquema "prueba" de la base: una copia
   de la liga donde cualquier cuenta registrada puede usar la mesa sin
   tocar los resultados reales.
   Entrar:  index.html?modo=prueba   ·   Salir: index.html?modo=real
   ===================================================================== */
(function () {
  const CLAVE = 'liga-modo';
  const leer = () => { try { return localStorage.getItem(CLAVE); } catch (e) { return null; } };
  const guardar = (v) => { try { localStorage.setItem(CLAVE, v); } catch (e) {} };

  const pedido = new URLSearchParams(location.search).get('modo');
  if (pedido === 'prueba' || pedido === 'real') guardar(pedido);

  const modo = leer() === 'prueba' ? 'prueba' : 'real';
  window.LIGA_MODO = modo;
  window.LIGA_ESQUEMA = modo === 'prueba' ? 'prueba' : 'public';
  /* Cabeceras para llamadas directas a la API (fetch sin supabase-js) */
  window.LIGA_PERFIL = modo === 'prueba' ? { 'Accept-Profile': 'prueba', 'Content-Profile': 'prueba' } : {};
  /* Separa lo guardado en el navegador para que la prueba no se mezcle con la liga */
  window.ligaClave = (k) => (modo === 'prueba' ? 'prueba:' : '') + k;

  window.entrarModoPrueba = (destino = 'index.html') => { guardar('prueba'); location.href = destino; };
  window.salirModoPrueba = (destino = 'index.html') => { guardar('real'); location.href = destino; };

  if (modo !== 'prueba') return;

  const css = document.createElement('style');
  css.textContent = `
    .modo-prueba{ display:flex; align-items:center; justify-content:center; gap:10px 16px; flex-wrap:wrap;
      background:#c98a2e; color:#1c2320; font-family:Oswald,'Arial Narrow',sans-serif; font-size:1rem;
      padding:8px 16px; text-align:center; position:relative; z-index:1; line-height:1.3; }
    .modo-prueba b{ font-weight:700; letter-spacing:0.1em; text-transform:uppercase; }
    .modo-prueba button{ font:inherit; font-weight:600; font-size:0.875rem; letter-spacing:0.04em; color:#1c2320;
      background:rgba(255,255,255,0.35); border:1px solid rgba(28,35,32,0.35); border-radius:999px;
      padding:6px 12px; min-height:36px; cursor:pointer; }
    .modo-prueba button:hover{ background:rgba(255,255,255,0.6); }
    .modo-prueba button:focus-visible{ outline:2px solid #1c2320; outline-offset:2px; }
    body.proyeccion .modo-prueba{ display:none; }`;
  document.head.appendChild(css);

  const pintar = () => {
    if (document.querySelector('.modo-prueba')) return;
    const bar = document.createElement('div');
    bar.className = 'modo-prueba'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Modo prueba');
    bar.innerHTML = `<span><b>Modo prueba</b> · Lo que hagas aquí no cambia los resultados reales de la liga.</span>
      <span style="display:flex;gap:8px">
        <button type="button" data-restablecer>Restablecer datos</button>
        <button type="button" data-salir>Salir del modo prueba</button>
      </span>`;
    document.body.prepend(bar);
    bar.querySelector('[data-salir]').addEventListener('click', () => window.salirModoPrueba());
    const rest = bar.querySelector('[data-restablecer]');
    const cliente = () => (typeof sb !== 'undefined' ? sb : null);   // definido en liga.js
    window.addEventListener('load', () => { if (!cliente()) rest.hidden = true; });
    rest.addEventListener('click', async () => {
      if (!confirm('¿Restablecer el modo prueba? Se borra todo lo que se ha probado y se vuelve a copiar la liga real.')) return;
      rest.disabled = true; rest.textContent = 'Restableciendo…';
      const { error } = await cliente().rpc('restablecer');
      if (error) {
        rest.disabled = false; rest.textContent = 'Restablecer datos';
        alert(/Ingresa/.test(error.message) ? 'Ingresa con tu cuenta para restablecer el modo prueba.' : 'No se pudo restablecer: ' + error.message);
        return;
      }
      location.reload();
    });
  };
  if (document.body) pintar(); else document.addEventListener('DOMContentLoaded', pintar);
})();
