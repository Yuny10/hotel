import {
  GUEST_INCIDENCIA_CATALOG,
  type GuestServiceKey,
} from '../lib/guestIncidenciaCatalog'
import { supabase } from '../supabase'

export type GuestLanguageId = 'es' | 'en' | 'de' | 'fr'

export type IncidenciaRow = {
  id: string
  habitacion: number | string
  tipo_incidencia: string
  departamento: string | null
  estado: string
  prioridad: string | null
  /** Hora en que el huésped creó la incidencia (hora_inicio en Supabase). */
  hora_creacion: string | null
  /** Alias interno; mismo valor que hora_creacion. */
  created_at: string | null
  /** Hora en que el trabajador pulsó Aceptar (accepted_at en Supabase). */
  hora_aceptacion: string | null
  accepted_at: string | null
  accepted_by: string | null
  resolved_by: string | null
  hora_resolucion: string | null
  /** Minutos desde creación hasta aceptación (tiempo_respuesta_min en Supabase). */
  tiempo_reaccion: number | null
  /** Minutos desde aceptación hasta resolución (tiempo_resolucion_min en Supabase). */
  tiempo_resolucion: number | null
  /** Minutos desde creación hasta resolución (calculado al resolver). */
  tiempo_total: number | null
  tiempo_respuesta_min: number | null
  tiempo_resolucion_min: number | null
  observaciones: string | null
  /** @deprecated Legado (aceptación antigua). UI: accepted_by. */
  trabajador_nombre: string | null
  hotel_id: string | null
  idioma?: string | null
}

export function responsableMostrar(inc: IncidenciaRow): string {
  const nombre = inc.accepted_by?.trim()
  return nombre ? nombre : '—'
}

export function operarioMostrar(inc: IncidenciaRow): string {
  const nombre = inc.resolved_by?.trim()
  return nombre ? nombre : '—'
}

/** Identificador único visible y persistente (basado en id de Supabase). */
export function incidenciaIdVisible(id: string | number): string {
  const n = typeof id === 'number' ? id : Number.parseInt(String(id), 10)
  if (Number.isFinite(n)) return `INC-${String(n).padStart(4, '0')}`
  return `INC-${String(id).replace(/\s+/g, '').slice(0, 8).toUpperCase()}`
}

const SELECT_FIELDS_LEGACY =
  'id, habitacion, tipo_incidencia, departamento, estado, prioridad, hora_inicio, accepted_at, accepted_by, resolved_by, hora_resolucion, tiempo_respuesta_min, tiempo_resolucion_min, observaciones, trabajador_nombre, hotel_id, idioma'

const SELECT_FIELDS = `${SELECT_FIELDS_LEGACY}, tiempo_total`

type IncidenciaDbRow = {
  id: string
  habitacion: number | string
  tipo_incidencia: string
  departamento: string | null
  estado: string
  prioridad: string | null
  hora_inicio: string | null
  accepted_at: string | null
  accepted_by: string | null
  resolved_by: string | null
  hora_resolucion: string | null
  tiempo_respuesta_min: number | null
  tiempo_resolucion_min: number | null
  tiempo_total: number | null
  observaciones: string | null
  trabajador_nombre: string | null
  hotel_id: string | null
  idioma?: string | null
}

function minutosEntre(desde: string | null, hasta: string | null): number | null {
  if (!desde || !hasta) return null
  const mins = Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / 60000)
  return mins >= 0 ? mins : null
}

function mapDbRowToIncidencia(row: IncidenciaDbRow): IncidenciaRow {
  const horaCreacion = row.hora_inicio ?? null
  const horaAceptacion = row.accepted_at ?? null

  return {
    id: row.id,
    habitacion: row.habitacion,
    tipo_incidencia: row.tipo_incidencia,
    departamento: row.departamento,
    estado: row.estado,
    prioridad: row.prioridad,
    hora_creacion: horaCreacion,
    created_at: horaCreacion,
    hora_aceptacion: horaAceptacion,
    accepted_at: horaAceptacion,
    accepted_by: row.accepted_by,
    resolved_by: row.resolved_by,
    hora_resolucion: row.hora_resolucion,
    tiempo_reaccion: row.tiempo_respuesta_min,
    tiempo_resolucion: row.tiempo_resolucion_min,
    tiempo_total: row.tiempo_total,
    tiempo_respuesta_min: row.tiempo_respuesta_min,
    tiempo_resolucion_min: row.tiempo_resolucion_min,
    observaciones: row.observaciones,
    trabajador_nombre: row.trabajador_nombre,
    hotel_id: row.hotel_id,
    idioma: row.idioma,
  }
}

function parseHabitacion(room: string): number | string {
  const n = Number.parseInt(room, 10)
  return Number.isFinite(n) ? n : room
}

/** Tras vaciar la demo, la primera incidencia real usa id 1 → INC-0001. */
async function nextIncidenciaId(): Promise<number> {
  const { data, error } = await supabase
    .from('incidencias')
    .select('id')
    .order('id', { ascending: false })
    .limit(1)

  if (error || !data?.length) return 1

  const raw = data[0].id
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  return Number.isFinite(n) ? n + 1 : 1
}

async function updateIncidenciaConFallback(
  id: string,
  payload: Record<string, unknown>,
  omitOnRetry: string[] = [],
): Promise<void> {
  let current = { ...payload }
  let { error } = await supabase.from('incidencias').update(current).eq('id', id)

  for (const key of omitOnRetry) {
    if (!error) break
    const { [key]: _removed, ...rest } = current
    current = rest
    const retry = await supabase.from('incidencias').update(current).eq('id', id)
    error = retry.error
  }

  if (error) throw error
}

export async function fetchIncidenciasRows(): Promise<IncidenciaRow[]> {
  const order = { ascending: false, nullsFirst: false } as const
  const selects = [SELECT_FIELDS, SELECT_FIELDS_LEGACY]
  let result = await supabase.from('incidencias').select(selects[0]).order('hora_inicio', order)

  for (let i = 1; result.error && i < selects.length; i++) {
    result = await supabase.from('incidencias').select(selects[i]).order('hora_inicio', order)
  }

  if (result.error) {
    console.error('Supabase fetch incidencias:', result.error)
    throw result.error
  }

  return ((result.data as IncidenciaDbRow[]) ?? []).map(mapDbRowToIncidencia)
}

function normalizeKey(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, '_')
}

const TIPOS_LIMPIEZA = new Set([
  'toallas',
  'towels',
  'limpieza',
  'cleaning',
  'manta',
  'blanket',
])

export function isDepartamentoLimpieza(departamento: string | null, tipoIncidencia: string): boolean {
  const dept = normalizeKey(departamento ?? '')
  if (dept === 'limpieza' || dept === 'housekeeping') return true
  if (!departamento) return TIPOS_LIMPIEZA.has(normalizeKey(tipoIncidencia))
  return false
}

export function isEstadoPendiente(estado: string): boolean {
  return normalizeKey(estado) === 'pendiente'
}

export function isEstadoEnProceso(estado: string): boolean {
  const n = normalizeKey(estado)
  return n === 'en_proceso' || n === 'en proceso' || n === 'proceso'
}

export function isEstadoActivoDepartamento(estado: string): boolean {
  return isEstadoPendiente(estado) || isEstadoEnProceso(estado)
}

/** Incidencias de Limpieza en cola operativa (pendiente o en proceso). */
export async function fetchIncidenciasLimpiezaActivas(): Promise<IncidenciaRow[]> {
  const rows = await fetchIncidenciasRows()
  return rows.filter(
    (inc) => isDepartamentoLimpieza(inc.departamento, inc.tipo_incidencia) && isEstadoActivoDepartamento(inc.estado),
  )
}

/**
 * Capa 1 — Insert limpio en español al pedir un servicio desde /guest/:room.
 * hora_inicio = hora de creación; tiempos NULL hasta Aceptar/Resolver.
 */
export async function insertIncidenciaFromGuestService(
  room: string,
  service: GuestServiceKey,
): Promise<IncidenciaRow> {
  const spec = GUEST_INCIDENCIA_CATALOG[service]
  const habitacion = parseHabitacion(room)
  const horaCreacion = new Date().toISOString()
  const descripcion = spec.buildDescripcion(habitacion)

  const baseRow: Record<string, unknown> = {
    id: await nextIncidenciaId(),
    habitacion,
    tipo_incidencia: spec.tipo_incidencia,
    departamento: spec.departamento,
    estado: spec.estado,
    prioridad: spec.prioridad,
    hora_inicio: horaCreacion,
    descripcion,
  }

  let result = await supabase.from('incidencias').insert(baseRow).select(SELECT_FIELDS).single()

  if (result.error) {
    const { descripcion: text, ...rest } = baseRow
    result = await supabase
      .from('incidencias')
      .insert({ ...rest, observaciones: text })
      .select(SELECT_FIELDS)
      .single()
  }

  if (result.error) {
    console.error('Supabase insert incidencia huésped:', result.error)
    throw result.error
  }

  return mapDbRowToIncidencia(result.data as IncidenciaDbRow)
}

/** Aceptar: en proceso, accepted_at y tiempo_respuesta_min (creación → aceptación). */
export async function acceptIncidencia(inc: IncidenciaRow, responsable?: string): Promise<void> {
  const horaCreacion = inc.hora_creacion ?? inc.created_at
  if (!horaCreacion) throw new Error('Sin hora de creación')

  const nombre = responsable?.trim() || null
  const horaAceptacion = new Date().toISOString()
  const tiempoReaccion = minutosEntre(horaCreacion, horaAceptacion) ?? 0

  const payload: Record<string, unknown> = {
    estado: 'en_proceso',
    accepted_at: horaAceptacion,
    tiempo_respuesta_min: tiempoReaccion,
  }
  if (nombre) payload.accepted_by = nombre

  await updateIncidenciaConFallback(inc.id, payload, ['accepted_by'])
}

/** Resolver: resuelta, hora_resolución y operario que realizó el trabajo. */
export async function resolveIncidencia(inc: IncidenciaRow, operario?: string): Promise<void> {
  const horaCreacion = inc.hora_creacion ?? inc.created_at
  const horaAceptacion = inc.hora_aceptacion ?? inc.accepted_at
  if (!horaAceptacion) throw new Error('Sin hora de aceptación')

  const horaResolucion = new Date().toISOString()
  const tiempoResolucion = minutosEntre(horaAceptacion, horaResolucion) ?? 0
  const tiempoRespuesta =
    inc.tiempo_respuesta_min ?? inc.tiempo_reaccion ?? minutosEntre(horaCreacion, horaAceptacion) ?? 0
  const tiempoTotal = tiempoRespuesta + tiempoResolucion
  const nombre = operario?.trim()

  const payload: Record<string, unknown> = {
    estado: 'resuelta',
    hora_resolucion: horaResolucion,
    tiempo_resolucion_min: tiempoResolucion,
    tiempo_total: tiempoTotal,
  }
  if (nombre) payload.resolved_by = nombre

  await updateIncidenciaConFallback(inc.id, payload, ['resolved_by', 'tiempo_total'])
}
