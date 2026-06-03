/** Claves internas del flujo huésped → fila limpia en Supabase (español). */
export type GuestServiceKey =
  | 'toallas'
  | 'limpieza'
  | 'aire_acondicionado'
  | 'manta'
  | 'otro'

export type GuestIncidenciaSpec = {
  tipo_incidencia: string
  departamento: string
  estado: 'pendiente'
  prioridad: string
  buildDescripcion: (habitacion: number | string) => string
}

export const GUEST_INCIDENCIA_CATALOG: Record<GuestServiceKey, GuestIncidenciaSpec> = {
  toallas: {
    tipo_incidencia: 'Toallas',
    departamento: 'Limpieza',
    estado: 'pendiente',
    prioridad: 'normal',
    buildDescripcion: (h) => `Solicitud de toallas desde habitación ${h}`,
  },
  limpieza: {
    tipo_incidencia: 'Limpieza',
    departamento: 'Limpieza',
    estado: 'pendiente',
    prioridad: 'normal',
    buildDescripcion: (h) => `Solicitud de limpieza desde habitación ${h}`,
  },
  aire_acondicionado: {
    tipo_incidencia: 'Aire acondicionado',
    departamento: 'Mantenimiento',
    estado: 'pendiente',
    prioridad: 'alta',
    buildDescripcion: (h) => `Solicitud de aire acondicionado desde habitación ${h}`,
  },
  manta: {
    tipo_incidencia: 'Manta',
    departamento: 'Limpieza',
    estado: 'pendiente',
    prioridad: 'normal',
    buildDescripcion: (h) => `Solicitud de manta desde habitación ${h}`,
  },
  otro: {
    tipo_incidencia: 'Otro',
    departamento: 'Recepción',
    estado: 'pendiente',
    prioridad: 'normal',
    buildDescripcion: (h) => `Solicitud de otro servicio desde habitación ${h}`,
  },
}

/** IDs del botón en la UI → clave del catálogo Supabase. */
export type GuestUiServiceId =
  | 'towels'
  | 'cleaning'
  | 'ac'
  | 'blanket'
  | 'other'

export const UI_SERVICE_TO_CATALOG: Record<GuestUiServiceId, GuestServiceKey> = {
  towels: 'toallas',
  cleaning: 'limpieza',
  ac: 'aire_acondicionado',
  blanket: 'manta',
  other: 'otro',
}

export function isGuestUiServiceId(id: string): id is GuestUiServiceId {
  return id in UI_SERVICE_TO_CATALOG
}
