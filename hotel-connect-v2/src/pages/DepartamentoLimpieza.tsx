import { useCallback, useEffect, useRef, useState } from 'react'
import {
  acceptIncidencia,
  fetchIncidenciasLimpiezaActivas,
  incidenciaIdVisible,
  isEstadoEnProceso,
  isEstadoPendiente,
  resolveIncidencia,
  responsableMostrar,
  type IncidenciaRow,
} from '../services/incidenciasSupabase'
import { supabase } from '../supabase'
import '../Departamento.css'

const TIPO_LABELS: Record<string, string> = {
  towels: 'Toallas',
  toallas: 'Toallas',
  cleaning: 'Limpieza',
  limpieza: 'Limpieza',
  blanket: 'Manta',
  manta: 'Manta',
}

function normalizeKey(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, '_')
}

function tipoLabel(tipo: string): string {
  return TIPO_LABELS[normalizeKey(tipo)] ?? tipo
}

function estadoLabel(estado: string): string {
  if (isEstadoEnProceso(estado)) return 'En proceso'
  if (isEstadoPendiente(estado)) return 'Pendiente'
  return estado
}

function formatHoraCreacion(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

const STORAGE_RESPONSABLE = 'hc_responsable_limpieza'

function formatHora(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function playAlarmSound(): void {
  try {
    const ctx = new AudioContext()
    const playBeep = (start: number, freq: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = freq
      gain.gain.value = 0.12
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.18)
    }
    playBeep(0, 880)
    playBeep(0.22, 660)
    playBeep(0.44, 880)
    window.setTimeout(() => void ctx.close(), 800)
  } catch {
    // Sin audio disponible en el dispositivo.
  }
}

export default function DepartamentoLimpieza() {
  const [incidencias, setIncidencias] = useState<IncidenciaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [nuevaAlerta, setNuevaAlerta] = useState(false)
  const [nombreTrabajador, setNombreTrabajador] = useState(
    () => localStorage.getItem(STORAGE_RESPONSABLE) ?? '',
  )
  const knownIdsRef = useRef<Set<string>>(new Set())
  const initialLoadRef = useRef(true)

  useEffect(() => {
    localStorage.setItem(STORAGE_RESPONSABLE, nombreTrabajador)
  }, [nombreTrabajador])

  const fetchIncidencias = useCallback(async () => {
    try {
      const rows = await fetchIncidenciasLimpiezaActivas()
      const prevIds = knownIdsRef.current
      const nuevasPendientes = rows.filter(
        (r) => isEstadoPendiente(r.estado) && !prevIds.has(r.id),
      )

      if (!initialLoadRef.current && nuevasPendientes.length > 0) {
        setNuevaAlerta(true)
        playAlarmSound()
        window.setTimeout(() => setNuevaAlerta(false), 8000)
      }

      knownIdsRef.current = new Set(rows.map((r) => r.id))
      initialLoadRef.current = false
      setIncidencias(rows)
    } catch (error) {
      console.error('Error al cargar incidencias de limpieza:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchIncidencias()

    const poll = window.setInterval(() => {
      void fetchIncidencias()
    }, 15_000)

    const channel = supabase
      .channel('departamento-limpieza')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidencias' }, () => {
        void fetchIncidencias()
      })
      .subscribe()

    return () => {
      window.clearInterval(poll)
      void supabase.removeChannel(channel)
    }
  }, [fetchIncidencias])

  const handleAccept = async (inc: IncidenciaRow) => {
    if (!isEstadoPendiente(inc.estado)) return
    const responsable = nombreTrabajador.trim()
    if (!responsable) return
    setActionId(inc.id)
    try {
      await acceptIncidencia(inc, responsable)
      await fetchIncidencias()
    } catch (error) {
      console.error('Error al aceptar:', error)
    }
    setActionId(null)
  }

  const handleResolve = async (inc: IncidenciaRow) => {
    if (!isEstadoEnProceso(inc.estado)) return
    setActionId(inc.id)
    try {
      await resolveIncidencia(inc, nombreTrabajador.trim() || inc.resolved_by || undefined)
      await fetchIncidencias()
    } catch (error) {
      console.error('Error al resolver:', error)
    }
    setActionId(null)
  }

  return (
    <div className="dept-worker">
      <header className="dept-worker__header">
        <p className="dept-worker__eyebrow">Hotel Connect</p>
        <h1 className="dept-worker__title">Limpieza</h1>
        <p className="dept-worker__subtitle">Incidencias pendientes y en proceso</p>
        <label className="dept-worker__responsable-field">
          <span>Tu nombre (responsable)</span>
          <input
            type="text"
            value={nombreTrabajador}
            onChange={(e) => setNombreTrabajador(e.target.value)}
            placeholder="Ej. María"
            autoComplete="name"
          />
        </label>
      </header>

      {nuevaAlerta && (
        <div className="dept-worker__alert" role="alert" aria-live="assertive">
          Nueva incidencia pendiente
        </div>
      )}

      <main className="dept-worker__main">
        {loading ? (
          <p className="dept-worker__empty">Cargando incidencias…</p>
        ) : incidencias.length === 0 ? (
          <p className="dept-worker__empty">No hay incidencias activas de limpieza.</p>
        ) : (
          <ul className="dept-worker__list">
            {incidencias.map((inc) => (
              <li key={inc.id} className="dept-card">
                <div className="dept-card__row">
                  <span className="dept-card__label">ID incidencia</span>
                  <span className="dept-card__value dept-card__value--id">
                    {incidenciaIdVisible(inc.id)}
                  </span>
                </div>
                <div className="dept-card__row">
                  <span className="dept-card__label">Habitación</span>
                  <span className="dept-card__value dept-card__value--room">{inc.habitacion}</span>
                </div>
                <div className="dept-card__row">
                  <span className="dept-card__label">Tipo</span>
                  <span className="dept-card__value">{tipoLabel(inc.tipo_incidencia)}</span>
                </div>
                <div className="dept-card__row">
                  <span className="dept-card__label">Estado</span>
                  <span
                    className={`dept-card__estado dept-card__estado--${
                      isEstadoPendiente(inc.estado) ? 'pendiente' : 'proceso'
                    }`}
                  >
                    {estadoLabel(inc.estado)}
                  </span>
                </div>
                <div className="dept-card__row">
                  <span className="dept-card__label">Hora de creación</span>
                  <span className="dept-card__value">{formatHoraCreacion(inc.hora_creacion)}</span>
                </div>
                <div className="dept-card__row">
                  <span className="dept-card__label">Responsable</span>
                  <span className="dept-card__value">{responsableMostrar(inc)}</span>
                </div>
                <div className="dept-card__row">
                  <span className="dept-card__label">Hora aceptación</span>
                  <span className="dept-card__value">{formatHora(inc.hora_aceptacion)}</span>
                </div>
                <div className="dept-card__row">
                  <span className="dept-card__label">Hora resolución</span>
                  <span className="dept-card__value">{formatHora(inc.hora_resolucion)}</span>
                </div>
                <div className="dept-card__actions">
                  {isEstadoPendiente(inc.estado) && (
                    <button
                      type="button"
                      className="dept-btn dept-btn--accept"
                      disabled={actionId === inc.id || !nombreTrabajador.trim()}
                      onClick={() => void handleAccept(inc)}
                    >
                      {actionId === inc.id ? 'Guardando…' : 'Aceptar'}
                    </button>
                  )}
                  {isEstadoEnProceso(inc.estado) && (
                    <button
                      type="button"
                      className="dept-btn dept-btn--resolve"
                      disabled={actionId === inc.id}
                      onClick={() => void handleResolve(inc)}
                    >
                      {actionId === inc.id ? 'Guardando…' : 'Resolver'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
