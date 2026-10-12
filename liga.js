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
