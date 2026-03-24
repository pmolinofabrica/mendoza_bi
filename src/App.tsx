import { useState, useEffect } from 'react'
import { Loader2, LogOut } from 'lucide-react'
import { supabase } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'

const OPTIONS = {
  tipo_principal: ['bodega', 'hotel', 'cabaña', 'restaurante', 'estudio_diseño', 'arquitecto', 'experiencia_turistica'],
  subtipo: ['boutique', 'lujo', 'autor', 'familiar', 'corporativo', 'experimental', 'tradicional'],
  estetica: ['rustico', 'moderno', 'clasico'],
  nivel: ['lujo', 'medio', 'turistico'],
  intencion: ['relajacion', 'experiencia', 'exhibicion'],
  materialidad: ['natural', 'industrial', 'artesanal', 'tecnologico'],
  contexto: ['montaña', 'viñedo', 'urbano', 'aislado']
}

// Helpers para UI
const formatLabel = (txt: string) => txt.charAt(0).toUpperCase() + txt.slice(1).replace('_', ' ')

const ChipGroupSingle = ({ label, options, selected, onChange, required = false }: any) => (
  <div className="mb-5">
    <label className="block text-sm font-medium text-neutral-300 mb-2">
      {label} {required && <span className="text-blue-500">*</span>}
    </label>
    <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide snap-x">
      {options.map((opt: string) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`snap-start flex-shrink-0 px-4 py-2.5 rounded-full text-sm font-medium transition-all border ${
            selected === opt 
              ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-900/20' 
              : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200'
          }`}
        >
          {formatLabel(opt)}
        </button>
      ))}
    </div>
  </div>
)

const ChipGroupMulti = ({ label, options, selected, onChange, optional = false }: any) => {
  const toggle = (opt: string) => {
    if (selected.includes(opt)) onChange(selected.filter((x: string) => x !== opt))
    else onChange([...selected, opt])
  }
  return (
    <div className="mb-5">
      <label className="block text-sm font-medium text-neutral-300 mb-2">
        {label} {optional && <span className="text-neutral-500 font-normal text-xs ml-1">(Opcional, elige varios)</span>}
      </label>
      <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide snap-x">
        {options.map((opt: string) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`snap-start flex-shrink-0 px-4 py-2.5 rounded-full text-sm font-medium transition-all border ${
              selected.includes(opt)
                ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-900/20' 
                : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200'
            }`}
          >
            {formatLabel(opt)}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)

  // Login variables
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  // UI State
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Form Fields (Semánticos)
  const [name, setName] = useState('')
  const [urlWebsite, setUrlWebsite] = useState('')
  const [urlInstagram, setUrlInstagram] = useState('')
  const [urlMaps, setUrlMaps] = useState('')

  // Semantic Dimensions
  const [tipoPrincipal, setTipoPrincipal] = useState('')
  const [subtipos, setSubtipos] = useState<string[]>([])
  const [estetica, setEstetica] = useState('')
  const [nivel, setNivel] = useState('')
  const [intencion, setIntencion] = useState('')
  const [materialidades, setMaterialidades] = useState<string[]>([])
  const [contexto, setContexto] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoadingAuth(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoadingAuth(true)
    setLoginError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setLoginError(error.message)
    setLoadingAuth(false)
  }

  const handleLogout = async () => supabase.auth.signOut()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validaciones
    if (!tipoPrincipal || !estetica || !nivel || !intencion) {
      setErrorMsg('Faltan chips obligatorios (Tipo, Estética, Nivel o Intención)')
      return
    }

    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      // 1. Insertar negocio con la nueva estructura semántica
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .insert({
          name,
          tipo_principal: tipoPrincipal,
          subtipo: subtipos,
          estetica,
          nivel,
          intencion,
          materialidad: materialidades,
          contexto: contexto || null
        })
        .select('id')
        .single()

      if (businessError) throw businessError
      const businessId = businessData.id

      // 2. Insertar sources
      const sourcesToInsert = []
      if (urlWebsite) sourcesToInsert.push({ business_id: businessId, type: 'website', url: urlWebsite, status: 'pending' })
      if (urlInstagram) sourcesToInsert.push({ business_id: businessId, type: 'instagram', url: urlInstagram, status: 'pending' })
      if (urlMaps) sourcesToInsert.push({ business_id: businessId, type: 'maps', url: urlMaps, status: 'pending' })

      if (sourcesToInsert.length > 0) {
        const { error: sourceError } = await supabase.from('sources').insert(sourcesToInsert)
        if (sourceError) throw sourceError
      }

      setSuccessMsg(`¡${name} guardado con éxito!`)
      
      // Reset
      setName(''); setUrlWebsite(''); setUrlInstagram(''); setUrlMaps('');
      setTipoPrincipal(''); setSubtipos([]); setEstetica(''); setNivel(''); setIntencion(''); setMaterialidades([]); setContexto('');
      
      // Scroll top
      window.scrollTo({ top: 0, behavior: 'smooth' })
      
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar el objetivo.')
    } finally {
      setLoading(false)
    }
  }

  if (loadingAuth) {
    return <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-neutral-900 text-neutral-100 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-neutral-800 p-8 rounded-3xl border border-neutral-700 shadow-xl">
          <h1 className="text-2xl font-bold mb-2">Mendoza BI</h1>
          <p className="text-neutral-400 text-sm mb-6">Inicia sesión para acceder al framework de ingesta.</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">Email</label>
              <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">Contraseña</label>
              <input required type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {loginError && <p className="text-red-400 text-sm">{loginError}</p>}
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-medium mt-2 transition-colors">Entrar</button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-4 md:p-8 flex justify-center">
      <div className="w-full max-w-md">
        
        <div className="flex justify-between items-center mb-6 pt-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Ingesta Rápida</h1>
            <p className="text-neutral-400 text-xs mt-1 uppercase tracking-wider font-semibold">Base de Percepción Humana</p>
          </div>
          <button onClick={handleLogout} className="p-3 text-neutral-400 hover:text-white bg-neutral-900 rounded-full transition-colors border border-neutral-800">
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {successMsg && <div className="mb-6 p-4 bg-emerald-950/50 border border-emerald-900 rounded-2xl text-emerald-300 text-sm font-medium">{successMsg}</div>}
        {errorMsg && <div className="mb-6 p-4 bg-red-950/50 border border-red-900 rounded-2xl text-red-300 text-sm font-medium">{errorMsg}</div>}

        <form onSubmit={handleSubmit} className="space-y-8 pb-12">
          
          {/* IDENTIFICACIÓN */}
          <section className="bg-neutral-900 p-5 rounded-3xl border border-neutral-800/80 shadow-sm">
            <label className="block text-sm font-medium text-neutral-200 mb-2">Nombre del Negocio <span className="text-blue-500">*</span></label>
            <input 
              required type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Bodega Norton"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl px-4 py-3 text-neutral-100 focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-neutral-600"
            />
          </section>

          {/* ESTRUCTURA DURA */}
          <section className="bg-neutral-900 p-5 rounded-3xl border border-neutral-800/80 shadow-sm">
            <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-4 border-b border-neutral-800 pb-2">Clasificación Base</h2>
            <ChipGroupSingle label="1. Tipo Principal" required options={OPTIONS.tipo_principal} selected={tipoPrincipal} onChange={setTipoPrincipal} />
            <ChipGroupMulti label="2. Subtipo (Posicionamiento)" optional options={OPTIONS.subtipo} selected={subtipos} onChange={setSubtipos} />
          </section>

          {/* SENSACIÓN / TRÍPTICOS */}
          <section className="bg-neutral-900 p-5 rounded-3xl border border-neutral-800/80 shadow-sm">
            <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-4 border-b border-neutral-800 pb-2">Percepción & Sensación</h2>
            <ChipGroupSingle label="A. Estética" required options={OPTIONS.estetica} selected={estetica} onChange={setEstetica} />
            <ChipGroupSingle label="B. Nivel" required options={OPTIONS.nivel} selected={nivel} onChange={setNivel} />
            <ChipGroupSingle label="C. Intención" required options={OPTIONS.intencion} selected={intencion} onChange={setIntencion} />
          </section>

          {/* OPCIONALES FÍSICAS */}
          <section className="bg-neutral-900 p-5 rounded-3xl border border-neutral-800/80 shadow-sm">
            <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-4 border-b border-neutral-800 pb-2">Detalles de Entorno</h2>
            <ChipGroupMulti label="D. Materialidad Predominante" optional options={OPTIONS.materialidad} selected={materialidades} onChange={setMaterialidades} />
            <ChipGroupSingle label="E. Contexto" options={OPTIONS.contexto} selected={contexto} onChange={setContexto} />
          </section>

          {/* FUENTES */}
          <section className="bg-neutral-900 p-5 rounded-3xl border border-neutral-800/80 shadow-sm">
            <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-4 border-b border-neutral-800 pb-2">Enlaces Fuente (IA)</h2>
            <div className="space-y-3">
              <input type="url" value={urlWebsite} onChange={e => setUrlWebsite(e.target.value)} placeholder="🌐 Sitio Web (https://)" className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-blue-500 placeholder-neutral-600 text-sm" />
              <input type="url" value={urlInstagram} onChange={e => setUrlInstagram(e.target.value)} placeholder="📸 Instagram (https://)" className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-blue-500 placeholder-neutral-600 text-sm" />
              <input type="url" value={urlMaps} onChange={e => setUrlMaps(e.target.value)} placeholder="🗺️ Google Maps (https://)" className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-blue-500 placeholder-neutral-600 text-sm" />
            </div>
          </section>

          <button type="submit" disabled={loading} className="w-full flex items-center justify-center p-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] disabled:bg-blue-800 disabled:opacity-70 rounded-2xl text-white font-bold transition-all shadow-lg shadow-blue-900/30 text-lg">
            {loading ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : null}
            {loading ? 'Procesando...' : 'Cargar Percepción al Sistema'}
          </button>
        </form>
      </div>
    </div>
  )
}
