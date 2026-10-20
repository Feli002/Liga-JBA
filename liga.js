/* =====================================================================
   Liga de Karate WUKF — conexión compartida con Supabase
   Requiere cargar antes: @supabase/supabase-js (UMD)
   La clave publicable es pública por diseño; la seguridad la dan las
   reglas de la base (RLS) y el login.
   ===================================================================== */

const LIGA = {
  url: 'https://esycnxngndybogjlscjd.supabase.co',
  key: 'sb_publishable_9e6qqnmHHkYTwX1-HMH7XQ_iOmTQXUt'
};

/* Modo prueba (modo.js): mismo proyecto y mismas cuentas, otro esquema de datos */
const LIGA_ESQ = window.LIGA_ESQUEMA || 'public';
const sb = supabase.createClient(LIGA.url, LIGA.key, { db: { schema: LIGA_ESQ } });

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

const hora = (iso) => iso ? new Date(iso).toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' }) : '';

const diaLargo = (d) => d
  ? new Date(d + 'T12:00:00').toLocaleDateString('es-CL', { weekday:'long', day:'numeric', month:'long' })
  : '';

const duracion = (desde, hasta = new Date()) => {
  const min = Math.max(0, Math.round((new Date(hasta) - new Date(desde)) / 60000));
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
};

const hoyISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/* Traduce errores de Supabase a mensajes claros */
function mensajeError(error) {
  const m = (error && (error.message || error.error_description)) || '';
  if (/Invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/Email not confirmed/i.test(m)) return 'Tu correo aún no está confirmado.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Sin conexión con la base de datos. Revisa tu internet.';
  if (/permission denied/i.test(m)) return 'Tu cuenta no tiene permiso para hacer esto.';
  return m || 'Algo salió mal. Inténtalo otra vez.';
}

/* Sesión de staff (admin o mesa). Devuelve null si no hay sesión válida. */
async function sesionStaff() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  const { data: rol, error } = await sb.rpc('mi_rol');
  if (error || !['admin', 'mesa'].includes(rol)) return null;
  return { email: session.user.email, rol };
}

/* Formulario de login dentro de un contenedor. Llama a onOk(staff) al entrar. */
function formLogin(contenedor, onOk, { titulo = 'Ingresa como mesa', texto = 'Usa la cuenta de mesa o administrador. La sesión queda guardada en este dispositivo.', onCancel } = {}) {
  if (window.LIGA_MODO === 'prueba'){
    titulo = 'Ingresa con tu cuenta';
    texto = 'Estás en el modo prueba: usa la cuenta con la que te registraste. Nada de lo que hagas aquí cambia la liga real.';
  }
  contenedor.innerHTML = `
    <form class="login" novalidate>
      <h2 class="modal-title">${esc(titulo)}</h2>
      <p class="modal-text">${esc(texto)}</p>
      <label class="field"><span>Correo</span>
        <input type="email" name="email" autocomplete="username" required></label>
      <label class="field"><span>Contraseña</span>
        <input type="password" name="password" autocomplete="current-password" required></label>
      <p class="form-error" role="alert" hidden></p>
      <div class="actions">
        ${onCancel ? '<button type="button" class="btn ghost" data-cancel>Cancelar</button>' : ''}
        <button type="submit" class="btn primary">Ingresar</button>
      </div>
      <p class="modal-text" style="margin:16px 0 0;font-size:1rem">¿No tienes cuenta? <a href="registro.html" style="color:inherit">Regístrate para probar la plataforma</a>.</p>
    </form>`;
  const form = contenedor.querySelector('form');
  const err = form.querySelector('.form-error');
  const boton = form.querySelector('[type=submit]');
  if (onCancel) form.querySelector('[data-cancel]').addEventListener('click', onCancel);
  form.email.focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    if (!form.email.value || !form.password.value) {
      err.textContent = 'Ingresa tu correo y contraseña.'; err.hidden = false; return;
    }
    boton.disabled = true; boton.textContent = 'Ingresando…';
    const { error } = await sb.auth.signInWithPassword({
      email: form.email.value.trim(), password: form.password.value
    });
    if (error) {
      err.textContent = mensajeError(error); err.hidden = false;
      boton.disabled = false; boton.textContent = 'Ingresar'; return;
    }
    const staff = await sesionStaff();
    if (!staff) {
      await sb.auth.signOut();
      err.innerHTML = window.LIGA_MODO === 'prueba'
        ? 'No pudimos validar tu cuenta. Inténtalo otra vez.'
        : 'Tu cuenta aún no tiene permisos de mesa en la liga real. Puedes probar todas las funciones en el modo prueba. <button type="button" class="btn ghost" data-ir-prueba style="margin-top:10px;display:block">Ir al modo prueba</button>';
      err.querySelector('[data-ir-prueba]')?.addEventListener('click', () => window.entrarModoPrueba(location.pathname.split('/').pop() || 'index.html'));
      err.hidden = false; boton.disabled = false; boton.textContent = 'Ingresar'; return;
    }
    onOk(staff);
  });
}

/* ---------- Crear o editar una categoría de la fecha en curso ---------- */
function siguienteCodigo(numFecha, modalidad, categorias){
  const pref = `F${numFecha}-${modalidad === 'Kata' ? 'KT' : 'KM'}-`;
  const nums = categorias.map(c => c.codigo || '').filter(c => c.startsWith(pref)).map(c => parseInt(c.slice(pref.length), 10) || 0);
  return pref + String(Math.max(0, ...nums) + 1).padStart(2, '0');
}

function abrirModalCategoria({ fecha, modalidad, categorias, grados, categoria = null, onGuardado }){
  const bd = document.createElement('div');
  bd.className = 'modal-backdrop open'; bd.setAttribute('role', 'dialog'); bd.setAttribute('aria-modal', 'true');
  const gOpts = (sel) => '<option value="">Sin límite</option>' + grados.map(g => `<option value="${g.orden}" ${g.orden === sel ? 'selected' : ''}>${esc(g.nombre)}</option>`).join('');
  const c = categoria || {};
  bd.innerHTML = `
    <form class="modal wide" novalidate>
      <h2 class="modal-title">${categoria ? 'Editar categoría' : 'Crear categoría'}</h2>
      <p class="modal-text">${categoria
        ? 'Los cambios aplican a esta fecha y no cambian a los competidores ya inscritos.'
        : `Se crea en la Fecha ${esc(fecha.numero)}, modalidad ${esc(modalidad)}. Después marca o agrega a sus competidores.`}</p>
      <label class="field"><span>Nombre</span><input name="nombre" maxlength="100" value="${esc(c.nombre || '')}" placeholder="Ej: ${modalidad.toUpperCase()} MIXTO 7 A 8 AÑOS"></label>
      <label class="field"><span>Sexo</span><select name="sexo">${['Mixto', 'Femenino', 'Masculino'].map(s => `<option ${c.sexo === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <label class="field"><span>Edad mínima</span><input name="emin" type="number" min="3" max="99" inputmode="numeric" value="${c.edad_min ?? ''}" placeholder="Sin límite"></label>
        <label class="field"><span>Edad máxima</span><input name="emax" type="number" min="3" max="99" inputmode="numeric" value="${c.edad_max ?? ''}" placeholder="Sin límite"></label>
        <label class="field"><span>Grado desde</span><select name="gmin">${gOpts(c.grado_min)}</select></label>
        <label class="field"><span>Grado hasta</span><select name="gmax">${gOpts(c.grado_max)}</select></label>
      </div>
      ${modalidad === 'Kata' ? `<label class="field"><span>Jueces</span><select name="jueces"><option value="5" ${c.n_jueces !== 3 ? 'selected' : ''}>5 jueces</option><option value="3" ${c.n_jueces === 3 ? 'selected' : ''}>3 jueces</option></select></label>` : ''}
      <p class="form-error" role="alert" hidden></p>
      <div class="actions">
        <button type="button" class="btn ghost" data-cancel>Cancelar</button>
        <button type="submit" class="btn primary">${categoria ? 'Guardar cambios' : 'Crear categoría'}</button>
      </div>
    </form>`;
  document.body.appendChild(bd);
  const f = bd.querySelector('form'), err = f.querySelector('.form-error'), ok = f.querySelector('[type=submit]');
  const cerrar = () => bd.remove();
  f.querySelector('[data-cancel]').addEventListener('click', cerrar);
  bd.addEventListener('click', (e) => { if (e.target === bd) cerrar(); });
  f.nombre.focus();

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const num = (v) => v === '' ? null : Number(v);
    const fila = {
      nombre: f.nombre.value.trim().toUpperCase(), sexo: f.sexo.value,
      edad_min: num(f.emin.value), edad_max: num(f.emax.value),
      grado_min: num(f.gmin.value), grado_max: num(f.gmax.value)
    };
    if (modalidad === 'Kata') fila.n_jueces = Number(f.jueces.value);
    const falla = (t) => { err.textContent = t; err.hidden = false; };
    if (!fila.nombre) return falla('Escribe el nombre de la categoría.');
    if (fila.edad_min !== null && fila.edad_max !== null && fila.edad_min > fila.edad_max) return falla('La edad mínima no puede ser mayor que la máxima.');
    if (fila.grado_min !== null && fila.grado_max !== null && fila.grado_min > fila.grado_max) return falla('El grado "desde" debe ser menor o igual que el grado "hasta".');
    if (categorias.some(x => x.nombre === fila.nombre && x.id !== c.id)) return falla('Ya existe una categoría con ese nombre en esta fecha.');
    ok.disabled = true; err.hidden = true;
    const q = categoria
      ? sb.from('categorias').update(fila).eq('id', categoria.id)
      : sb.from('categorias').insert({ ...fila, fecha_id: fecha.id, modalidad, codigo: siguienteCodigo(fecha.numero, modalidad, categorias) });
    const { data, error } = await q.select('id, nombre, codigo, n_jueces, sexo, edad_min, edad_max, grado_min, grado_max').single();
    ok.disabled = false;
    if (error) return falla(mensajeError(error));
    cerrar();
    onGuardado(data);
  });
}

/* ---------- Agregar competidor: aviso de duplicados + inscribir también en la otra modalidad ----------
   Uso (en kata-flow y kumite-scoreboard):
     const extra = agregarExtra({ form, modalidad: 'Kata', fecha: () => fecha, cat: () => cat });
     extra.abrir();                              // al abrir el modal
     const r = extra.revisarDuplicado(n, a);     // antes de crear una ficha nueva: 'seguir' | 'esperar' | { usarId }
     const msg = await extra.inscribirOtra(id);  // después de inscribir en la categoría actual
*/
const normNombre = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

function agregarExtra({ form, modalidad, fecha, cat }){
  const otra = modalidad === 'Kata' ? 'Kumite' : 'Kata';
  if (!document.getElementById('agregar-extra-css')){
    const st = document.createElement('style'); st.id = 'agregar-extra-css';
    st.textContent = `
      .dup-aviso{ border-left:4px solid #c98a2e; background:rgba(201,138,46,0.14); border-radius:10px; padding:12px 14px; margin:0 0 14px; font-size:1rem; line-height:1.4; }
      .dup-aviso b{ font-weight:600; }
      .dup-aviso .dup-acc{ display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
      .dup-aviso button{ font-family:inherit; font-size:0.875rem; font-weight:600; letter-spacing:0.03em; border-radius:999px; padding:8px 12px; min-height:36px; cursor:pointer; border:1px solid currentColor; background:transparent; color:inherit; }
      .dup-aviso button.si{ background:#c98a2e; border-color:#c98a2e; color:#1c2320; }
      .otra-mod{ border:1px dashed rgba(127,127,127,0.5); border-radius:12px; padding:12px 14px; margin:0 0 14px; }
      .otra-mod .chk{ display:flex; align-items:center; gap:10px; font-size:1.125rem; cursor:pointer; }
      .otra-mod .chk input{ width:20px; height:20px; accent-color:#c98a2e; flex:none; }
      .otra-mod .field{ margin:12px 0 0; }
      .otra-mod .nota{ font-size:0.875rem; margin:8px 0 0; line-height:1.4; opacity:0.85; }
      .otra-mod .nota.pasada{ opacity:1; border-left:4px solid #c98a2e; padding-left:10px; }`;
    document.head.appendChild(st);
  }
  const caja = document.createElement('div');
  caja.innerHTML = `
    <div class="dup-aviso" hidden></div>
    <div class="otra-mod">
      <label class="chk"><input type="checkbox" name="otraMod"> ¿Inscribirlo también en ${otra}?</label>
      <div class="otra-detalle" hidden>
        <label class="field"><span>Categoría de ${otra}</span><select name="otraCat"></select></label>
        <p class="nota"></p>
      </div>
    </div>`;
  const errEl = form.querySelector('.form-error');
  errEl.before(...caja.children);
  const aviso = form.querySelector('.dup-aviso'), chk = form.otraMod, det = form.querySelector('.otra-detalle'),
        sel = form.otraCat, nota = form.querySelector('.otra-mod .nota');
  let catsOtra = [], todos = [], decision = null;   // decision: null | 'nuevo' (confirmó que es otra persona)

  const pintarNota = () => {
    const c = catsOtra.find(x => String(x.id) === sel.value);
    nota.className = 'nota' + (c && c.pasada ? ' pasada' : '');
    nota.textContent = !c ? '' : c.pasada
      ? `Esta categoría ya se compitió${modalidad === 'Kata' ? ' (hay combates guardados)' : ' (ya tiene notas)'}. Igual queda inscrito y presente, pero no entra ${otra === 'Kumite' ? 'a la llave ni al podio ya jugados' : 'al orden ni al podio ya cerrados'}: avisa a la mesa de ${otra}.`
      : `Queda inscrito y presente en ${otra}; la mesa de ${otra} lo verá en su nómina.`;
  };
  chk.addEventListener('change', () => { det.hidden = !chk.checked; pintarNota(); });
  sel.addEventListener('change', pintarNota);

  async function abrir(){
    aviso.hidden = true; decision = null; chk.checked = false; det.hidden = true;
    sel.innerHTML = '<option value="">Cargando…</option>';
    const f = fecha(), c = cat();
    const [{ data: cs }, { data: comps }] = await Promise.all([
      sb.from('categorias').select('id, nombre, codigo').eq('fecha_id', f.id).eq('modalidad', otra).order('codigo'),
      sb.from('competidores').select('id, nombre, apellido').eq('activo', true)
    ]);
    todos = comps || [];
    catsOtra = cs || [];
    const ids = catsOtra.map(x => x.id);
    if (ids.length){
      const [{ data: ins }, { data: comb }] = await Promise.all([
        sb.from('inscripciones').select('id, categoria_id, lugar').in('categoria_id', ids),
        otra === 'Kumite' ? sb.from('kumite_combates').select('categoria_id').in('categoria_id', ids) : Promise.resolve({ data: [] })
      ]);
      let conNotas = new Set();
      if (otra === 'Kata' && ins && ins.length){
        const { data: kp } = await sb.from('kata_presentaciones').select('inscripcion_id').in('inscripcion_id', ins.map(i => i.id));
        const insCat = new Map(ins.map(i => [i.id, i.categoria_id]));
        conNotas = new Set((kp || []).map(k => insCat.get(k.inscripcion_id)));
      }
      const conLugar = new Set((ins || []).filter(i => i.lugar != null).map(i => i.categoria_id));
      const conComb = new Set((comb || []).map(k => k.categoria_id));
      catsOtra.forEach(x => x.pasada = conLugar.has(x.id) || conComb.has(x.id) || conNotas.has(x.id));
    }
    // Sugerencia: la categoría "gemela" (mismo nombre cambiando KATA ↔ KUMITE)
    // edad ("3 a 4 años", "7 años", "adulto") y sexo deciden la categoría sugerida
    const perfil = (n) => { const t = normNombre(n);
      const edad = /adulto/.test(t) ? 'adulto' : ((t.match(/(\d+)(?:\s+a\s+(\d+))?\s+anos/) || []).slice(1).filter(Boolean).join('-'));
      const sexo = (t.match(/masculino|femenino|mixto/) || [''])[0]; return { edad, sexo }; };
    const base = c ? perfil(c.nombre) : null;
    let sug = null, mejor = 0;
    if (base && base.edad) catsOtra.forEach(x => { const p = perfil(x.nombre); if (p.edad !== base.edad) return;
      const pts = 10 + (p.sexo === base.sexo ? 2 : (!p.sexo || !base.sexo || p.sexo === 'mixto' || base.sexo === 'mixto') ? 1 : -20);
      if (pts > mejor){ mejor = pts; sug = x; } });
    sel.innerHTML = catsOtra.length
      ? (sug ? '' : '<option value="">Elige la categoría</option>') + catsOtra.map(x => `<option value="${x.id}" ${sug && sug.id === x.id ? 'selected' : ''}>${esc(x.nombre)}${x.pasada ? ' · ya se compitió' : ''}</option>`).join('')
      : `<option value="">No hay categorías de ${otra} en esta fecha</option>`;
    chk.disabled = !catsOtra.length;
    pintarNota();
  }

  /* Antes de crear una ficha nueva: ¿ya existe alguien con ese nombre? */
  function revisarDuplicado(nombre, apellido){
    if (decision === 'nuevo') return 'seguir';
    const clave = normNombre(`${nombre} ${apellido}`);
    const iguales = todos.filter(p => normNombre(`${p.nombre} ${p.apellido}`) === clave);
    if (!iguales.length) return 'seguir';
    const p = iguales[0];
    return new Promise((ok) => {
      aviso.hidden = false;
      aviso.innerHTML = `Ya existe <b>${esc(p.nombre)} ${esc(p.apellido)}</b> en la nómina${iguales.length > 1 ? ` (${iguales.length} fichas)` : ''}. ¿Es la misma persona?
        <div class="dup-acc"><button type="button" class="si">Sí, usar esa ficha</button><button type="button" class="no">No, es otra persona</button></div>`;
      aviso.querySelector('.si').addEventListener('click', () => { aviso.hidden = true; ok({ usarId: p.id }); });
      aviso.querySelector('.no').addEventListener('click', () => { aviso.hidden = true; decision = 'nuevo'; ok('seguir'); });
      aviso.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  /* Después de inscribir en la categoría actual */
  async function inscribirOtra(compId){
    if (!chk.checked || !sel.value) return '';
    const catId = Number(sel.value), c = catsOtra.find(x => x.id === catId);
    const { data: ya } = await sb.from('inscripciones').select('id, presente').eq('categoria_id', catId).eq('competidor_id', compId).maybeSingle();
    if (ya){
      if (!ya.presente) await sb.from('inscripciones').update({ presente: true }).eq('id', ya.id);
      return ` y ya estaba en ${otra} (${c ? c.nombre : ''})`;
    }
    const { error } = await sb.from('inscripciones').insert({ categoria_id: catId, competidor_id: compId, presente: true });
    if (error) return `, pero no se pudo inscribir en ${otra}: ${mensajeError(error)}`;
    return ` y en ${otra}${c && c.pasada ? ' (categoría ya competida: avisa a la mesa)' : ''}`;
  }

  return { abrir, revisarDuplicado, inscribirOtra };
}
