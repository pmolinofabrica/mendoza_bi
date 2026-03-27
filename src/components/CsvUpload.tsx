import { useState, useRef } from 'react'
import { Upload, AlertCircle, CheckCircle2, FileText, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { OPTIONS } from './IngestionForm'

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────
interface CsvRow {
  name: string
  tipo_principal: string
  localidad: string
  subtipo: string        // pipe-separated
  estetica: string
  nivel: string
  intencion: string
  materialidad: string   // pipe-separated
  contexto: string
  website_url: string
  instagram_url: string
  maps_url: string
}

interface RowResult {
  row: number
  name: string
  status: 'ok' | 'error' | 'warning'
  message: string
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────
const REQUIRED_HEADERS = [
  'name', 'tipo_principal', 'localidad', 'subtipo', 'estetica',
  'nivel', 'intencion', 'materialidad', 'contexto',
  'website_url', 'instagram_url', 'maps_url'
]

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split('\n').map(l => l.replace(/\r$/, ''))
  const headers = lines[0].toLowerCase().split(',').map(h => h.trim())
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = line.split(',').map(v => v.trim())
    const obj: any = {}
    headers.forEach((h, i) => { obj[h] = values[i] ?? '' })
    return obj as CsvRow
  })
}

function validateRow(row: CsvRow, idx: number): string | null {
  if (!row.name) return `Fila ${idx + 2}: "name" vacío`
  if (!OPTIONS.tipo_principal.includes(row.tipo_principal))
    return `Fila ${idx + 2} (${row.name}): tipo_principal inválido → "${row.tipo_principal}"`
  if (!OPTIONS.localidad.includes(row.localidad))
    return `Fila ${idx + 2} (${row.name}): localidad inválida → "${row.localidad}"`
  if (!OPTIONS.estetica.includes(row.estetica))
    return `Fila ${idx + 2} (${row.name}): estetica inválida → "${row.estetica}"`
  if (!OPTIONS.nivel.includes(row.nivel))
    return `Fila ${idx + 2} (${row.name}): nivel inválido → "${row.nivel}"`
  if (!OPTIONS.intencion.includes(row.intencion))
    return `Fila ${idx + 2} (${row.name}): intencion inválida → "${row.intencion}"`
  return null
}

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────
export default function CsvUpload() {
  const [rows, setRows] = useState<CsvRow[]>([])
  const [fileName, setFileName] = useState('')
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [results, setResults] = useState<RowResult[]>([])
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    setResults([]); setDone(false)
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const parsed = parseCsv(text)
      const errors: string[] = []

      // Check headers
      const headers = text.split('\n')[0].toLowerCase().split(',').map(h => h.trim())
      const missing = REQUIRED_HEADERS.filter(h => !headers.includes(h))
      if (missing.length) errors.push(`Faltan columnas: ${missing.join(', ')}`)

      // Validate each row
      parsed.forEach((row, i) => {
        const err = validateRow(row, i)
        if (err) errors.push(err)
      })

      setValidationErrors(errors)
      setRows(parsed)
    }
    reader.readAsText(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file?.name.endsWith('.csv')) handleFile(file)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleUpload = async () => {
    if (!rows.length || validationErrors.length) return
    setLoading(true); setResults([]); setDone(false)

    const batchResults: RowResult[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      try {
        const subtipoArr = row.subtipo ? row.subtipo.split('|').map(s => s.trim()).filter(Boolean) : []
        const materialidadArr = row.materialidad ? row.materialidad.split('|').map(s => s.trim()).filter(Boolean) : []

        const { data: bizData, error: bizError } = await supabase
          .from('businesses')
          .insert({
            name: row.name,
            tipo_principal: row.tipo_principal,
            localidad: row.localidad,
            subtipo: subtipoArr,
            estetica: row.estetica,
            nivel: row.nivel,
            intencion: row.intencion,
            materialidad: materialidadArr,
            contexto: row.contexto || null,
            website_url: row.website_url || null,
            instagram_url: row.instagram_url || null,
            maps_url: row.maps_url || null,
          })
          .select('id')
          .single()

        if (bizError) throw bizError
        const businessId = bizData.id

        const sourcesToInsert = []
        if (row.website_url)   sourcesToInsert.push({ business_id: businessId, type: 'website',   url: row.website_url,   status: 'pending' })
        if (row.instagram_url) sourcesToInsert.push({ business_id: businessId, type: 'instagram', url: row.instagram_url, status: 'pending' })
        if (row.maps_url)      sourcesToInsert.push({ business_id: businessId, type: 'maps',      url: row.maps_url,      status: 'pending' })

        if (sourcesToInsert.length) {
          const { error: srcError } = await supabase.from('sources').insert(sourcesToInsert)
          if (srcError) throw srcError
        }

        batchResults.push({ row: i + 2, name: row.name, status: 'ok', message: 'Cargado correctamente' })
      } catch (err: any) {
        batchResults.push({ row: i + 2, name: row.name, status: 'error', message: err.message })
      }
    }

    setResults(batchResults)
    setLoading(false)
    setDone(true)
  }

  const reset = () => {
    setRows([]); setFileName(''); setValidationErrors([]); setResults([]); setDone(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  const okCount = results.filter(r => r.status === 'ok').length
  const errCount = results.filter(r => r.status === 'error').length

  return (
    <div className="animate-in fade-in duration-300 pb-12">

      {/* Drop Zone */}
      {!rows.length && (
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-4 border-2 border-dashed border-neutral-700 hover:border-blue-500 rounded-3xl p-12 cursor-pointer transition-colors text-center"
        >
          <Upload className="w-10 h-10 text-neutral-500" />
          <div>
            <p className="text-neutral-300 font-medium">Arrastrá tu CSV aquí</p>
            <p className="text-neutral-600 text-sm mt-1">o hacé click para seleccionar</p>
          </div>
          <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleInputChange} />
        </div>
      )}

      {/* File loaded */}
      {rows.length > 0 && (
        <div className="space-y-5">
          {/* File info bar */}
          <div className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-sm font-medium text-neutral-200">{fileName}</p>
                <p className="text-xs text-neutral-500">{rows.length} filas detectadas</p>
              </div>
            </div>
            <button onClick={reset} className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <div className="bg-red-950/40 border border-red-900/60 rounded-2xl p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-red-400 font-medium text-sm mb-2">
                <AlertCircle className="w-4 h-4" /> {validationErrors.length} error(es) de validación
              </div>
              {validationErrors.map((e, i) => (
                <p key={i} className="text-red-300/80 text-xs">{e}</p>
              ))}
              <p className="text-red-400/60 text-xs mt-2 pt-2 border-t border-red-900/40">
                Corregí el CSV y volvé a cargarlo.
              </p>
            </div>
          )}

          {/* Preview table */}
          {!done && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-800">
                <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Vista previa (primeras 5 filas)</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-neutral-800">
                      {['nombre', 'tipo', 'localidad', 'nivel', 'estética', 'web'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-neutral-500 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                        <td className="px-4 py-2.5 text-neutral-200 font-medium">{row.name}</td>
                        <td className="px-4 py-2.5 text-neutral-400">{row.tipo_principal}</td>
                        <td className="px-4 py-2.5 text-neutral-400">{row.localidad}</td>
                        <td className="px-4 py-2.5 text-neutral-400">{row.nivel}</td>
                        <td className="px-4 py-2.5 text-neutral-400">{row.estetica}</td>
                        <td className="px-4 py-2.5 text-neutral-400 max-w-[120px] truncate">{row.website_url || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 5 && (
                  <p className="px-4 py-2 text-xs text-neutral-600">+ {rows.length - 5} filas más...</p>
                )}
              </div>
            </div>
          )}

          {/* Upload button */}
          {!done && (
            <button
              onClick={handleUpload}
              disabled={loading || validationErrors.length > 0}
              className="w-full flex items-center justify-center gap-2 p-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] disabled:bg-blue-950 disabled:text-blue-700 rounded-2xl text-white font-bold transition-all shadow-lg shadow-blue-900/30 text-base"
            >
              {loading ? (
                <>
                  <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Cargando...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Cargar {rows.length} negocios al sistema
                </>
              )}
            </button>
          )}

          {/* Results */}
          {done && (
            <div className="space-y-3">
              <div className={`flex items-center gap-3 p-4 rounded-2xl border ${errCount === 0 ? 'bg-emerald-950/40 border-emerald-900/60' : 'bg-amber-950/40 border-amber-900/60'}`}>
                <CheckCircle2 className={`w-5 h-5 ${errCount === 0 ? 'text-emerald-400' : 'text-amber-400'}`} />
                <div>
                  <p className={`font-medium text-sm ${errCount === 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                    {okCount} cargados exitosamente{errCount > 0 ? `, ${errCount} con error` : ''}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Ahora podés ejecutar el Fetcher y el Analyzer desde Supabase SQL Editor.
                  </p>
                </div>
              </div>

              {errCount > 0 && (
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-neutral-800">
                    <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Detalle de errores</p>
                  </div>
                  {results.filter(r => r.status === 'error').map((r, i) => (
                    <div key={i} className="px-4 py-3 border-b border-neutral-800/50 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-neutral-200">{r.name}</p>
                        <p className="text-xs text-red-400/80 mt-0.5">{r.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={reset} className="w-full p-3 rounded-2xl border border-neutral-700 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 text-sm font-medium transition-colors">
                Cargar otro archivo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
