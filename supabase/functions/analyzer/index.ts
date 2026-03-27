import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function callGemini(prompt: string): Promise<any | null> {
  if (!GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY no está configurada en los secrets de la función");
    return null;
  }

  const schema = {
    type: "object",
    properties: {
      price_segment: { type: "string", enum: ["alto", "medio", "bajo", "no_clasificado"] },
      aesthetic_profile: { type: "string", description: "Párrafo corto sobre la estética del lugar. SIEMPRE completa este campo." },
      ai_profile: {
        type: "object",
        properties: {
          style: { type: "string" },
          textile_fit_rationale: { type: "string" },
          contact_recommendation: { type: "string" }
        },
        required: ["style", "textile_fit_rationale", "contact_recommendation"]
      },
      design_signals: {
        type: "object",
        properties: {
          materials: { type: "array", items: { type: "string" } },
          color_palette: { type: "array", items: { type: "string" } },
          design_language: { type: "array", items: { type: "string" } },
          textile_coherence_score: { type: "number" },
          key_insights: { type: "string" }
        },
        required: ["materials", "color_palette", "design_language", "textile_coherence_score", "key_insights"]
      }
    },
    required: ["price_segment", "aesthetic_profile", "ai_profile", "design_signals"]
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.2 }
      })
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error(`❌ Gemini API error ${res.status}: ${err}`);
    return null;
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    console.error("❌ Gemini returned empty response:", JSON.stringify(data));
    return null;
  }

  const parsed = JSON.parse(text);
  console.log("✅ Gemini response:", JSON.stringify(parsed).slice(0, 200));
  return parsed;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Soporte para forzar un business_id específico via body (para pruebas)
    let forceBusinessId: number | null = null;
    try {
      const body = await req.json();
      if (body?.business_id) { forceBusinessId = Number(body.business_id); }
    } catch (_) { /* body vacío, ok */ }

    // ────────────────────────────────────────────────────
    // PASO 1: Seleccionar negocios a analizar
    // Usamos OR: aesthetic_profile IS NULL para cubrir todos los casos
    // ────────────────────────────────────────────────────
    let query = supabase
      .from("businesses")
      .select("id, name, tipo_principal, localidad, subtipo, estetica, nivel, intencion, materialidad, contexto, aesthetic_profile, price_segment")
      .limit(forceBusinessId ? 1 : 3);

    if (forceBusinessId) {
      query = query.eq("id", forceBusinessId);
    } else {
      query = query.is("aesthetic_profile", null);
    }

    const { data: unanalyzed, error: bizError } = await query;

    if (bizError) {
      console.error("❌ Error querying businesses:", bizError.message);
      throw bizError;
    }

    console.log(`📋 Negocios encontrados para analizar: ${unanalyzed?.length ?? 0}`);
    if (unanalyzed) {
      for (const b of unanalyzed) {
        console.log(`  → ID ${b.id}: ${b.name} | aesthetic_profile=${b.aesthetic_profile} | price_segment=${b.price_segment}`);
      }
    }

    if (!unanalyzed || unanalyzed.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "Sin negocios pendientes de análisis" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    let processed = 0;

    for (const biz of unanalyzed) {
      console.log(`\n🔍 Procesando: ${biz.name} (ID: ${biz.id})`);

      // PASO 2: Buscar raw_content para este negocio
      const { data: sources } = await supabase
        .from("sources")
        .select("id")
        .eq("business_id", biz.id)
        .eq("status", "fetched");

      const sourceIds = (sources ?? []).map((s: any) => s.id);
      console.log(`  Sources fetched: ${sourceIds.length}, IDs: ${sourceIds.join(",")}`);

      let text = "";
      if (sourceIds.length > 0) {
        const { data: rawRows } = await supabase
          .from("raw_content")
          .select("content")
          .in("source_id", sourceIds)
          .limit(1);

        if (rawRows && rawRows.length > 0) {
          const content = rawRows[0].content as any;
          text = content?.text || "";
          console.log(`  raw_content text_length: ${text.length}`);
        }
      } else {
        console.log("  Sin raw_content disponible (analizando solo con contexto humano)");
      }

      // PASO 3: Construir el prompt
      const ctx = biz as any;
      const contextBlock = [
        `Tipo: ${ctx.tipo_principal || "no especificado"}`,
        `Localidad: ${ctx.localidad || "no especificada"}`,
        `Estética esperada: ${ctx.estetica || "no especificada"}`,
        `Nivel: ${ctx.nivel || "no especificado"}`,
        `Intención: ${ctx.intencion || "no especificada"}`,
        `Materialidad: ${(ctx.materialidad || []).join(", ") || "no especificada"}`,
      ].join("\n  ");

      const prompt = `Eres consultor de inteligencia comercial para textiles artesanales de alta gama en Mendoza, Argentina.

Negocio: ${biz.name}

CLASIFICACIÓN HUMANA:
  ${contextBlock}

${text ? `TEXTO WEB:\n---\n${text.slice(0, 7000)}\n---` : "(Sin texto web. Infiere en base al contexto y tipo de negocio.)"}

INSTRUCCIONES:
- textile_coherence_score (0-5): lujo+experiencia→4-5, medio→2-3, turístico→0-2. Nivel actual: ${ctx.nivel || "?"}
- price_segment: lujo→alto, medio→medio, turístico→bajo
- aesthetic_profile: OBLIGATORIO. Escribe al menos 1 párrafo describiendo la estética del lugar.
- Si no hay info suficiente, deduce del tipo de negocio y la localidad mendocina.`;

      try {
        console.log("  🤖 Llamando a Gemini...");
        const result = await callGemini(prompt);

        if (!result) {
          console.error(`  ❌ Gemini falló para ${biz.name}`);
          continue;
        }

        const score = result.design_signals?.textile_coherence_score ?? 0;
        const aestheticProfile = result.aesthetic_profile || `Establecimiento tipo ${ctx.tipo_principal || "negocio"} en ${ctx.localidad || "Mendoza"}.`;

        const updatePayload = {
          price_segment: result.price_segment,
          aesthetic_profile: aestheticProfile,
          ai_profile: result.ai_profile,
          score_textil_fit: score,
          score_total: parseFloat(((score * 0.5) + 2.5).toFixed(2))
        };

        console.log("  💾 Actualizando businesses con:", JSON.stringify({ id: biz.id, ...updatePayload }).slice(0, 200));

        const { error: updateError } = await supabase
          .from("businesses")
          .update(updatePayload)
          .eq("id", biz.id);

        if (updateError) {
          console.error(`  ❌ Update error: ${updateError.message}`);
        } else {
          console.log(`  ✅ ${biz.name} actualizado correctamente`);
          processed++;
        }

        // design_signals (best-effort)
        await supabase.from("design_signals").insert({
          business_id: biz.id,
          style: result.ai_profile?.style,
          materials: result.design_signals?.materials,
          color_palette: result.design_signals?.color_palette,
          design_language: result.design_signals?.design_language,
          textile_coherence_score: score,
          key_insights: result.design_signals?.key_insights,
          extracted_from: text ? "website" : "context_only"
        });

      } catch (innerErr: any) {
        console.error(`  ❌ Error inesperado: ${innerErr.message}`);
      }
    }

    return new Response(JSON.stringify({ success: true, processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("❌ Error fatal:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
