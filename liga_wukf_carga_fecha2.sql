-- =====================================================================
-- Liga de Karate WUKF — Carga de la Fecha 2 (12-09-2026)
-- Fuente: borrador del sensei. Pendiente verificar con el registro físico.
-- Ejecutar UNA sola vez en Supabase > SQL Editor > New query > Run.
-- Si algo falla, no se guarda nada (todo va en una transacción).
-- =====================================================================

begin;

-- Ayudantes temporales para buscar por nombre (desaparecen al terminar)
create function pg_temp.comp(n text) returns bigint language sql as $$
  select id from public.competidores where nombre || ' ' || apellido = n
$$;
create function pg_temp.cat(n text) returns bigint language sql as $$
  select c.id from public.categorias c
  join public.fechas f on f.id = c.fecha_id
  join public.temporadas t on t.id = f.temporada_id
  where t.anio = 2026 and f.numero = 2 and c.nombre = n
$$;
create function pg_temp.ins(categoria text, competidor text) returns bigint language sql as $$
  select id from public.inscripciones
  where categoria_id = pg_temp.cat(categoria) and competidor_id = pg_temp.comp(competidor)
$$;

-- Fecha 2
update fechas set dia = date '2026-09-12',
  observaciones = 'Resultados en revisión: se verificarán con el registro físico'
where numero = 2 and temporada_id = (select id from temporadas where anio = 2026);

-- Competidores (grado: 1 = 10º kyu ... 10 = 1º kyu)
insert into competidores (nombre, apellido, sexo, grado_actual, observaciones) values
  ('Sebastián', 'Iturbe',  'Masculino', 3,  'Falta fecha de nacimiento'),
  ('Felipe',    'Ossio',   'Masculino', 3,  'Falta fecha de nacimiento'),
  ('Felipe',    'Cabrera', 'Masculino', 9,  'Falta fecha de nacimiento'),
  ('Rodrigo',   'Meier',   'Masculino', 8,  'Falta fecha de nacimiento'),
  ('Bruno',     'Macias',  'Masculino', 10, 'Falta fecha de nacimiento'),
  ('Constanza', 'Macias',  'Femenino',  8,  'Falta fecha de nacimiento'),
  ('Trinidad',  'Lamas',   'Femenino',  9,  'Falta fecha de nacimiento'),
  ('Rafaela',   'Oliveti', 'Femenino',  7,  'Falta fecha de nacimiento');

-- Categorías usadas en la Fecha 2 (según el borrador)
insert into categorias (fecha_id, modalidad, nombre, sexo, edad_min, edad_max, grado_min, grado_max, n_jueces, observaciones)
select f.id, v.modalidad, v.nombre, v.sexo, v.edad_min, v.edad_max, v.grado_min, v.grado_max, v.n_jueces, v.obs
from fechas f
join temporadas t on t.id = f.temporada_id and t.anio = 2026 and f.numero = 2
cross join (values
  ('Kata',   'Kata Adultos de 8º kyu hasta 1º kyu',   null::text, null::smallint, null::smallint, 3::smallint, 10::smallint, 3::smallint,    'Dice Adultos, pero compitió Bruno Macias (13 años)'),
  ('Kata',   '10 a 12 años de 4º kyu hasta 1º kyu',   null,       10,             12,             7,           10,           null,           'Sin resultados en el borrador'),
  ('Kumite', 'Kumite Adultos de 8º kyu hasta 1º kyu', null,       null,           null,           3,           10,           null,           'Dice Adultos, pero compitió Bruno Macias (13 años)'),
  ('Kumite', '11 a 12 años de 3º kyu hasta 1º kyu',   null,       11,             12,             8,           10,           null,           'Sin resultados en el borrador'),
  ('Kumite', '8 a 10 años de 8º kyu hasta 6º kyu',    null,       8,              10,             3,           5,            null,           'Rafaela es 4º kyu y no calza. Sin resultados en el borrador')
) as v(modalidad, nombre, sexo, edad_min, edad_max, grado_min, grado_max, n_jueces, obs);

-- Inscripciones (edad según el borrador; lugar 1-3 o vacío)
insert into inscripciones (categoria_id, competidor_id, edad, lugar, observaciones) values
  (pg_temp.cat('Kata Adultos de 8º kyu hasta 1º kyu'), pg_temp.comp('Felipe Cabrera'),   40, 1,    'Ganó el kata extra de desempate'),
  (pg_temp.cat('Kata Adultos de 8º kyu hasta 1º kyu'), pg_temp.comp('Bruno Macias'),     13, 2,    'Perdió el kata extra de desempate'),
  (pg_temp.cat('Kata Adultos de 8º kyu hasta 1º kyu'), pg_temp.comp('Sebastián Iturbe'), 42, 3,    '3º según notas (el borrador decía 4º). Verificar'),
  (pg_temp.cat('Kata Adultos de 8º kyu hasta 1º kyu'), pg_temp.comp('Felipe Ossio'),     43, null, '4º según notas (el borrador decía 5º). Verificar'),
  (pg_temp.cat('Kata Adultos de 8º kyu hasta 1º kyu'), pg_temp.comp('Rodrigo Meier'),    44, null, '5º según notas (el borrador decía 3º). Verificar nota 7,0 del juez 2'),

  (pg_temp.cat('Kumite Adultos de 8º kyu hasta 1º kyu'), pg_temp.comp('Rodrigo Meier'),    44, 1,    null),
  (pg_temp.cat('Kumite Adultos de 8º kyu hasta 1º kyu'), pg_temp.comp('Bruno Macias'),     13, 2,    null),
  (pg_temp.cat('Kumite Adultos de 8º kyu hasta 1º kyu'), pg_temp.comp('Felipe Ossio'),     43, 3,    'Ganó la pelea por el 3er lugar'),
  (pg_temp.cat('Kumite Adultos de 8º kyu hasta 1º kyu'), pg_temp.comp('Felipe Cabrera'),   40, null, null),
  (pg_temp.cat('Kumite Adultos de 8º kyu hasta 1º kyu'), pg_temp.comp('Sebastián Iturbe'), 42, null, null),

  (pg_temp.cat('10 a 12 años de 4º kyu hasta 1º kyu'), pg_temp.comp('Constanza Macias'), 11, null, 'Sin resultados en el borrador'),
  (pg_temp.cat('10 a 12 años de 4º kyu hasta 1º kyu'), pg_temp.comp('Trinidad Lamas'),   11, null, 'Sin resultados en el borrador'),
  (pg_temp.cat('10 a 12 años de 4º kyu hasta 1º kyu'), pg_temp.comp('Rafaela Oliveti'),  10, null, 'Sin resultados en el borrador'),
  (pg_temp.cat('11 a 12 años de 3º kyu hasta 1º kyu'), pg_temp.comp('Constanza Macias'), 11, null, 'Sin resultados en el borrador'),
  (pg_temp.cat('11 a 12 años de 3º kyu hasta 1º kyu'), pg_temp.comp('Trinidad Lamas'),   11, null, 'Borrador decía "12 a 12 años"'),
  (pg_temp.cat('8 a 10 años de 8º kyu hasta 6º kyu'),  pg_temp.comp('Rafaela Oliveti'),  10, null, 'Sin resultados en el borrador');

-- Kata: notas de 3 jueces (el puntaje se calcula solo)
insert into kata_presentaciones (inscripcion_id, ronda, kata, n1, n2, n3, observaciones) values
  (pg_temp.ins('Kata Adultos de 8º kyu hasta 1º kyu', 'Sebastián Iturbe'), 'Principal', 'Heian Nidan', 7.9, 8.0, 8.1, null),
  (pg_temp.ins('Kata Adultos de 8º kyu hasta 1º kyu', 'Felipe Ossio'),     'Principal', 'Heian Nidan', 7.8, 7.9, 7.9, null),
  (pg_temp.ins('Kata Adultos de 8º kyu hasta 1º kyu', 'Felipe Cabrera'),   'Principal', 'Basai Dai',   8.2, 8.2, 8.1, 'Empate 24,5 con Bruno Macias'),
  (pg_temp.ins('Kata Adultos de 8º kyu hasta 1º kyu', 'Rodrigo Meier'),    'Principal', 'Basai Dai',   7.7, 7.0, 7.7, 'Verificar nota del juez 2'),
  (pg_temp.ins('Kata Adultos de 8º kyu hasta 1º kyu', 'Bruno Macias'),     'Principal', 'Kanku Sho',   8.2, 8.2, 8.1, 'Empate 24,5 con Felipe Cabrera'),
  (pg_temp.ins('Kata Adultos de 8º kyu hasta 1º kyu', 'Felipe Cabrera'),   'Extra',     'Heian Godan', 7.5, 7.5, 7.5, 'Kata extra de desempate'),
  (pg_temp.ins('Kata Adultos de 8º kyu hasta 1º kyu', 'Bruno Macias'),     'Extra',     'Jion',        7.3, 7.3, 7.5, 'Kata extra de desempate');

-- Kumite: llave de la categoría Adultos (puntos y faltas pendientes del registro físico)
insert into kumite_combates (categoria_id, orden, ronda, aka_id, shiro_id, ganador, observaciones)
select pg_temp.cat('Kumite Adultos de 8º kyu hasta 1º kyu'), v.orden, v.ronda,
       pg_temp.comp(v.aka), pg_temp.comp(v.shiro), v.ganador,
       'Puntos y faltas pendientes del registro físico'
from (values
  (1, 'Primera ronda', 'Rodrigo Meier',    'Felipe Ossio',   'Aka'),
  (2, 'Primera ronda', 'Sebastián Iturbe', 'Felipe Cabrera', 'Shiro'),
  (3, 'Semifinal',     'Bruno Macias',     'Felipe Cabrera', 'Aka'),
  (4, 'Por 3er lugar', 'Felipe Cabrera',   'Felipe Ossio',   'Shiro'),
  (5, 'Final',         'Rodrigo Meier',    'Bruno Macias',   'Aka')
) as v(orden, ronda, aka, shiro, ganador);

commit;

-- Para revisar el resultado:
-- select * from v_tabla_general order by posicion;
