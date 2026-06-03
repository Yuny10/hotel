-- Demo limpia: vacía incidencias y reinicia la secuencia del id (INC-0001).
-- Ejecutar en Supabase → SQL Editor si prefieres SQL en lugar de la API REST.

TRUNCATE TABLE public.incidencias RESTART IDENTITY;

-- Equivalente ejecutado por API REST (2026-06-03):
-- DELETE FROM public.incidencias WHERE id >= 0;
-- La app asigna id = MAX(id)+1 al crear desde QR (primera fila → id 1).

-- Verificación:
-- SELECT COUNT(*) FROM public.incidencias;  -- debe ser 0
