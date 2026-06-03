-- Demo limpia: vacía incidencias y reinicia INC-0001 (id numérico / serial).
-- Ejecutar en Supabase → SQL Editor (proyecto hotel-connect-v2).

TRUNCATE TABLE public.incidencias RESTART IDENTITY;

-- Verificación:
-- SELECT COUNT(*) FROM public.incidencias;  -- debe ser 0
