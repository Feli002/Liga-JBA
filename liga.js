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

const sb = supabase.createClient(LIGA.url, LIGA.key);

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
      err.textContent = 'Tu cuenta no tiene permisos de mesa. Pide al administrador que te los asigne.';
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
