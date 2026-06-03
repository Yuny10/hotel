export type DepartmentId =
  | 'housekeeping'
  | 'maintenance'
  | 'reception'
  | 'security'

export type GuestServiceId = 'towels' | 'cleaning' | 'ac' | 'other'

export type LoadLevel = 'low' | 'normal' | 'high'

export const SLA_MINUTES = 20

/** Minutos de recepción evitados por solicitud resuelta vía QR (regla de negocio). */
export const MINUTES_SAVED_PER_RESOLVED = 10

export const DEPARTMENT_CONFIG: {
  id: DepartmentId
  label: string
}[] = [
  { id: 'housekeeping', label: 'Limpieza' },
  { id: 'maintenance', label: 'Mantenimiento' },
  { id: 'reception', label: 'Recepción' },
  { id: 'security', label: 'Seguridad' },
]

export const DEPARTMENT_LABELS: Record<DepartmentId, string> = {
  housekeeping: 'Limpieza',
  maintenance: 'Mantenimiento',
  reception: 'Recepción',
  security: 'Seguridad',
}

export const LOAD_LABELS: Record<LoadLevel, string> = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
}

export function departmentForGuestService(service: GuestServiceId): DepartmentId {
  switch (service) {
    case 'towels':
    case 'cleaning':
      return 'housekeeping'
    case 'ac':
      return 'maintenance'
    case 'other':
      return 'reception'
  }
}

export function loadFromActiveCount(count: number): LoadLevel {
  if (count >= 5) return 'high'
  if (count >= 2) return 'normal'
  return 'low'
}

export function departamentoLabel(departamento: string | null): string {
  if (!departamento) return '—'
  const key = departamento.toLowerCase().trim().replace(/\s+/g, '_') as DepartmentId
  return DEPARTMENT_LABELS[key] ?? departamento
}
