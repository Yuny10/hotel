/**
 * Vacía todas las filas de public.incidencias vía API.
 * Para reiniciar INC-0001 ejecuta también supabase/reset-demo-incidencias.sql en SQL Editor.
 */
import { createClient } from '@supabase/supabase-js'

const url = 'https://ouomjxvnaxptblpfmrtv.supabase.co'
const key = 'sb_publishable_yWXN9HE8HBLIa1zdp_wNbA_J2oH7UG-'
const supabase = createClient(url, key)

const { data: rows, error: selectError } = await supabase.from('incidencias').select('id')

if (selectError) {
  console.error('Error al listar incidencias:', selectError.message)
  process.exit(1)
}

const ids = (rows ?? []).map((r) => r.id)
console.log(`Incidencias encontradas: ${ids.length}`)

if (ids.length === 0) {
  console.log('La tabla ya está vacía.')
  process.exit(0)
}

const { error: deleteError } = await supabase.from('incidencias').delete().in('id', ids)

if (deleteError) {
  console.error('Error al borrar:', deleteError.message)
  console.error('Si RLS lo impide, ejecuta supabase/reset-demo-incidencias.sql en SQL Editor.')
  process.exit(1)
}

const { count } = await supabase.from('incidencias').select('id', { count: 'exact', head: true })
console.log(`Borrado completado. Filas restantes: ${count ?? 0}`)
console.log('Para INC-0001 en la próxima incidencia, ejecuta reset-demo-incidencias.sql (RESTART IDENTITY).')
