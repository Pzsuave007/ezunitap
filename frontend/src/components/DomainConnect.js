/**
 * DomainConnect — connect a custom domain to the website for ONE slot.
 * slot 1 = primary (default English), slot 2 = secondary (default Spanish).
 * Both slots point to the SAME website; the slot's default language decides
 * which language the site opens in for that domain ("1 update → 2 sites").
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Globe, CheckCircle2, Loader2, Copy } from "lucide-react";

function DnsRow({ label, value, onCopy }) {
  return (
    <div className="flex items-center justify-between gap-2 bg-white/70 rounded-lg px-2.5 py-1.5 mb-1.5">
      <span className="text-[11px] text-slate-400 font-semibold w-24 flex-none">{label}</span>
      <code className="text-xs text-slate-700 break-all flex-1">{value}</code>
      {onCopy && (
        <button onClick={() => onCopy(value)} className="text-slate-400 hover:text-slate-700 flex-none">
          <Copy className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default function DomainConnect({ slot = 1, published = false, badge }) {
  const { t } = useTranslation();
  const [domain, setDomain] = useState(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.get(`/website/domain?slot=${slot}`)
      .then(({ data }) => { setDomain(data); setInput(data.domain || ""); })
      .catch(() => {});
  }, [slot]);

  const copyText = (v) => { navigator.clipboard.writeText(v); toast.success(t("website.linkCopied")); };

  const saveDomain = async () => {
    setBusy(true); setMsg("");
    try {
      const lang = slot === 2 ? "es" : "en";
      const { data } = await api.post(`/website/domain?slot=${slot}`, { domain: input, lang });
      setDomain(data); setInput(data.domain); toast.success(t("website.domainSaved"));
    } catch (e) { toast.error(e?.response?.data?.detail || t("website.saveError")); }
    finally { setBusy(false); }
  };
  const verifyDomain = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/website/domain/verify?slot=${slot}`);
      setDomain(data); setMsg(data.message || "");
      if (data.verified) toast.success(t("website.domainVerified"));
    } catch (e) { toast.error(e?.response?.data?.detail || t("website.saveError")); }
    finally { setBusy(false); }
  };
  const verifyDomainA = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/website/domain/verify-a?slot=${slot}`);
      setDomain(data); setMsg(data.message || "");
      if (data.connected) toast.success(t("website.domainConnected"));
      else if (data.a_ok) toast.success(t("website.domainAok"));
    } catch (e) { toast.error(e?.response?.data?.detail || t("website.saveError")); }
    finally { setBusy(false); }
  };
  const removeDomain = async () => {
    await api.delete(`/website/domain?slot=${slot}`);
    setDomain({ domain: "", verified: false }); setInput(""); setMsg("");
    toast.success(t("website.domainRemoved"));
  };

  return (
    <Card className="card-elevated border-0 shadow-none p-5" data-testid={`domain-slot-${slot}`}>
      <div className="font-semibold mb-1 flex items-center gap-2 flex-wrap">
        <Globe className="w-4 h-4" /> {t("website.domainTitle")}
        {badge && <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-slate-900 text-white">{badge}</span>}
        {domain?.connected
          ? <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700">{t("website.domainConnectedBadge")}</span>
          : domain?.verified && <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700">{t("website.domainVerifiedBadge")}</span>}
      </div>
      <p className="text-sm text-slate-500 mb-3">{t("website.domainDesc")}</p>
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-400">https://</span>
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="mybusiness.com" className="h-11 rounded-xl" data-testid={`website-domain-input-${slot}`} />
        <Button onClick={saveDomain} disabled={busy || !input} className="rounded-xl h-11 flex-none" data-testid={`website-domain-save-${slot}`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : t("website.save")}</Button>
      </div>

      {domain?.domain && domain.connected && (
        <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-4" data-testid={`website-domain-connected-${slot}`}>
          <div className="flex items-center gap-2 text-emerald-800 font-bold"><CheckCircle2 className="w-5 h-5" /> {t("website.domainConnectedTitle")}</div>
          <p className="text-sm text-emerald-700 mt-1">{t("website.domainConnectedDesc")}</p>
          <a href={`https://${domain.domain}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:underline" data-testid={`website-domain-visit-${slot}`}><Globe className="w-4 h-4" /> {domain.domain}</a>
          {!published && (
            <div className="mt-3 rounded-lg bg-amber-100 border border-amber-300 p-2.5 text-xs text-amber-900" data-testid={`website-domain-publish-warn-${slot}`}>
              {t("website.domainPublishWarn")}
            </div>
          )}
          <div className="mt-3">
            <button onClick={removeDomain} className="text-xs text-slate-400 hover:text-red-500 font-semibold" data-testid={`website-domain-remove-${slot}`}>{t("website.domainRemove")}</button>
          </div>
        </div>
      )}

      {domain?.domain && !domain.connected && (
        <div className="mt-4 space-y-3">
          <div className={`rounded-xl border p-3 text-sm ${domain.verified ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
            <div className="font-bold mb-2 flex items-center gap-1.5" style={{ color: domain.verified ? "#065f46" : "#78350f" }}>
              {domain.verified && <CheckCircle2 className="w-4 h-4" />}{t("website.domainStep1")}
            </div>
            {!domain.verified ? (
              <>
                <DnsRow label="Type" value="TXT" onCopy={copyText} />
                <DnsRow label="Host / Name" value={domain.txt_host} onCopy={copyText} />
                <DnsRow label="Value" value={domain.txt_value} onCopy={copyText} />
                <Button onClick={verifyDomain} disabled={busy} size="sm" className="rounded-xl h-9 mt-2 bg-amber-600 hover:bg-amber-700" data-testid={`website-domain-verify-${slot}`}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : t("website.domainVerifyBtn")}
                </Button>
              </>
            ) : (
              <p className="text-xs text-emerald-700">{t("website.domainStep1Done")}</p>
            )}
          </div>

          <div className={`rounded-xl border p-3 text-sm ${domain.a_ok ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
            <div className="font-bold mb-2 flex items-center gap-1.5" style={{ color: domain.a_ok ? "#065f46" : "#334155" }}>
              {domain.a_ok && <CheckCircle2 className="w-4 h-4" />}{t("website.domainStep2")}
            </div>
            {!domain.a_ok ? (
              <>
                <div className="text-xs text-slate-500 mb-2">{domain.is_subdomain ? t("website.domainSubLabel") : t("website.domainRootLabel")}</div>
                <DnsRow label="Type" value="A" onCopy={copyText} />
                <DnsRow label="Host / Name" value={domain.a_host || "@"} onCopy={copyText} />
                <DnsRow label="Points to" value={domain.a_target || t("website.domainAskHost")} onCopy={domain.a_target ? copyText : undefined} />
                {domain.a_target && !domain.is_subdomain && (
                  <>
                    <div className="text-xs text-slate-500 mt-3 mb-2">{t("website.domainWwwLabel")}</div>
                    <DnsRow label="Type" value="A" onCopy={copyText} />
                    <DnsRow label="Host / Name" value="www" onCopy={copyText} />
                    <DnsRow label="Points to" value={domain.a_target} onCopy={copyText} />
                  </>
                )}
                <p className="text-xs text-slate-500 mt-3">{t("website.domainStep2Note")}</p>
                <p className="text-xs text-slate-500 mt-1">{t("website.domainSslNote")}</p>
                <Button onClick={verifyDomainA} disabled={busy} size="sm" className="rounded-xl h-9 mt-2 bg-blue-600 hover:bg-blue-700" data-testid={`website-domain-verify-a-${slot}`}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : t("website.domainVerifyABtn")}
                </Button>
              </>
            ) : (
              <p className="text-xs text-emerald-700">{t("website.domainStep2Done")}</p>
            )}
          </div>

          {msg && <p className="text-xs text-slate-600" data-testid={`website-domain-msg-${slot}`}>{msg}</p>}
          <button onClick={removeDomain} className="text-xs text-slate-400 hover:text-red-500 font-semibold" data-testid={`website-domain-remove-${slot}`}>{t("website.domainRemove")}</button>
        </div>
      )}
    </Card>
  );
}
