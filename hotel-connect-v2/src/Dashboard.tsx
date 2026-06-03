import { useCallback, useEffect, useMemo, useState } from 'react'
import { departamentoLabel } from './lib/departments'
import {
  fetchIncidenciasRows,
  incidenciaIdVisible,
  responsableMostrar,
  type IncidenciaRow,
} from './services/incidenciasSupabase'
import { supabase } from './supabase'
import './Dashboard.css'

const TIPO_LABELS: Record<string, string> = {
  towels: 'Toallas',
  toallas: 'Toallas',
  cleaning: 'Limpieza',
  limpieza: 'Limpieza',
  ac: 'Aire acondicionado',
  aire_acondicionado: 'Aire acondicionado',
  'air-conditioning': 'Aire acondicionado',
  blanket: 'Manta',
  manta: 'Manta',
  other: 'Otro',
  otro: 'Otro',
}

function normalizeKey(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, '_')
}

function isPendiente(estado: string): boolean {
  return normalizeKey(estado) === 'pendiente'
}

function isEnProceso(estado: string): boolean {
  const n = normalizeKey(estado)
  return n === 'en_proceso' || n === 'en proceso' || n === 'proceso'
}

function isResuelta(estado: string): boolean {
  return normalizeKey(estado) === 'resuelta'
}

function esResueltaValida(inc: IncidenciaRow): boolean {
  return isResuelta(inc.estado) && !!inc.hora_resolucion
}

function esEnProcesoEfectivo(inc: IncidenciaRow): boolean {
  if (isEnProceso(inc.estado)) return true
  if (isResuelta(inc.estado) && inc.hora_aceptacion && !inc.hora_resolucion) return true
  return false
}

function esPendienteEfectivo(inc: IncidenciaRow): boolean {
  if (esResueltaValida(inc) || esEnProcesoEfectivo(inc)) return false
  return isPendiente(inc.estado) || isResuelta(inc.estado)
}

function departamentoMostrar(inc: IncidenciaRow): string {
  const etiqueta = departamentoLabel(inc.departamento)
  if (etiqueta !== '—') return etiqueta
  const tipo = normalizeKey(inc.tipo_incidencia)
  if (tipo === 'toallas' || tipo === 'towels') return 'Limpieza'
  return '—'
}

function estadoEfectivoLabel(inc: IncidenciaRow): string {
  if (esResueltaValida(inc)) return 'Resuelta'
  if (esEnProcesoEfectivo(inc)) return 'En proceso'
  if (esPendienteEfectivo(inc)) return 'Pendiente'
  return estadoLabel(inc.estado)
}

function estadoEfectivoClass(inc: IncidenciaRow): string {
  if (esResueltaValida(inc)) return 'resuelta'
  if (esEnProcesoEfectivo(inc)) return 'en_proceso'
  if (esPendienteEfectivo(inc)) return 'pendiente'
  return normalizeKey(inc.estado)
}

type TiemposVista = {
  horaAceptacion: string | null
  horaResolucion: string | null
  tiempoReaccion: number | null
  tiempoResolucion: number | null
  tiempoTotal: number | null
}

/** Solo valores persistidos en Supabase; sin cálculos en pantalla. */
function tiemposVistaDesdeDb(inc: IncidenciaRow): TiemposVista {
  const tieneAceptacion = !!inc.hora_aceptacion
  const tieneResolucion = !!inc.hora_resolucion

  return {
    horaAceptacion: tieneAceptacion ? inc.hora_aceptacion : null,
    horaResolucion: tieneResolucion ? inc.hora_resolucion : null,
    tiempoReaccion: tieneAceptacion ? inc.tiempo_reaccion : null,
    tiempoResolucion: tieneResolucion ? inc.tiempo_resolucion : null,
    tiempoTotal: tieneResolucion ? inc.tiempo_total : null,
  }
}

function tipoLabel(tipo: string): string {
  return TIPO_LABELS[normalizeKey(tipo)] ?? tipo
}

function estadoLabel(estado: string): string {
  if (isEnProceso(estado)) return 'En proceso'
  if (isPendiente(estado)) return 'Pendiente'
  if (isResuelta(estado)) return 'Resuelta'
  return estado
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  })
}

const TABLE_COLUMNS = [
  'ID Incidencia',
  'Habitación',
  'Tipo Incidencia',
  'Departamento',
  'Estado',
  'Hora Creación',
  'Hora Aceptación',
  'Tiempo Reacción',
  'Hora Resolución',
  'Tiempo Resolución',
  'Tiempo Total',
  'Responsable',
] as const

function EmptyIncidenciasRow({ message }: { message: string }) {
  return (
    <tr className="incidents-table__empty-row">
      {TABLE_COLUMNS.map((col, index) => (
        <td key={col} className="incidents-table__empty-slot">
          {index === 0 ? (
            <span className="incidents-table__empty-banner">{message}</span>
          ) : (
            '\u00a0'
          )}
        </td>
      ))}
    </tr>
  )
}

function formatHora(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function TimeChip({
  minutos,
  activo = false,
  destacado = false,
}: {
  minutos: number | null
  activo?: boolean
  destacado?: boolean
}) {
  if (minutos === null || minutos === undefined) {
    return <span className="time-chip time-chip--empty">—</span>
  }
  return (
    <span
      className={`time-chip${activo ? ' time-chip--live' : ''}${destacado ? ' time-chip--highlight' : ''}`}
    >
      {minutos} min
    </span>
  )
}

export default function Dashboard() {
  const [incidencias, setIncidencias] = useState<IncidenciaRow[]>([])
  const [now, setNow] = useState(() => new Date())
  const [liveIds, setLiveIds] = useState<Set<string>>(new Set())
  const [filtro, setFiltro] = useState<'todas' | 'pendientes' | 'en_proceso' | 'resueltas'>(
    'todas',
  )

  const fetchIncidencias = useCallback(async () => {
    try {
      const rows = await fetchIncidenciasRows()
      setIncidencias((prev) => {
        const prevIds = new Set(prev.map((r) => r.id))
        const newIds = rows.filter((r) => !prevIds.has(r.id)).map((r) => r.id)
        if (newIds.length > 0) {
          setLiveIds((s) => new Set([...s, ...newIds]))
          window.setTimeout(() => {
            setLiveIds((s) => {
              const next = new Set(s)
              newIds.forEach((id) => next.delete(id))
              return next
            })
          }, 4000)
        }
        return rows
      })
    } catch {
      // Mantiene última lista válida si falla un refresco puntual.
    }
  }, [])

  useEffect(() => {
    void fetchIncidencias()

    const poll = window.setInterval(() => {
      void fetchIncidencias()
    }, 30_000)

    const channel = supabase
      .channel('dashboard-incidencias')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incidencias' },
        () => {
          void fetchIncidencias()
        },
      )
      .subscribe()

    return () => {
      window.clearInterval(poll)
      void supabase.removeChannel(channel)
    }
  }, [fetchIncidencias])

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(clock)
  }, [])

  const tableRows = useMemo(() => {
    const sorted = [...incidencias].sort((a, b) => {
      const ta = a.hora_creacion ? new Date(a.hora_creacion).getTime() : -1
      const tb = b.hora_creacion ? new Date(b.hora_creacion).getTime() : -1
      return tb - ta
    })

    if (filtro === 'pendientes') return sorted.filter((i) => esPendienteEfectivo(i))
    if (filtro === 'en_proceso') return sorted.filter((i) => esEnProcesoEfectivo(i))
    if (filtro === 'resueltas') return sorted.filter((i) => esResueltaValida(i))
    return sorted
  }, [filtro, incidencias])

  const contadores = useMemo(
    () => ({
      pendientes: incidencias.filter((i) => esPendienteEfectivo(i)).length,
      enProceso: incidencias.filter((i) => esEnProcesoEfectivo(i)).length,
      resueltas: incidencias.filter((i) => esResueltaValida(i)).length,
      total: incidencias.length,
    }),
    [incidencias],
  )

  return (
    <div className="dashboard">
      <div className="dashboard__ambient" aria-hidden>
        <div className="dashboard__grid" />
        <div className="dashboard__scan" />
      </div>

      <header className="topbar topbar--compact">
        <div className="topbar__line">
          <div className="topbar__brand-inline">
            <span className="brand-mark__inline" aria-hidden>
              HC
            </span>
            <span className="topbar__brand-text">
              Centro de Operaciones · Hotel Connect
            </span>
          </div>
          <span className="system-badge system-badge--inline">
            <span className="live-dot live-dot--sm" aria-hidden>
              <span className="live-dot__ring" />
              <span className="live-dot__core" />
            </span>
            Sistemas OK
          </span>
          <time className="topbar__datetime" dateTime={now.toISOString()}>
            {formatClock(now).slice(0, 5)} · {formatDateShort(now)}
          </time>
        </div>
      </header>

      <main className="dashboard__main">
        <section className="panel incidents-panel" aria-labelledby="incidents-heading">
          <div className="panel__header">
            <div>
              <h2 id="incidents-heading" className="panel__title panel__title--upper">
                Incidencias
              </h2>
              <p className="panel__subtitle">Dashboard operativo · datos reales de Supabase</p>
            </div>

            <div className="filter-bar" role="group" aria-label="Filtrar incidencias">
              <button
                type="button"
                className={`filter-btn${filtro === 'todas' ? ' filter-btn--active' : ''}`}
                aria-pressed={filtro === 'todas'}
                onClick={() => setFiltro('todas')}
              >
                Todas
                <span className="filter-btn__count">{contadores.total}</span>
              </button>
              <button
                type="button"
                className={`filter-btn filter-btn--pendiente${filtro === 'pendientes' ? ' filter-btn--active' : ''}`}
                aria-pressed={filtro === 'pendientes'}
                onClick={() => setFiltro('pendientes')}
              >
                Pendientes
                <span className="filter-btn__count">{contadores.pendientes}</span>
              </button>
              <button
                type="button"
                className={`filter-btn filter-btn--proceso${filtro === 'en_proceso' ? ' filter-btn--active' : ''}`}
                aria-pressed={filtro === 'en_proceso'}
                onClick={() => setFiltro('en_proceso')}
              >
                En proceso
                <span className="filter-btn__count">{contadores.enProceso}</span>
              </button>
              <button
                type="button"
                className={`filter-btn filter-btn--resuelta${filtro === 'resueltas' ? ' filter-btn--active' : ''}`}
                aria-pressed={filtro === 'resueltas'}
                onClick={() => setFiltro('resueltas')}
              >
                Resueltas
                <span className="filter-btn__count">{contadores.resueltas}</span>
              </button>
            </div>
          </div>

          <div className="table-wrap" role="region" aria-label="Tabla de incidencias">
            <table className="incidents-table">
              <colgroup>
                {TABLE_COLUMNS.map((col) => (
                  <col key={col} className="incidents-table__col" />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {TABLE_COLUMNS.map((label) => (
                    <th key={label} scope="col">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.length === 0 ? (
                  <EmptyIncidenciasRow message="Sin incidencias activas" />
                ) : (
                  tableRows.map((inc) => {
                    const isLive = liveIds.has(inc.id)
                    const tiempos = tiemposVistaDesdeDb(inc)
                    const estadoCls = estadoEfectivoClass(inc)
                    const pendiente = esPendienteEfectivo(inc)
                    const enProceso = esEnProcesoEfectivo(inc)
                    const resuelta = esResueltaValida(inc)

                    return (
                      <tr
                        key={inc.id}
                        className={`incident-row incident-row--${estadoCls}${isLive ? ' incident-row--live' : ''}`}
                      >
                        <td className="incident-row__id">{incidenciaIdVisible(inc.id)}</td>
                        <td className="incident-row__room">
                          <span className="room-badge">{inc.habitacion}</span>
                        </td>
                        <td className="incident-row__tipo">{tipoLabel(inc.tipo_incidencia)}</td>
                        <td>
                          <span className="dept-pill dept-pill--table">
                            {departamentoMostrar(inc)}
                          </span>
                        </td>
                        <td>
                          <span className={`status status--${estadoCls}`}>
                            {!resuelta && <span className="status__pulse" />}
                            {estadoEfectivoLabel(inc)}
                          </span>
                        </td>
                        <td className="incident-row__time">{formatHora(inc.hora_creacion)}</td>
                        <td className="incident-row__time">{formatHora(tiempos.horaAceptacion)}</td>
                        <td className="incident-row__metric">
                          <TimeChip
                            minutos={tiempos.tiempoReaccion}
                            destacado={pendiente && tiempos.tiempoReaccion !== null}
                          />
                        </td>
                        <td className="incident-row__time">{formatHora(tiempos.horaResolucion)}</td>
                        <td className="incident-row__metric">
                          <TimeChip
                            minutos={tiempos.tiempoResolucion}
                            destacado={enProceso && tiempos.tiempoResolucion !== null}
                          />
                        </td>
                        <td className="incident-row__metric incident-row__metric--total">
                          <TimeChip
                            minutos={tiempos.tiempoTotal}
                            destacado={resuelta && tiempos.tiempoTotal !== null}
                          />
                        </td>
                        <td className="incident-row__responsable">{responsableMostrar(inc)}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className="footer">
        <span>Hotel Connect · Centro de Operaciones</span>
        <span className="footer__live">
          <span className="live-dot live-dot--sm">
            <span className="live-dot__ring" />
            <span className="live-dot__core" />
          </span>
          Monitorización en vivo
        </span>
      </footer>
    </div>
  )
}
