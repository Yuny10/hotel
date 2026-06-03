-- Ejecutar en Supabase SQL Editor si alguna columna no existe en public.incidencias

alter table public.incidencias
  add column if not exists accepted_at timestamptz,
  add column if not exists accepted_by text,
  add column if not exists hora_resolucion timestamptz,
  add column if not exists resolved_by text,
  add column if not exists tiempo_respuesta_min integer,
  add column if not exists tiempo_resolucion_min integer,
  add column if not exists tiempo_total integer,
  add column if not exists trabajador_nombre text;
