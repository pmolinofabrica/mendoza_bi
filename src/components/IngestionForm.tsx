import { useState } from 'react'
import { Loader2, UploadCloud } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Papa from 'papaparse'

const OPTIONS = {
  tipo_principal: ['bodega', 'hotel', 'cabaña', 'restaurante', 'estudio_diseño', 'arquitecto', 'experiencia_turistica'],
  localidad: ['san rafael', 'tunuyan', 'tupungato', 'gran mendoza', 'otra'],
  subtipo: ['boutique', 'lujo', 'autor', 'familiar', 'corporativo', 'experimental', 'tradicional'],
  estetica: ['rustico', 'moderno', 'clasico'],
  nivel: ['lujo', 'medio', 'turistico'],
  intencion: ['relajacion', 'experiencia', 'exhibicion'],
  materialidad: ['natural', 'industrial', 'artesanal', 'tecnologico'],
  contexto: ['montaña', 'viñedo', 'urbano', 'aislado']
}

const formatLabel = (txt: string) => txt.charAt(0).toUpperCase() + txt.slice(1).replace('_', ' ')

const ChipGroupSingle = ({ label, options, selected, onChange, required = false }: {
  label: string;
  options: string[];
  selected: string;
  onChange: (val: string) => void;
  required?: boolean;
}) => (
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

const ChipGroupMulti = ({ label, options, selected, onChange, optional = false }: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
  optional?: boolean;
}) => {
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

export default function IngestionForm() {
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const [name, setName] = useState('')
  const [urlWebsite, setUrlWebsite] = useState('')
  const [urlInstagram, setUrlInstagram] = useState('')
  const [urlMaps, setUrlMaps] = useState('')

  const [tipoPrincipal, setTipoPrincipal] = useState('')
  const [localidad, setLocalidad] = useState('')
  const [subtipos, setSubtipos] = useState<string[]>([])
  const [estetica, setEstetica] = useState('')
  const [nivel, setNivel] = useState('')
  const [intencion, setIntencion] = useState('')
  const [materialidades, setMaterialidades] = useState<string[]>([])
  const [contexto, setContexto] = useState('')

  // CSV Upload state
  const [uploadingCsv, setUploadingCsv] = useState(false)
  const [csvProgress, setCsvProgress] = useState('')
  const [csvError, setCsvError] = useState('')
  const [csvSuccess, setCsvSuccess] = useState('')

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
            // Helpers for splitting arrays (like materialidad, subtipo)
            const parseArray = (val: string) => val ? val.split(',').map(s => s.trim()) : []

            // Insert into businesses
            const { data: businessData, error: businessError } = await supabase
              .from('businesses')
              .insert({
                name: row.name || row.Nombre || row.nombre || 'Sin nombre',
                tipo_principal: row.tipo_principal || row.Tipo || row.tipo || '',
                localidad: row.localidad || row.Localidad || '',
                subtipo: parseArray(row.subtipo || row.Subtipos || row.subtipos || ''),
                estetica: row.estetica || row.Estetica || row.Estética || '',
                nivel: row.nivel || row.Nivel || '',
                intencion: row.intencion || row.Intencion || row.Intención || '',
                materialidad: parseArray(row.materialidad || row.Materialidades || row.materialidades || ''),
                contexto: row.contexto || row.Contexto || null,
                website_url: row.urlWebsite || row.Website || row.website_url || null,
                instagram_url: row.urlInstagram || row.Instagram || row.instagram_url || null,
                maps_url: row.urlMaps || row.Maps || row.maps_url || null
              })
              .select('id')
              .single()

            if (businessError) throw businessError
            const businessId = businessData.id

            const sourcesToInsert = []

            const website = row.urlWebsite || row.Website || row.website_url
            if (website) sourcesToInsert.push({ business_id: businessId, type: 'website', url: website, status: 'pending' })

            const instagram = row.urlInstagram || row.Instagram || row.instagram_url
            if (instagram) sourcesToInsert.push({ business_id: businessId, type: 'instagram', url: instagram, status: 'pending' })

            const maps = row.urlMaps || row.Maps || row.maps_url
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
      },
      error: (err) => {
        setCsvError('Error al leer el archivo CSV: ' + err.message)
        setUploadingCsv(false)
      }
    })

    // Reset file input
    e.target.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!tipoPrincipal || !localidad || !estetica || !nivel || !intencion) {
      setErrorMsg('Faltan chips obligatorios (Tipo, Localidad, Estética, Nivel o Intención)')
      return
    }

    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .insert({
          name,
          tipo_principal: tipoPrincipal,
          localidad,
          subtipo: subtipos,
          estetica,
          nivel,
          intencion,
          materialidad: materialidades,
          contexto: contexto || null,
          website_url: urlWebsite || null,
          instagram_url: urlInstagram || null,
          maps_url: urlMaps || null
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

      setSuccessMsg(`¡${name} guardado con éxito!`)

      setName(''); setUrlWebsite(''); setUrlInstagram(''); setUrlMaps('');
      setTipoPrincipal(''); setLocalidad(''); setSubtipos([]); setEstetica(''); setNivel(''); setIntencion(''); setMaterialidades([]); setContexto('');

      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar el objetivo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-in fade-in duration-300">

      {/* Carga Masiva CSV */}
      <div className="mb-8 p-6 bg-neutral-900 rounded-3xl border border-neutral-800 shadow-sm">
        <h2 className="text-lg font-semibold mb-2 flex items-center text-neutral-200">
          <UploadCloud className="w-5 h-5 mr-2 text-blue-500" />
          Carga Masiva (CSV)
        </h2>
        <p className="text-sm text-neutral-400 mb-4">
          Carga un archivo CSV. Cabeceras sugeridas: name, tipo_principal, localidad, subtipo (separado por comas), estetica, nivel, intencion, materialidad (separado por comas), contexto, urlWebsite, urlInstagram, urlMaps.
        </p>

        <div className="relative">
          <input
            type="file"
            accept=".csv"
            onChange={handleCsvUpload}
            disabled={uploadingCsv}
            className="block w-full text-sm text-neutral-400
              file:mr-4 file:py-2.5 file:px-5
              file:rounded-xl file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-600/20 file:text-blue-400
              hover:file:bg-blue-600/30
              disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          />
        </div>

        {uploadingCsv && (
          <div className="mt-4 flex items-center text-sm text-blue-400 font-medium">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            {csvProgress}
          </div>
        )}

        {csvError && <div className="mt-4 p-3 bg-red-950/50 border border-red-900 rounded-xl text-red-300 text-sm font-medium">{csvError}</div>}
        {csvSuccess && <div className="mt-4 p-3 bg-emerald-950/50 border border-emerald-900 rounded-xl text-emerald-300 text-sm font-medium">{csvSuccess}</div>}
      </div>

      <div className="flex items-center mb-8">
        <div className="flex-grow border-t border-neutral-800"></div>
        <span className="mx-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">O Ingesta Manual</span>
        <div className="flex-grow border-t border-neutral-800"></div>
      </div>

      {successMsg && <div className="mb-6 p-4 bg-emerald-950/50 border border-emerald-900 rounded-2xl text-emerald-300 text-sm font-medium">{successMsg}</div>}
      {errorMsg && <div className="mb-6 p-4 bg-red-950/50 border border-red-900 rounded-2xl text-red-300 text-sm font-medium">{errorMsg}</div>}

      <form onSubmit={handleSubmit} className="space-y-8 pb-12">
        <section className="bg-neutral-900 p-5 rounded-3xl border border-neutral-800/80 shadow-sm">
          <label className="block text-sm font-medium text-neutral-200 mb-2">Nombre del Negocio <span className="text-blue-500">*</span></label>
          <input
            required type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Bodega Norton"
            className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl px-4 py-3 text-neutral-100 focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-neutral-600"
          />
        </section>

        <section className="bg-neutral-900 p-5 rounded-3xl border border-neutral-800/80 shadow-sm">
          <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-4 border-b border-neutral-800 pb-2">Clasificación Base</h2>
          <ChipGroupSingle label="1. Tipo Principal" required options={OPTIONS.tipo_principal} selected={tipoPrincipal} onChange={setTipoPrincipal} />
          <ChipGroupSingle label="2. Localidad" required options={OPTIONS.localidad} selected={localidad} onChange={setLocalidad} />
          <ChipGroupMulti label="3. Subtipo (Posicionamiento)" optional options={OPTIONS.subtipo} selected={subtipos} onChange={setSubtipos} />
        </section>

        <section className="bg-neutral-900 p-5 rounded-3xl border border-neutral-800/80 shadow-sm">
          <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-4 border-b border-neutral-800 pb-2">Percepción & Sensación</h2>
          <ChipGroupSingle label="A. Estética" required options={OPTIONS.estetica} selected={estetica} onChange={setEstetica} />
          <ChipGroupSingle label="B. Nivel" required options={OPTIONS.nivel} selected={nivel} onChange={setNivel} />
          <ChipGroupSingle label="C. Intención" required options={OPTIONS.intencion} selected={intencion} onChange={setIntencion} />
        </section>

        <section className="bg-neutral-900 p-5 rounded-3xl border border-neutral-800/80 shadow-sm">
          <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-4 border-b border-neutral-800 pb-2">Detalles de Entorno</h2>
          <ChipGroupMulti label="D. Materialidad Predominante" optional options={OPTIONS.materialidad} selected={materialidades} onChange={setMaterialidades} />
          <ChipGroupSingle label="E. Contexto" options={OPTIONS.contexto} selected={contexto} onChange={setContexto} />
        </section>

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
  )
}
