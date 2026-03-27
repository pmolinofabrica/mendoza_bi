import { useState, useEffect } from 'react'
import { Combobox, ComboboxInput, ComboboxOptions, ComboboxOption } from '@headlessui/react'
import { Loader2, LogOut, UploadCloud } from 'lucide-react'
import { supabase } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'
import Papa from 'papaparse'

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

  // CSV Upload state
  const [uploadingCsv, setUploadingCsv] = useState(false)
  const [csvProgress, setCsvProgress] = useState('')
  const [csvError, setCsvError] = useState('')
  const [csvSuccess, setCsvSuccess] = useState('')

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
      
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar el objetivo.')
    } finally {
      setLoading(false)
    }
  }

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingCsv(true)
    setCsvProgress('Leyendo archivo...')
    setCsvError('')
    setCsvSuccess('')

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as Record<string, string>[]
        if (rows.length === 0) {
          setCsvError('El archivo CSV está vacío.')
          setUploadingCsv(false)
          return
        }

        let successCount = 0
        let errorCount = 0

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]
          setCsvProgress(`Procesando registro ${i + 1} de ${rows.length}...`)

          try {
            // Mapping from CSV headers (name, tipo_principal, subtipo, sensacion, razon, urlWebsite, urlInstagram, urlMaps)
            const { data: businessData, error: businessError } = await supabase
              .from('businesses')
              .insert({
                name: row.name || row.Nombre || row.nombre || 'Sin nombre',
                tipo_principal: row.tipo_principal || row.Tipo || row.tipo || '',
                subtipo: row.subtipo || row.Subtipo || '',
                sensacion: row.sensacion || row.Sensacion || '',
                razon: row.razon || row.Razon || row.Razón || ''
              })
              .select('id')
              .single()

            if (businessError) throw businessError
            const businessId = businessData.id

            const sourcesToInsert = []

            const website = row.urlWebsite || row.Website || row.website
            if (website) sourcesToInsert.push({ business_id: businessId, type: 'website', url: website, status: 'pending' })

            const instagram = row.urlInstagram || row.Instagram || row.instagram
            if (instagram) sourcesToInsert.push({ business_id: businessId, type: 'instagram', url: instagram, status: 'pending' })

            const maps = row.urlMaps || row.Maps || row.maps
            if (maps) sourcesToInsert.push({ business_id: businessId, type: 'maps', url: maps, status: 'pending' })

            if (sourcesToInsert.length > 0) {
              const { error: sourceError } = await supabase.from('sources').insert(sourcesToInsert)
              if (sourceError) throw sourceError
            }
            successCount++
          } catch (err: unknown) {
            console.error(`Error en la fila ${i + 1}:`, err)
            errorCount++
          }
        }

        setCsvProgress('')
        setUploadingCsv(false)
        if (errorCount > 0) {
          setCsvError(`Se procesaron ${successCount} registros, pero fallaron ${errorCount}.`)
        } else {
          setCsvSuccess(`¡Se importaron ${successCount} registros con éxito!`)
        }

        // Refresh categories
        const { data } = await supabase.from('businesses').select('tipo_principal').neq('tipo_principal', null)
        if (data) {
          const unique = Array.from(new Set(data.map(d => d.tipo_principal as string))).filter(Boolean)
          setCategories(unique)
        }
      },
      error: (err) => {
        setCsvError('Error al leer el archivo CSV: ' + err.message)
        setUploadingCsv(false)
      }
    })

    // Reset file input
    e.target.value = ''
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

        {/* Carga Masiva CSV */}
        <div className="mb-8 p-6 bg-neutral-800 rounded-2xl border border-neutral-700">
          <h2 className="text-lg font-semibold mb-2 flex items-center">
            <UploadCloud className="w-5 h-5 mr-2 text-blue-400" />
            Carga Masiva (CSV)
          </h2>
          <p className="text-sm text-neutral-400 mb-4">
            Asegúrate de que el archivo tenga cabeceras (name, tipo_principal, subtipo, sensacion, razon, urlWebsite, urlInstagram, urlMaps).
          </p>

          <div className="relative">
            <input
              type="file"
              accept=".csv"
              onChange={handleCsvUpload}
              disabled={uploadingCsv}
              className="block w-full text-sm text-neutral-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-xl file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-600 file:text-white
                hover:file:bg-blue-500
                disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {uploadingCsv && (
            <div className="mt-4 flex items-center text-sm text-blue-400">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              {csvProgress}
            </div>
          )}

          {csvError && <div className="mt-4 p-3 bg-red-900/50 border border-red-500 rounded-xl text-red-200 text-sm">{csvError}</div>}
          {csvSuccess && <div className="mt-4 p-3 bg-emerald-900/50 border border-emerald-500 rounded-xl text-emerald-200 text-sm">{csvSuccess}</div>}
        </div>

        <div className="flex items-center mb-6">
          <div className="flex-grow border-t border-neutral-700"></div>
          <span className="mx-4 text-sm text-neutral-500 font-medium">O carga manual</span>
          <div className="flex-grow border-t border-neutral-700"></div>
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
            <Combobox value={selectedTipo} onChange={(val) => setSelectedTipo(val || '')} onClose={() => setTipoQuery('')}>
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
