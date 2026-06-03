import { useCallback, useEffect, useMemo, useState } from 'react'
import { departamentoLabel } from './lib/departments'
import {
  acceptIncidencia,
  fetchIncidenciasRows,
  incidenciaIdVisible,
  isEstadoEnProceso,
  isEstadoPendiente,
  resolveIncidencia,
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
  return isPendiente(inc.estado)
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

function minutosEntre(isoDesde: string | null, hasta: Date): number | null {
  if (!isoDesde) return null
  const mins = Math.round((hasta.getTime() - new Date(isoDesde).getTime()) / 60000)
  return mins >= 0 ? mins : null
}

function tiempoRespuestaPersistido(inc: IncidenciaRow): number | null {
  return inc.tiempo_respuesta_min ?? inc.tiempo_reaccion
}

function tiempoResolucionPersistido(inc: IncidenciaRow): number | null {
  return inc.tiempo_resolucion_min ?? inc.tiempo_resolucion
}

/** Pendiente: reacción en vivo. En proceso: resolución en vivo. Resuelta: solo Supabase. */
function tiemposVistaOperativos(inc: IncidenciaRow, ahora: Date): TiemposVista {
  if (esPendienteEfectivo(inc)) {
    return {
      horaAceptacion: null,
      horaResolucion: null,
      tiempoReaccion: minutosEntre(inc.hora_creacion, ahora),
      tiempoResolucion: null,
      tiempoTotal: null,
    }
  }

  if (esEnProcesoEfectivo(inc) && !esResueltaValida(inc)) {
    const horaAceptacion = inc.hora_aceptacion ?? inc.accepted_at
    return {
      horaAceptacion,
      horaResolucion: null,
      tiempoReaccion: tiempoRespuestaPersistido(inc),
      tiempoResolucion: minutosEntre(horaAceptacion, ahora),
      tiempoTotal: null,
    }
  }

  return {
    horaAceptacion: inc.hora_aceptacion ?? inc.accepted_at,
    horaResolucion: inc.hora_resolucion,
    tiempoReaccion: tiempoRespuestaPersistido(inc),
    tiempoResolucion: tiempoResolucionPersistido(inc),
    tiempoTotal: inc.tiempo_total,
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
  'Fecha Creación',
  'Hora Aceptación',
  'Tiempo Reacción',
  'Hora Resolución',
  'Tiempo Resolución',
  'Tiempo Total',
  'Responsable',
  'Acciones',
] as const

const STORAGE_RESPONSABLE = 'hc_responsable_dashboard'

type FiltroIncidencias = 'todas' | 'pendientes' | 'en_proceso' | 'resueltas'

const CONTADOR_ITEMS: {
  key: FiltroIncidencias
  label: string
  tone: '' | 'pendiente' | 'proceso' | 'resuelta'
}[] = [
  { key: 'todas', label: 'Todas', tone: '' },
  { key: 'pendientes', label: 'Pendientes', tone: 'pendiente' },
  { key: 'en_proceso', label: 'En proceso', tone: 'proceso' },
  { key: 'resueltas', label: 'Resueltas', tone: 'resuelta' },
]

function promedioMinutos(valores: (number | null | undefined)[]): number | null {
  const valid = valores.filter((v): v is number => v !== null && v !== undefined)
  if (valid.length === 0) return null
  return Math.round(valid.reduce((sum, v) => sum + v, 0) / valid.length)
}

function formatMetricaMinutos(minutos: number | null): string {
  if (minutos === null) return '—'
  return `${minutos} min`
}

function EmptyIncidenciasRow({ message }: { message: string }) {
  return (
    <tr className="incidents-table__empty-row">
      <td colSpan={TABLE_COLUMNS.length} className="incidents-table__empty-slot">
        <span className="incidents-table__empty-banner">{message}</span>
      </td>
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
  const [filtro, setFiltro] = useState<FiltroIncidencias>('todas')
  const [actionId, setActionId] = useState<string | null>(null)
  const [nombreResponsable, setNombreResponsable] = useState(
    () => localStorage.getItem(STORAGE_RESPONSABLE) ?? '',
  )

  useEffect(() => {
    localStorage.setItem(STORAGE_RESPONSABLE, nombreResponsable)
  }, [nombreResponsable])

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

  const contadorValor = useCallback(
    (key: FiltroIncidencias) => {
      if (key === 'todas') return contadores.total
      if (key === 'pendientes') return contadores.pendientes
      if (key === 'en_proceso') return contadores.enProceso
      return contadores.resueltas
    },
    [contadores],
  )

  const metricas = useMemo(
    () => ({
      total: contadores.total,
      tiempoMedioRespuesta: promedioMinutos(
        incidencias
          .map((i) => tiempoRespuestaPersistido(i))
          .filter((v): v is number => v !== null),
      ),
      tiempoMedioResolucion: promedioMinutos(
        incidencias
          .map((i) => tiempoResolucionPersistido(i))
          .filter((v): v is number => v !== null),
      ),
    }),
    [contadores.total, incidencias],
  )

  const handleAccept = async (inc: IncidenciaRow) => {
    if (!isEstadoPendiente(inc.estado)) return
    setActionId(inc.id)
    try {
      const nombre = nombreResponsable.trim() || undefined
      await acceptIncidencia(inc, nombre)
      await fetchIncidencias()
    } catch (error) {
      console.error('Error al aceptar incidencia:', error)
    }
    setActionId(null)
  }

  const handleResolve = async (inc: IncidenciaRow) => {
    if (!isEstadoEnProceso(inc.estado)) return
    setActionId(inc.id)
    try {
      const nombre = nombreResponsable.trim() || inc.responsable || undefined
      await resolveIncidencia(inc, nombre)
      await fetchIncidencias()
    } catch (error) {
      console.error('Error al resolver incidencia:', error)
    }
    setActionId(null)
  }

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
          <label className="topbar__responsable">
            <span className="topbar__responsable-label">Responsable</span>
            <input
              type="text"
              className="topbar__responsable-input"
              value={nombreResponsable}
              onChange={(e) => setNombreResponsable(e.target.value)}
              placeholder="Opcional"
              autoComplete="name"
            />
          </label>
        </div>
      </header>

      <main className="dashboard__main dashboard-operativo">
        <section className="dashboard-overview" aria-label="Resumen del dashboard">
          <div className="dashboard-section">
            <h2 className="dashboard-section__heading">Contadores</h2>
            <div className="counter-grid" role="group" aria-label="Contadores de incidencias">
              {CONTADOR_ITEMS.map(({ key, label, tone }) => {
                const activo = filtro === key
                const toneClass = tone ? ` counter-card--${tone}` : ''
                return (
                  <button
                    key={key}
                    type="button"
                    className={`counter-card${toneClass}${activo ? ' counter-card--active' : ''}`}
                    aria-pressed={activo}
                    onClick={() => setFiltro(key)}
                  >
                    <span className="counter-card__label">{label}</span>
                    <span className="counter-card__value">{contadorValor(key)}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="dashboard-section">
            <h2 className="dashboard-section__heading">Métricas</h2>
            <div className="kpi-section kpi-section--metrics">
              <article className="kpi-card kpi-card--gold">
                <div className="kpi-card__glow" aria-hidden />
                <p className="kpi-card__label">Total incidencias</p>
                <p className="kpi-card__number">{metricas.total}</p>
              </article>
              <article className="kpi-card kpi-card--cyan">
                <div className="kpi-card__glow" aria-hidden />
                <p className="kpi-card__label">Tiempo medio respuesta</p>
                <p className="kpi-card__number">{formatMetricaMinutos(metricas.tiempoMedioRespuesta)}</p>
              </article>
              <article className="kpi-card kpi-card--violet">
                <div className="kpi-card__glow" aria-hidden />
                <p className="kpi-card__label">Tiempo medio resolución</p>
                <p className="kpi-card__number">
                  {formatMetricaMinutos(metricas.tiempoMedioResolucion)}
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="panel incidents-panel" aria-labelledby="incidents-heading">
          <div className="panel__header">
            <div>
              <h2 id="incidents-heading" className="panel__title panel__title--upper">
                Tabla de incidencias
              </h2>
              <p className="panel__subtitle">
                Monitorización en tiempo real · filtro activo:{' '}
                {CONTADOR_ITEMS.find((c) => c.key === filtro)?.label ?? 'Todas'}
              </p>
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
                    const tiempos = tiemposVistaOperativos(inc, now)
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
                            activo={pendiente}
                            destacado={pendiente && tiempos.tiempoReaccion !== null}
                          />
                        </td>
                        <td className="incident-row__time">{formatHora(tiempos.horaResolucion)}</td>
                        <td className="incident-row__metric">
                          <TimeChip
                            minutos={tiempos.tiempoResolucion}
                            activo={enProceso && !resuelta}
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
                        <td className="incident-row__actions">
                          <div className="incident-actions">
                            {isEstadoPendiente(inc.estado) && (
                              <button
                                type="button"
                                className="action-btn action-btn--accept"
                                disabled={actionId === inc.id}
                                onClick={() => void handleAccept(inc)}
                              >
                                {actionId === inc.id ? 'Guardando…' : 'ACEPTAR'}
                              </button>
                            )}
                            {isEstadoEnProceso(inc.estado) && (
                              <button
                                type="button"
                                className="action-btn action-btn--resolve"
                                disabled={actionId === inc.id}
                                onClick={() => void handleResolve(inc)}
                              >
                                {actionId === inc.id ? 'Guardando…' : 'RESOLVER'}
                              </button>
                            )}
                          </div>
                        </td>
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
