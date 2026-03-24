import { useState, useEffect } from 'react'
import { Loader2, Filter, Search, Store, MapPin, ExternalLink, Instagram, Globe } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function BusinessList() {
  const [businesses, setBusinesses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filtros
  const [filterTipo, setFilterTipo] = useState('')
  const [filterLocalidad, setFilterLocalidad] = useState('')

  useEffect(() => {
    fetchBusinesses()
  }, [filterTipo, filterLocalidad])

  const fetchBusinesses = async () => {
    setLoading(true)
    setError('')
    
    try {
      let query = supabase
        .from('businesses')
        .select(`
          id,
          name,
          tipo_principal,
          localidad,
          sources (
            type,
            url
          )
        `)
        .order('id', { ascending: false })

      if (filterTipo) query = query.eq('tipo_principal', filterTipo)
      if (filterLocalidad) query = query.eq('localidad', filterLocalidad)

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError
      setBusinesses(data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getSourceUrl = (sources: any[], type: string) => {
    const source = sources?.find((s: any) => s.type === type)
    return source ? source.url : null
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Filters */}
      <div className="bg-neutral-900 p-4 rounded-3xl border border-neutral-800/80 shadow-sm flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Filtrar por Tipo</label>
          <select 
            value={filterTipo} 
            onChange={(e) => setFilterTipo(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-neutral-100 outline-none focus:border-blue-500"
          >
            <option value="">Todos los tipos</option>
            <option value="bodega">Bodega</option>
            <option value="hotel">Hotel</option>
            <option value="cabaña">Cabaña</option>
            <option value="restaurante">Restaurante</option>
            <option value="estudio_diseño">Estudio Diseño</option>
            <option value="arquitecto">Arquitecto</option>
            <option value="experiencia_turistica">Experiencia Turística</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Filtrar por Localidad</label>
          <select 
            value={filterLocalidad} 
            onChange={(e) => setFilterLocalidad(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-neutral-100 outline-none focus:border-blue-500"
          >
            <option value="">Todas las localidades</option>
            <option value="san rafael">San Rafael</option>
            <option value="tunuyan">Tunuyán</option>
            <option value="tupungato">Tupungato</option>
            <option value="gran mendoza">Gran Mendoza</option>
            <option value="otra">Otra</option>
          </select>
        </div>
      </div>

      {error && <div className="p-4 bg-red-950/50 border border-red-900 rounded-2xl text-red-300 text-sm font-medium">{error}</div>}

      {/* List */}
      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : businesses.length === 0 ? (
        <div className="text-center p-12 bg-neutral-900 rounded-3xl border border-neutral-800/80">
          <Store className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
          <p className="text-neutral-400">No se encontraron negocios con esos filtros.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {businesses.map((bz) => {
            const web = getSourceUrl(bz.sources, 'website')
            const insta = getSourceUrl(bz.sources, 'instagram')
            const maps = getSourceUrl(bz.sources, 'maps')

            return (
              <div key={bz.id} className="bg-neutral-900 p-5 rounded-3xl border border-neutral-800/80 hover:border-neutral-700 transition-colors flex flex-col h-full">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-1 line-clamp-1" title={bz.name}>{bz.name}</h3>
                  
                  <div className="flex flex-wrap gap-2 mt-3">
                    {bz.tipo_principal && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-900/30 text-blue-400 border border-blue-800/50">
                        <Store className="w-3 h-3 mr-1" />
                        {bz.tipo_principal}
                      </span>
                    )}
                    {bz.localidad && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-purple-900/30 text-purple-400 border border-purple-800/50">
                        <MapPin className="w-3 h-3 mr-1" />
                        {bz.localidad}
                      </span>
                    )}
                  </div>
                </div>

                {/* Enlaces */}
                <div className="mt-5 pt-4 border-t border-neutral-800/80 flex gap-3">
                  {web && (
                    <a href={web} target="_blank" rel="noopener noreferrer" className="p-2 bg-neutral-950 hover:bg-neutral-800 rounded-xl text-neutral-400 hover:text-white transition-colors" title="Website">
                      <Globe className="w-5 h-5" />
                    </a>
                  )}
                  {insta && (
                    <a href={insta} target="_blank" rel="noopener noreferrer" className="p-2 bg-neutral-950 hover:bg-neutral-800 rounded-xl text-neutral-400 hover:text-pink-400 transition-colors" title="Instagram">
                      <Instagram className="w-5 h-5" />
                    </a>
                  )}
                  {maps && (
                    <a href={maps} target="_blank" rel="noopener noreferrer" className="p-2 bg-neutral-950 hover:bg-neutral-800 rounded-xl text-neutral-400 hover:text-green-400 transition-colors" title="Google Maps">
                      <ExternalLink className="w-5 h-5" />
                    </a>
                  )}
                  {!web && !insta && !maps && (
                    <span className="text-xs text-neutral-600 block w-full text-center py-1">Sin enlaces registrados</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
