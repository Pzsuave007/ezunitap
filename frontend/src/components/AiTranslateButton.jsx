/**
 * AiTranslateButton — lets the user write in Spanish and have AI generate
 * polished, public-facing English for a given profile field.
 *
 * Usage:
 *   <AiTranslateButton fieldType="about" businessType={card.business_type}
 *      onResult={(en) => update("about_me", en)} testId="ai-about" />
 */
import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { toast } from "sonner";

export function AiTranslateButton({
  fieldType = "generic",
  businessType = "",
  onResult,
  testId = "ai-translate",
  placeholder = "Escribe aquí en español...",
}) {
  const [open, setOpen] = useState(false);
  const [es, setEs] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!es.trim()) {
      toast.error("Escribe algo en español primero");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/ai/translate-field", {
        field_type: fieldType,
        text_es: es.trim(),
        business_type: businessType || "",
      });
      onResult?.(data.text_en || "");
      setOpen(false);
      setEs("");
      toast.success("¡Listo! Texto generado en inglés ✨");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo generar el texto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={testId}
          className="inline-flex flex-none items-center gap-1 whitespace-nowrap text-[11px] font-bold text-emerald-700 hover:text-emerald-800 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" /> Traducir con IA
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[calc(100vw-2rem)] max-w-[320px] rounded-2xl p-3"
        align="end"
        collisionPadding={12}
      >
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            Escribe en español, AI lo redacta en inglés
          </div>
          <Textarea
            value={es}
            onChange={(e) => setEs(e.target.value)}
            placeholder={placeholder}
            className="rounded-xl min-h-[96px] text-sm"
            data-testid={`${testId}-input`}
          />
          <Button
            onClick={generate}
            disabled={loading}
            className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            data-testid={`${testId}-generate`}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            Generar en inglés
          </Button>
          <p className="text-[10px] text-slate-400 leading-snug">
            El resultado se pondrá en el campo y podrás editarlo.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
