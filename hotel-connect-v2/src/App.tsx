import { useCallback, useEffect, useState } from 'react'
import './App.css'

const ROOM_NUMBER = 203

type Language = 'es' | 'en' | 'de' | 'fr'

const LANGUAGES: { code: Language; flag: string; label: string }[] = [
  { code: 'es', flag: '🇪🇸', label: 'Español' },
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
  { code: 'fr', flag: '🇫🇷', label: 'Français' },
]

const COPY: Record<
  Language,
  { title: string; roomLabel: string; confirmation: string }
> = {
  es: {
    title: '¿Cómo podemos ayudarte?',
    roomLabel: 'Habitación',
    confirmation: `Solicitud enviada para la habitación ${ROOM_NUMBER}.`,
  },
  en: {
    title: 'How can we help you?',
    roomLabel: 'Room',
    confirmation: `Request sent for room ${ROOM_NUMBER}.`,
  },
  de: {
    title: 'Wie können wir Ihnen helfen?',
    roomLabel: 'Zimmer',
    confirmation: `Anfrage für Zimmer ${ROOM_NUMBER} gesendet.`,
  },
  fr: {
    title: 'Comment pouvons-nous vous aider ?',
    roomLabel: 'Chambre',
    confirmation: `Demande envoyée pour la chambre ${ROOM_NUMBER}.`,
  },
}

const SERVICES: { id: string; labels: Record<Language, string> }[] = [
  {
    id: 'towels',
    labels: { en: 'Towels', es: 'Toallas', de: 'Handtücher', fr: 'Serviettes' },
  },
  {
    id: 'cleaning',
    labels: {
      en: 'Cleaning',
      es: 'Limpieza',
      de: 'Reinigung',
      fr: 'Nettoyage',
    },
  },
  {
    id: 'ac',
    labels: {
      en: 'Air Conditioning',
      es: 'Aire acondicionado',
      de: 'Klimaanlage',
      fr: 'Climatisation',
    },
  },
  {
    id: 'minibar',
    labels: { en: 'Minibar', es: 'Minibar', de: 'Minibar', fr: 'Minibar' },
  },
  {
    id: 'maintenance',
    labels: {
      en: 'Maintenance',
      es: 'Mantenimiento',
      de: 'Wartung',
      fr: 'Maintenance',
    },
  },
  {
    id: 'noise',
    labels: { en: 'Noise', es: 'Ruido', de: 'Lärm', fr: 'Bruit' },
  },
]

const iconProps = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.85,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function ServiceIcon({ id }: { id: string }) {
  switch (id) {
    case 'towels':
      return (
        <svg {...iconProps}>
          <path d="M7 5.5h10l1.5 2.5H5.5L7 5.5z" />
          <path d="M5.5 8h13v11a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V8z" />
          <path d="M5.5 12.5h13" />
        </svg>
      )
    case 'cleaning':
      return (
        <svg {...iconProps}>
          <path d="M12 3l1.2 3.6L17 8l-3.6 1.2L12 13l-1.2-3.6L7 8l3.8-1.4L12 3z" />
          <path d="M5 16l.6 1.8L7 18l-1.4.5L5 20l-.6-1.5L3 18l1.4-.2L5 16z" />
          <path d="M18 14l.8 2.4L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.6L18 14z" />
        </svg>
      )
    case 'ac':
      return (
        <svg {...iconProps}>
          <path d="M12 2v20M12 2l3 3M12 2L9 5" />
          <path d="M12 22l3-3M12 22l-3-3" />
          <path d="M4.5 7.5l15 9M4.5 16.5l15-9" />
          <path d="M2 12h20M5 9l-3 3 3 3M19 9l3 3-3 3" />
        </svg>
      )
    case 'minibar':
      return (
        <svg {...iconProps}>
          <path d="M10.5 2.5h3V5c0 .55-.25 1.05-.65 1.4v11.2a1.65 1.65 0 0 0 3.3 0V6.4c-.4-.35-.65-.85-.65-1.4V2.5z" />
          <path d="M10.5 2.5h3" />
          <path d="M10 10.5h4" />
        </svg>
      )
    case 'maintenance':
      return (
        <svg {...iconProps}>
          <path d="M15.5 4.5 20 9M15.5 4.5a4.5 4.5 0 0 0-6.4 6.4L5 15.5a2 2 0 1 0 2.8 2.8l4.1-4.1a4.5 4.5 0 0 0 6.4-6.4z" />
        </svg>
      )
    case 'noise':
      return (
        <svg {...iconProps}>
          <path d="M11 5L6 9H3v6h3l5 4V5z" />
          <path d="M17 9l4 4M21 9l-4 4" />
        </svg>
      )
    default:
      return null
  }
}

function App() {
  const [language, setLanguage] = useState<Language>('en')
  const [confirmation, setConfirmation] = useState<string | null>(null)

  const showConfirmation = useCallback(() => {
    setConfirmation(COPY[language].confirmation)
  }, [language])

  useEffect(() => {
    if (!confirmation) return
    const timer = window.setTimeout(() => setConfirmation(null), 3200)
    return () => window.clearTimeout(timer)
  }, [confirmation])

  useEffect(() => {
    if (confirmation) {
      setConfirmation(COPY[language].confirmation)
    }
  }, [language])

  const { title, roomLabel } = COPY[language]

  return (
    <div className="guest-app">
      <header className="guest-header">
        <div className="room-badge">
          <span className="room-badge__label">{roomLabel}</span>
          <span className="room-badge__number">{ROOM_NUMBER}</span>
        </div>
      </header>

      <nav className="language-nav" aria-label="Language">
        {LANGUAGES.map(({ code, flag, label }) => (
          <button
            key={code}
            type="button"
            className={`language-btn${language === code ? ' language-btn--active' : ''}`}
            onClick={() => setLanguage(code)}
            aria-pressed={language === code}
          >
            <span className="language-btn__flag" aria-hidden="true">
              {flag}
            </span>
            <span className="language-btn__label">{label}</span>
          </button>
        ))}
      </nav>

      <main className="guest-main">
        <h1 className="guest-title">{title}</h1>

        <div className="service-grid" role="group" aria-label="Services">
          {SERVICES.map(({ id, labels }) => (
            <button
              key={id}
              type="button"
              className="service-btn"
              onClick={showConfirmation}
            >
              <span className="service-btn__icon" aria-hidden="true">
                <ServiceIcon id={id} />
              </span>
              <span className="service-btn__label">{labels[language]}</span>
            </button>
          ))}
        </div>
      </main>

      <div
        className={`confirmation${confirmation ? ' confirmation--visible' : ''}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <p className="confirmation__text">{confirmation ?? ''}</p>
      </div>
    </div>
  )
}

export default App
