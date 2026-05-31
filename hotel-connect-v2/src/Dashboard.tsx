import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

type Incidencia = {
  id: string
  habitacion: number | string
  tipo_incidencia: string
  departamento: string | null
  estado: string
  prioridad: string | null
  created_at: string | null
  accepted_at: string | null
  accepted_by: string | null
  resolved_by: string | null
  hora_resolucion: string | null
  tiempo_respuesta_min: number | null
  tiempo_resolucion_min: number | null
  observaciones: string | null
  trabajador_nombre: string | null
  hotel_id: string | null
}

const SELECT_FIELDS =
  'id, habitacion, tipo_incidencia, departamento, estado, prioridad, created_at, accepted_at, accepted_by, resolved_by, hora_resolucion, tiempo_respuesta_min, tiempo_resolucion_min, observaciones, trabajador_nombre, hotel_id'

const TIPO_LABELS: Record<string, string> = {
  towels: 'Toallas',
  cleaning: 'Limpieza',
  ac: 'Aire acondicionado',
  minibar: 'Minibar',
  maintenance: 'Mantenimiento',
  noise: 'Ruido',
}

function isToday(iso: string): boolean {
  const date = new Date(iso)
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

function isPendiente(estado: string): boolean {
  return estado === 'pendiente'
}

function isEnProceso(estado: string): boolean {
  const n = estado.toLowerCase().trim()
  return n === 'en proceso' || n === 'en_proceso' || n === 'proceso'
}

function isResuelta(estado: string): boolean {
  return estado === 'resuelta'
}

function isActiva(estado: string): boolean {
  return isPendiente(estado) || isEnProceso(estado)
}

function tipoLabel(tipo: string): string {
  return TIPO_LABELS[tipo] ?? tipo
}

function getResolutionMinutes(inc: Incidencia): number | null {
  if (inc.tiempo_resolucion_min != null && inc.tiempo_resolucion_min >= 0) {
    return inc.tiempo_resolucion_min
  }
  if (!inc.created_at || !inc.hora_resolucion) return null
  const mins = Math.round(
    (new Date(inc.hora_resolucion).getTime() - new Date(inc.created_at).getTime()) /
      60000,
  )
  return mins >= 0 ? mins : null
}

function getElapsedMinutes(inc: Incidencia, now: Date): number {
  if (!inc.created_at) return 0
  const start = new Date(inc.created_at).getTime()
  const end =
    isResuelta(inc.estado) && inc.hora_resolucion
      ? new Date(inc.hora_resolucion).getTime()
      : now.getTime()
  return Math.max(0, Math.floor((end - start) / 60000))
}

function formatElapsed(minutes: number): string {
  if (minutes < 1) return '< 1 min'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rem = minutes % 60
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`
}

function estadoLabel(estado: string): string {
  if (isEnProceso(estado)) return 'En proceso'
  if (isPendiente(estado)) return 'Pendiente'
  if (isResuelta(estado)) return 'Resuelta'
  return estado
}

export default function Dashboard() {
  const [incidencias, setIncidencias] = useState<Incidencia[]>([])
  const [loading, setLoading] = useState(true)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const fetchIncidencias = useCallback(async () => {
    const { data, error } = await supabase
      .from('incidencias')
      .select(SELECT_FIELDS)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase fetch error:', error)
      return
    }

    setIncidencias((data as Incidencia[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchIncidencias()
    const interval = window.setInterval(fetchIncidencias, 30_000)
    return () => window.clearInterval(interval)
  }, [fetchIncidencias])

  useEffect(() => {
    const timer = window.setInterval(() => setTick((t) => t + 1), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const now = useMemo(() => new Date(), [tick, incidencias])

  const metrics = useMemo(() => {
    const todayCreated = incidencias.filter(
      (inc) => inc.created_at && isToday(inc.created_at),
    )

    const resueltasHoy = incidencias.filter(
      (inc) =>
        isResuelta(inc.estado) &&
        inc.hora_resolucion &&
        isToday(inc.hora_resolucion),
    )

    const resolvedWithTime = incidencias
      .map(getResolutionMinutes)
      .filter((m): m is number => m !== null)

    const avgMinutes =
      resolvedWithTime.length > 0
        ? Math.round(
            resolvedWithTime.reduce((a, b) => a + b, 0) / resolvedWithTime.length,
          )
        : null

    return {
      pendientes: incidencias.filter((inc) => isPendiente(inc.estado)).length,
      enProceso: incidencias.filter((inc) => isEnProceso(inc.estado)).length,
      resueltasHoy: resueltasHoy.length,
      avgMinutes,
      totalHoy: todayCreated.length,
    }
  }, [incidencias])

  const deptRanking = useMemo(() => {
    const map = new Map<string, { sum: number; count: number }>()

    for (const inc of incidencias) {
      if (!inc.departamento || !isResuelta(inc.estado)) continue
      const mins = getResolutionMinutes(inc)
      if (mins === null) continue
      const key = inc.departamento
      const cur = map.get(key) ?? { sum: 0, count: 0 }
      map.set(key, { sum: cur.sum + mins, count: cur.count + 1 })
    }

    return [...map.entries()]
      .map(([departamento, { sum, count }]) => ({
        departamento,
        avg: Math.round(sum / count),
      }))
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 8)
  }, [incidencias])

  const roomRanking = useMemo(() => {
    const map = new Map<string, number>()
    for (const inc of incidencias) {
      const key = String(inc.habitacion)
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return [...map.entries()]
      .map(([habitacion, count]) => ({ habitacion, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [incidencias])

  const tableRows = useMemo(() => {
    const activas = incidencias.filter((inc) => isActiva(inc.estado))
    const resto = incidencias.filter((inc) => !isActiva(inc.estado))
    return [...activas, ...resto]
  }, [incidencias])

  const handleResolve = async (inc: Incidencia) => {
    if (!inc.created_at) return
    setResolvingId(inc.id)

    const nowIso = new Date().toISOString()
    const tiempoResolucionMin = Math.round(
      (Date.now() - new Date(inc.created_at).getTime()) / 60000,
    )

    const { error } = await supabase
      .from('incidencias')
      .update({
        estado: 'resuelta',
        hora_resolucion: nowIso,
        tiempo_resolucion_min: Math.max(0, tiempoResolucionMin),
      })
      .eq('id', inc.id)

    if (error) {
      console.error('Supabase update error:', error)
    } else {
      await fetchIncidencias()
    }

    setResolvingId(null)
  }

  return (
    <div className="dash">
      <style>{`
        .dash {
          min-height: 100dvh;
          background: #0a0a10;
          color: #fff;
          font-family: Georgia, 'Times New Roman', serif;
          padding: clamp(1.25rem, 4vw, 2.5rem);
          box-sizing: border-box;
        }

        .dash *, .dash *::before, .dash *::after { box-sizing: border-box; }

        .dash__header { margin-bottom: 1.75rem; }

        .dash__title {
          margin: 0 0 0.35rem;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: clamp(1.75rem, 5vw, 2.5rem);
          font-weight: 400;
          color: rgba(200, 170, 100, 0.8);
          letter-spacing: 0.02em;
        }

        .dash__subtitle {
          margin: 0;
          font-size: 0.95rem;
          color: rgba(255, 255, 255, 0.55);
        }

        .dash__metrics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 1rem;
          margin-bottom: 1.75rem;
        }

        .dash__card {
          background: rgba(20, 22, 28, 0.85);
          border: 1px solid rgba(200, 170, 100, 0.1);
          border-radius: 12px;
          padding: 1.15rem 1.25rem;
        }

        .dash__card-label {
          margin: 0 0 0.45rem;
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(200, 170, 100, 0.8);
        }

        .dash__card-value {
          margin: 0;
          font-size: clamp(1.65rem, 4vw, 2.1rem);
          font-weight: 500;
        }

        .dash__card-value--red { color: #f56565; }
        .dash__card-value--gold { color: rgba(200, 170, 100, 0.95); }
        .dash__card-value--green { color: #68d391; }
        .dash__card-value--blue { color: #63b3ed; }
        .dash__card-value--white { color: #fff; }

        .dash__panels {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
          margin-bottom: 1.75rem;
        }

        @media (min-width: 900px) {
          .dash__panels { grid-template-columns: 1fr 1fr; }
        }

        .dash__panel {
          background: rgba(20, 22, 28, 0.85);
          border: 1px solid rgba(200, 170, 100, 0.1);
          border-radius: 12px;
          padding: 1.25rem 1.35rem;
        }

        .dash__panel-title {
          margin: 0 0 1rem;
          font-size: 1.1rem;
          font-weight: 400;
          color: rgba(200, 170, 100, 0.8);
        }

        .dash__rank-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
        }

        .dash__rank-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.9rem;
          padding: 0.45rem 0;
          border-bottom: 1px solid rgba(200, 170, 100, 0.08);
        }

        .dash__rank-item:last-child { border-bottom: none; }

        .dash__rank-name { color: rgba(255, 255, 255, 0.9); }

        .dash__rank-value {
          color: rgba(200, 170, 100, 0.8);
          white-space: nowrap;
        }

        .dash__section-title {
          margin: 0 0 1rem;
          font-size: 1.35rem;
          font-weight: 400;
          color: rgba(255, 255, 255, 0.9);
        }

        .dash__table-wrap {
          overflow-x: auto;
          border: 1px solid rgba(200, 170, 100, 0.1);
          border-radius: 12px;
          background: rgba(20, 22, 28, 0.85);
        }

        .dash__table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.88rem;
          min-width: 720px;
        }

        .dash__table th {
          text-align: left;
          padding: 0.85rem 1rem;
          font-size: 0.68rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: rgba(200, 170, 100, 0.8);
          border-bottom: 1px solid rgba(200, 170, 100, 0.1);
        }

        .dash__table td {
          padding: 0.85rem 1rem;
          border-bottom: 1px solid rgba(200, 170, 100, 0.06);
          vertical-align: middle;
        }

        .dash__table tr:last-child td { border-bottom: none; }

        .dash__room {
          font-weight: 600;
          color: rgba(200, 170, 100, 0.8);
        }

        .dash__elapsed--alert { color: #f56565; font-weight: 600; }

        .dash__badge {
          display: inline-block;
          padding: 0.22rem 0.6rem;
          border-radius: 999px;
          font-size: 0.72rem;
          text-transform: capitalize;
        }

        .dash__badge--pendiente {
          background: rgba(245, 101, 101, 0.12);
          color: #f56565;
          border: 1px solid rgba(245, 101, 101, 0.35);
        }

        .dash__badge--proceso {
          background: rgba(200, 170, 100, 0.12);
          color: rgba(200, 170, 100, 0.95);
          border: 1px solid rgba(200, 170, 100, 0.35);
        }

        .dash__badge--resuelta {
          background: rgba(104, 211, 145, 0.12);
          color: #68d391;
          border: 1px solid rgba(104, 211, 145, 0.3);
        }

        .dash__btn {
          padding: 0.4rem 0.85rem;
          border-radius: 8px;
          border: 1px solid rgba(200, 170, 100, 0.35);
          background: rgba(200, 170, 100, 0.1);
          color: rgba(200, 170, 100, 0.8);
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 0.8rem;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.2s, border-color 0.2s;
        }

        .dash__btn:hover:not(:disabled) {
          background: rgba(200, 170, 100, 0.2);
          border-color: rgba(200, 170, 100, 0.55);
        }

        .dash__btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .dash__empty {
          text-align: center;
          padding: 2rem 1rem;
          color: rgba(255, 255, 255, 0.45);
        }

        .dash__muted { color: rgba(255, 255, 255, 0.45); font-size: 0.85rem; }
      `}</style>

      <header className="dash__header">
        <h1 className="dash__title">Hotel Connect</h1>
        <p className="dash__subtitle">Panel operativo de incidencias</p>
      </header>

      <section className="dash__metrics" aria-label="Métricas">
        <article className="dash__card">
          <p className="dash__card-label">Pendientes</p>
          <p className="dash__card-value dash__card-value--red">{metrics.pendientes}</p>
        </article>
        <article className="dash__card">
          <p className="dash__card-label">En proceso</p>
          <p className="dash__card-value dash__card-value--gold">{metrics.enProceso}</p>
        </article>
        <article className="dash__card">
          <p className="dash__card-label">Resueltas hoy</p>
          <p className="dash__card-value dash__card-value--green">{metrics.resueltasHoy}</p>
        </article>
        <article className="dash__card">
          <p className="dash__card-label">Tiempo medio resolución</p>
          <p className="dash__card-value dash__card-value--blue">
            {metrics.avgMinutes !== null ? `${metrics.avgMinutes} min` : '—'}
          </p>
        </article>
        <article className="dash__card">
          <p className="dash__card-label">Total incidencias hoy</p>
          <p className="dash__card-value dash__card-value--white">{metrics.totalHoy}</p>
        </article>
      </section>

      <section className="dash__panels" aria-label="Rankings">
        <article className="dash__panel">
          <h2 className="dash__panel-title">Departamentos — tiempo medio</h2>
          {deptRanking.length === 0 ? (
            <p className="dash__muted">Sin datos de resolución por departamento.</p>
          ) : (
            <ul className="dash__rank-list">
              {deptRanking.map((row, i) => (
                <li key={row.departamento} className="dash__rank-item">
                  <span className="dash__rank-name">
                    {i + 1}. {row.departamento}
                  </span>
                  <span className="dash__rank-value">{row.avg} min</span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="dash__panel">
          <h2 className="dash__panel-title">Habitaciones — más incidencias</h2>
          {roomRanking.length === 0 ? (
            <p className="dash__muted">Sin incidencias registradas.</p>
          ) : (
            <ul className="dash__rank-list">
              {roomRanking.map((row, i) => (
                <li key={row.habitacion} className="dash__rank-item">
                  <span className="dash__rank-name">
                    {i + 1}. Hab. {row.habitacion}
                  </span>
                  <span className="dash__rank-value">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section aria-label="Incidencias">
        <h2 className="dash__section-title">Incidencias activas y recientes</h2>

        {loading ? (
          <p className="dash__empty">Cargando incidencias…</p>
        ) : tableRows.length === 0 ? (
          <p className="dash__empty">No hay incidencias registradas.</p>
        ) : (
          <div className="dash__table-wrap">
            <table className="dash__table">
              <thead>
                <tr>
                  <th>Habitación</th>
                  <th>Incidencia</th>
                  <th>Departamento</th>
                  <th>Trabajador</th>
                  <th>Estado</th>
                  <th>Tiempo transcurrido</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((inc) => {
                  const elapsedMin = getElapsedMinutes(inc, now)
                  const active = isActiva(inc.estado)
                  const over20 = active && elapsedMin > 20

                  const badgeClass = isResuelta(inc.estado)
                    ? 'dash__badge--resuelta'
                    : isEnProceso(inc.estado)
                      ? 'dash__badge--proceso'
                      : 'dash__badge--pendiente'

                  return (
                    <tr key={inc.id}>
                      <td>
                        <span className="dash__room">{inc.habitacion}</span>
                      </td>
                      <td>{tipoLabel(inc.tipo_incidencia)}</td>
                      <td>{inc.departamento ?? '—'}</td>
                      <td>{inc.trabajador_nombre ?? '—'}</td>
                      <td>
                        <span className={`dash__badge ${badgeClass}`}>
                          {estadoLabel(inc.estado)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={over20 ? 'dash__elapsed--alert' : undefined}
                        >
                          {inc.created_at
                            ? formatElapsed(elapsedMin)
                            : '—'}
                        </span>
                      </td>
                      <td>
                        {active ? (
                          <button
                            type="button"
                            className="dash__btn"
                            disabled={resolvingId === inc.id}
                            onClick={() => handleResolve(inc)}
                          >
                            {resolvingId === inc.id ? 'Guardando…' : 'Resolver'}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
