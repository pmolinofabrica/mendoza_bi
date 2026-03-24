import { useState, useEffect } from 'react'
import { Loader2, LogOut, PlusCircle, List as ListIcon } from 'lucide-react'
import { supabase } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'

import IngestionForm from './components/IngestionForm'
import BusinessList from './components/BusinessList'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)

  // Login variables
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  // View state
  const [view, setView] = useState<'form' | 'list'>('form')

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
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-4 md:p-6 lg:p-8 flex justify-center">
      <div className="w-full max-w-3xl">
        
        {/* Header with Navigation */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8 pt-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Mendoza BI</h1>
            <p className="text-neutral-400 text-xs mt-1 uppercase tracking-wider font-semibold">
              {view === 'form' ? 'Nueva Ingesta' : 'Listado de Negocios'}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex bg-neutral-900 p-1 rounded-2xl border border-neutral-800">
              <button 
                onClick={() => setView('form')}
                className={`flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-all ${view === 'form' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200'}`}
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                Ingesta
              </button>
              <button 
                onClick={() => setView('list')}
                className={`flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-all ${view === 'list' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200'}`}
              >
                <ListIcon className="w-4 h-4 mr-2" />
                Explorar
              </button>
            </div>
            
            <button onClick={handleLogout} className="p-3 text-neutral-400 hover:text-white bg-neutral-900 rounded-2xl transition-colors border border-neutral-800 ml-2" title="Cerrar sesión">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dynamic View */}
        {view === 'form' ? <IngestionForm /> : <BusinessList />}
        
      </div>
    </div>
  )
}
