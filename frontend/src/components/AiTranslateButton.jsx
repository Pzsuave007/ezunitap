/**
 * AiTranslateButton — lets the user write in Spanish and have AI generate
 * polished, public-facing English for a given profile field.
 *
 * Usage:
 *   <AiTranslateButton fieldType="about" businessType={card.business_type}
 *      onResult={(en) => update("about_me", en)} testId="ai-about" />
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  placeholder = "",
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [es, setEs] = useState("");
  const [loading, setLoading] = useState(false);
  const ph = placeholder || t("aiTranslate.writeHerePlaceholder");

  const generate = async () => {
    if (!es.trim()) {
      toast.error(t("aiTranslate.writeFirst"));
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
      toast.success(t("aiTranslate.done"));
    } catch (e) {
      toast.error(e?.response?.data?.detail || t("aiTranslate.genError"));
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
          <Sparkles className="w-3.5 h-3.5" /> {t("aiTranslate.button")}
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
            {t("aiTranslate.popoverTitle")}
          </div>
          <Textarea
            value={es}
            onChange={(e) => setEs(e.target.value)}
            placeholder={ph}
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
            {t("aiTranslate.generate")}
          </Button>
          <p className="text-[10px] text-slate-400 leading-snug">
            {t("aiTranslate.resultNote")}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
