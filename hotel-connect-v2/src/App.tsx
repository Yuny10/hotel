import { useCallback, useEffect, useState } from 'react'

import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom'

import './App.css'

import Dashboard from './Dashboard'
import DepartamentoLimpieza from './pages/DepartamentoLimpieza'

import {
  GUEST_INCIDENCIA_CATALOG,
  UI_SERVICE_TO_CATALOG,
  type GuestUiServiceId,
} from './lib/guestIncidenciaCatalog'

import {
  insertIncidenciaFromGuestService,
  type GuestLanguageId,
} from './services/incidenciasSupabase'



const N8N_WEBHOOK_URL =

  'https://hotelconnect.app.n8n.cloud/webhook/1da76843-0af4-4626-9f08-34c4ceae05ad'



type Language = GuestLanguageId



const LANGUAGES: { code: Language; flag: string; flagCdn: string; label: string }[] = [

  { code: 'es', flag: '🇪🇸', flagCdn: 'es', label: 'Español' },

  { code: 'en', flag: '🇬🇧', flagCdn: 'gb', label: 'English' },

  { code: 'de', flag: '🇩🇪', flagCdn: 'de', label: 'Deutsch' },

  { code: 'fr', flag: '🇫🇷', flagCdn: 'fr', label: 'Français' },

]



const WELCOME: Record<Language, string> = {

  es: 'Bienvenido a Hotel Connect. Solicite cualquier servicio o incidencia en segundos.',

  en: 'Welcome to Hotel Connect. Request any service or report any issue in seconds.',

  fr: 'Bienvenue sur Hotel Connect. Demandez un service ou signalez un problème en quelques secondes.',

  de: 'Willkommen bei Hotel Connect. Fordern Sie Dienstleistungen an oder melden Sie Probleme in wenigen Sekunden.',

}



const COPY: Record<

  Language,

  {

    title: string

    roomLabel: string

    confirmations: Record<GuestUiServiceId, string>

  }

> = {

  es: {

    title: '¿Cómo podemos ayudarte?',

    roomLabel: 'Habitación',

    confirmations: {

      towels:

        'Solicitud enviada. En breve, el servicio de limpieza le facilitará las toallas.',

      cleaning:

        'Solicitud enviada. En breve, el equipo de limpieza atenderá su habitación.',

      ac: 'Solicitud enviada. En breve, mantenimiento revisará el aire acondicionado.',

      blanket: 'Solicitud enviada. En breve, el servicio de limpieza le facilitará la manta.',

      other:

        'Solicitud enviada. En breve, recepción atenderá su solicitud.',

    },

  },

  en: {

    title: 'How can we help you?',

    roomLabel: 'Room',

    confirmations: {

      towels: 'Request sent. Housekeeping will bring towels shortly.',

      cleaning: 'Request sent. Housekeeping will attend your room shortly.',

      ac: 'Request sent. Maintenance will check the air conditioning shortly.',

      blanket: 'Request sent. Housekeeping will bring a blanket shortly.',

      other: 'Request sent. Reception will attend your request shortly.',

    },

  },

  de: {

    title: 'Wie können wir Ihnen helfen?',

    roomLabel: 'Zimmer',

    confirmations: {

      towels:

        'Anfrage gesendet. Der Reinigungsservice bringt Ihnen in Kürze Handtücher.',

      cleaning:

        'Anfrage gesendet. Das Reinigungsteam wird Ihr Zimmer in Kürze betreuen.',

      ac: 'Anfrage gesendet. Die Wartung wird die Klimaanlage in Kürze überprüfen.',

      blanket: 'Anfrage gesendet. Der Reinigungsservice bringt Ihnen in Kürze eine Decke.',

      other: 'Anfrage gesendet. Die Rezeption wird Ihre Anfrage in Kürze bearbeiten.',

    },

  },

  fr: {

    title: 'Comment pouvons-nous vous aider ?',

    roomLabel: 'Chambre',

    confirmations: {

      towels:

        'Demande envoyée. Le service de ménage vous apportera des serviettes sous peu.',

      cleaning:
        "Demande envoyée. L'équipe de ménage s'occupera bientôt de votre chambre.",

      ac: 'Demande envoyée. La maintenance vérifiera bientôt la climatisation.',

      blanket: 'Demande envoyée. Le service de ménage vous apportera une couverture sous peu.',

      other: 'Demande envoyée. La réception traitera bientôt votre demande.',

    },

  },

}



const SERVICES: { id: GuestUiServiceId; labels: Record<Language, string> }[] = [

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

    id: 'blanket',

    labels: { en: 'Blanket', es: 'Manta', de: 'Decke', fr: 'Couverture' },

  },

  {

    id: 'other',

    labels: { en: 'Other', es: 'Otro', de: 'Sonstiges', fr: 'Autre' },

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

    case 'blanket':

      return (

        <svg {...iconProps}>

          <path d="M4 10h16v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19V10z" />

          <path d="M4 10c0-2 2-4 4-4h8c2 0 4 2 4 4" />

          <path d="M8 14h8" />

        </svg>

      )

    case 'other':

      return (

        <svg {...iconProps}>

          <circle cx="12" cy="12" r="9" />

          <path d="M12 8v4M12 16h.01" />

        </svg>

      )

    default:

      return null

  }

}



function GuestApp() {

  const { roomNumber } = useParams<{ roomNumber?: string }>()

  const room = roomNumber ?? '203'



  const [language, setLanguage] = useState<Language>('en')

  const [languageSelected, setLanguageSelected] = useState(false)

  const [showWelcome, setShowWelcome] = useState(true)

  const [welcomeIndex, setWelcomeIndex] = useState(0)

  const [confirmation, setConfirmation] = useState<string | null>(null)

  const [selectedService, setSelectedService] = useState<GuestUiServiceId | null>(null)



  const showConfirmation = useCallback(

    (serviceId: GuestUiServiceId) => {

      const catalogKey = UI_SERVICE_TO_CATALOG[serviceId]

      const spec = GUEST_INCIDENCIA_CATALOG[catalogKey]

      const habitacion = Number.parseInt(room, 10)

      const habitacionValue = Number.isFinite(habitacion) ? habitacion : room



      setSelectedService(serviceId)

      setConfirmation(COPY[language].confirmations[serviceId])



      fetch(N8N_WEBHOOK_URL, {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({

          habitacion: habitacionValue,

          tipo_incidencia: spec.tipo_incidencia,

          departamento: spec.departamento,

          estado: spec.estado,

          prioridad: spec.prioridad,

          idioma: language,

        }),

      }).catch(() => {})



      insertIncidenciaFromGuestService(room, catalogKey).catch((error) => {

        console.error('Supabase insert incidencia huésped:', error)

      })

    },

    [language, room],

  )



  useEffect(() => {

    if (!confirmation) return

    const timer = window.setTimeout(() => setConfirmation(null), 3200)

    return () => window.clearTimeout(timer)

  }, [confirmation])



  useEffect(() => {

    if (selectedService) {

      setConfirmation(COPY[language].confirmations[selectedService])

    }

  }, [language, selectedService])



  useEffect(() => {

    if (!showWelcome) return

    if (welcomeIndex < 3) {

      const timer = window.setTimeout(() => setWelcomeIndex((i) => i + 1), 2500)

      return () => window.clearTimeout(timer)

    }

    const timer = window.setTimeout(() => setShowWelcome(false), 2500)

    return () => window.clearTimeout(timer)

  }, [showWelcome, welcomeIndex])



  const { title, roomLabel } = COPY[language]



  if (showWelcome) {

    const welcomeMessages = [WELCOME.es, WELCOME.en, WELCOME.fr, WELCOME.de]

    return (

      <div className="guest-app">

        <main

          className="guest-main"

          style={{

            flex: 1,

            display: 'flex',

            alignItems: 'center',

            justifyContent: 'center',

            padding: '0 1.5rem',

          }}

        >

          <p

            className="guest-title"

            style={{

              margin: 0,

              fontSize: 'clamp(1.35rem, 5vw, 2rem)',

              fontWeight: 300,

              lineHeight: 1.45,

              letterSpacing: '0.01em',

            }}

          >

            {welcomeMessages[welcomeIndex]}

          </p>

        </main>

      </div>

    )

  }



  if (!languageSelected) {

    return (

      <div className="guest-app">

        <header className="guest-header">

          <div className="room-badge">

            <span className="room-badge__number" aria-hidden="true">

              🏨

            </span>

          </div>

        </header>



        <main className="guest-main">

          <nav className="language-nav" aria-label="Language">

            {LANGUAGES.map(({ code, flagCdn, label }) => (

              <button

                key={code}

                type="button"

                className="language-btn"

                onClick={() => {

                  setLanguage(code)

                  setLanguageSelected(true)

                }}

              >

                <span className="language-btn__flag" aria-hidden="true">

                  <img

                    src={`https://flagcdn.com/w40/${flagCdn}.png`}

                    srcSet={`https://flagcdn.com/w80/${flagCdn}.png 2x`}

                    alt=""

                    width={24}

                    height={18}

                    loading="lazy"

                    decoding="async"

                    style={{

                      display: 'block',

                      borderRadius: '3px',

                      objectFit: 'cover',

                      boxShadow: '0 1px 4px rgba(0, 0, 0, 0.25)',

                    }}

                  />

                </span>

                <span className="language-btn__label">{label}</span>

              </button>

            ))}

          </nav>

        </main>

      </div>

    )

  }



  return (

    <div className="guest-app">

      <button

        type="button"

        className="back-btn"

        onClick={() => setLanguageSelected(false)}

      >

        ← Back

      </button>

      <header className="guest-header">

        <div className="room-badge">

          <span className="room-badge__label">{roomLabel}</span>

          <span className="room-badge__number">{room}</span>

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

              onClick={() => showConfirmation(id)}

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



function App() {

  return (

    <BrowserRouter>

      <Routes>

        <Route path="/dashboard" element={<Dashboard />} />

        <Route path="/departamento/limpieza" element={<DepartamentoLimpieza />} />

        <Route path="/guest/:roomNumber" element={<GuestApp />} />

        <Route path="*" element={<GuestApp />} />

      </Routes>

    </BrowserRouter>

  )

}



export default App

