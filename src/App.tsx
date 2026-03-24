import { useState, useEffect } from 'react'
import { Combobox, ComboboxInput, ComboboxOptions, ComboboxOption } from '@headlessui/react'
import { Check, Loader2, LogOut } from 'lucide-react'
import { supabase } from './lib/supabase'
import { Session } from '@supabase/supabase-js'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)

  // Login variables
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  // Form Fields
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const [name, setName] = useState('')
  const [tipoQuery, setTipoQuery] = useState('')
  const [selectedTipo, setSelectedTipo] = useState('')
  const [subtipo, setSubtipo] = useState('')
  const [sensacion, setSensacion] = useState('')
  const [razon, setRazon] = useState('')
  const [urlWebsite, setUrlWebsite] = useState('')
  const [urlInstagram, setUrlInstagram] = useState('')
  const [urlMaps, setUrlMaps] = useState('')

  const [categories, setCategories] = useState<string[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoadingAuth(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Fetch categories only if authenticated
  useEffect(() => {
    if (!session) return;
    
    async function fetchCategories() {
      const { data, error } = await supabase
        .from('businesses')
        .select('tipo_principal')
        .neq('tipo_principal', null)

      if (data && !error) {
        const unique = Array.from(new Set(data.map(d => d.tipo_principal as string))).filter(Boolean)
        setCategories(unique)
      }
    }
    fetchCategories()
  }, [session])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoadingAuth(true)
    setLoginError('')
    
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setLoginError(error.message)
    }
    setLoadingAuth(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const filteredCategories = tipoQuery === ''
    ? categories
    : categories.filter((cat) => cat.toLowerCase().includes(tipoQuery.toLowerCase()))

  const showCreateOption = tipoQuery.length > 0 && !categories.some(c => c.toLowerCase() === tipoQuery.toLowerCase())

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .insert({
          name,
          tipo_principal: selectedTipo || tipoQuery, // Handles both selected and freshly typed categories
          subtipo,
          sensacion,
          razon
        })
        .select('id')
        .single()

      if (businessError) throw businessError
      const businessId = businessData.id

      const sourcesToInsert = []
      if (urlWebsite) sourcesToInsert.push({ business_id: businessId, type: 'website', url: urlWebsite, status: 'pending' })
      if (urlInstagram) sourcesToInsert.push({ business_id: businessId, type: 'instagram', url: urlInstagram, status: 'pending' })
      if (urlMaps) sourcesToInsert.push({ business_id: businessId, type: 'maps', url: urlMaps, status: 'pending' })

      if (sourcesToInsert.length > 0) {
        const { error: sourceError } = await supabase.from('sources').insert(sourcesToInsert)
        if (sourceError) throw sourceError
      }

      setSuccessMsg('Objetivo guardado exitosamente.')
      setName(''); setTipoQuery(''); setSelectedTipo(''); setSubtipo(''); setSensacion(''); setRazon('');
      setUrlWebsite(''); setUrlInstagram(''); setUrlMaps('');
      
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar el objetivo.')
    } finally {
      setLoading(false)
    }
  }

  if (loadingAuth) {
    return <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  }

  // --- LOGIN SCREEN ---
  if (!session) {
    return (
      <div className="min-h-screen bg-neutral-900 text-neutral-100 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-neutral-800 p-8 rounded-2xl border border-neutral-700 shadow-xl">
          <h1 className="text-2xl font-bold mb-2">Ingresar</h1>
          <p className="text-neutral-400 text-sm mb-6">Inicia sesión para cargar objetivos comerciales.</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">Email</label>
              <input 
                required type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full bg-neutral-900 border-neutral-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">Contraseña</label>
              <input 
                required type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full bg-neutral-900 border-neutral-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            {loginError && <p className="text-red-400 text-sm">{loginError}</p>}
            
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-medium mt-2">
              Entrar
            </button>
          </form>
        </div>
      </div>
    )
  }

  // --- MAIN APP SCREEN ---
  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 p-4 md:p-8 flex justify-center">
      <div className="w-full max-w-md">
        
        {/* Header con Logout */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Nuevo Objetivo</h1>
            <p className="text-neutral-400 text-sm mt-1">{session.user.email}</p>
          </div>
          <button onClick={handleLogout} className="p-2 text-neutral-400 hover:text-white bg-neutral-800 rounded-full">
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 pb-8">
          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Nombre del negocio *</label>
            <input 
              required
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej. Bodega Norton"
              className="w-full bg-neutral-800 border-neutral-700 rounded-xl px-4 py-3 text-neutral-100 focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-neutral-500"
            />
          </div>

          {/* Tipo Principal (Combobox) */}
          <div className="relative z-50">
            <label className="block text-sm font-medium text-neutral-300 mb-1">Tipo principal</label>
            <Combobox value={selectedTipo} onChange={setSelectedTipo} onClose={() => setTipoQuery('')}>
              <div className="relative">
                <ComboboxInput
                  className="w-full bg-neutral-800 border-neutral-700 rounded-xl px-4 py-3 text-neutral-100 focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-neutral-500"
                  displayValue={(item: string) => item}
                  placeholder="Ej. Bodega, Hotel, etc."
                  onChange={(event) => setTipoQuery(event.target.value)}
                />
                <ComboboxOptions className="absolute mt-1 max-h-60 w-full overflow-auto rounded-xl bg-neutral-800 border border-neutral-700 py-1 text-base shadow-lg z-50 focus:outline-none">
                  {filteredCategories.map((cat) => (
                    <ComboboxOption
                      key={cat}
                      value={cat}
                      className="group relative cursor-default select-none py-2 pl-4 pr-4 hover:bg-neutral-700 text-neutral-100 data-[focus]:bg-blue-600"
                    >
                      <span className="block truncate font-normal group-data-[selected]:font-medium">{cat}</span>
                    </ComboboxOption>
                  ))}
                  {showCreateOption && (
                    <ComboboxOption
                      value={tipoQuery}
                      className="group relative cursor-default select-none py-2 pl-4 pr-4 font-semibold text-blue-400 data-[focus]:bg-blue-600 data-[focus]:text-white"
                    >
                      Crear nueva categoría: "{tipoQuery}"
                    </ComboboxOption>
                  )}
                </ComboboxOptions>
              </div>
            </Combobox>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">Subtipo</label>
              <input type="text" value={subtipo} onChange={e => setSubtipo(e.target.value)} placeholder="Ej. Boutique" className="w-full bg-neutral-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">Sensación</label>
              <input type="text" value={sensacion} onChange={e => setSensacion(e.target.value)} placeholder="Ej. Rústico" className="w-full bg-neutral-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Concepto / Razón</label>
            <input type="text" value={razon} onChange={e => setRazon(e.target.value)} placeholder="¿Por qué lo elegimos?" className="w-full bg-neutral-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="pt-4 pb-2">
            <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">Enlaces Fuente (Sources)</h2>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Sitio Web</label>
            <input type="url" value={urlWebsite} onChange={e => setUrlWebsite(e.target.value)} placeholder="https://" className="w-full bg-neutral-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 placeholder-opacity-50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Instagram</label>
            <input type="url" value={urlInstagram} onChange={e => setUrlInstagram(e.target.value)} placeholder="https://instagram.com/..." className="w-full bg-neutral-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 placeholder-opacity-50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Google Maps</label>
            <input type="url" value={urlMaps} onChange={e => setUrlMaps(e.target.value)} placeholder="https://maps.app.goo.gl/..." className="w-full bg-neutral-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 placeholder-opacity-50" />
          </div>

          {errorMsg && <div className="p-3 bg-red-900/50 border border-red-500 rounded-xl text-red-200 text-sm">{errorMsg}</div>}
          {successMsg && <div className="p-3 bg-emerald-900/50 border border-emerald-500 rounded-xl text-emerald-200 text-sm">{successMsg}</div>}

          <div className="pt-4">
            <button type="submit" disabled={loading} className="w-full flex items-center justify-center p-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 rounded-xl text-white font-medium transition-colors">
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              {loading ? 'Procesando...' : 'Cargar y Analizar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
