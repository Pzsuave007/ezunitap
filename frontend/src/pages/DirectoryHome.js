import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Search, MapPin, BadgeCheck, Loader2, Store, ArrowRight, Phone } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND = process.env.REACT_APP_BACKEND_URL;

const lang = () => (typeof navigator !== "undefined" && (navigator.language || "es").startsWith("en") ? "en" : "es");

export default function DirectoryHome() {
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const es = lang() === "es";
  const T = (en, esT) => (es ? esT : en);

  const [config, setConfig] = useState(null);
  const [cats, setCats] = useState([]);
  const [states, setStates] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState(sp.get("q") || "");
  const [category, setCategory] = useState(sp.get("category") || "");
  const [city, setCity] = useState(sp.get("city") || "");
  const [stateF, setStateF] = useState(sp.get("state") || "");

  useEffect(() => {
    axios.get(`${API}/public/directory/config`).then((r) => {
      setConfig(r.data.config); setCats(r.data.categories || []); setStates(r.data.states || []);
      document.title = `${r.data.config?.name || "Pro Finder"}`;
    }).catch(() => {});
  }, []);

  const search = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (q) params.q = q;
      if (category) params.category = category;
      if (city) params.city = city;
      if (stateF) params.state = stateF;
      const { data } = await axios.get(`${API}/public/directory/search`, { params });
      setResults(data.results || []);
      setSp(params, { replace: true });
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, [q, category, city, stateF, setSp]);

  useEffect(() => { search(); /* initial + whenever filters applied via button */ /* eslint-disable-next-line */ }, []);

  const catLabel = (slug) => { const c = cats.find((x) => x.slug === slug); return c ? (es ? c.es : c.en) : slug; };
  const dirName = config?.name || "Pro Finder";
  const primary = config?.primary_color || "#0f5f46";

  return (
    <div className="min-h-screen bg-slate-50" data-testid="directory-home">
      {/* Header */}
      <header className="text-white" style={{ background: primary }}>
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate("/directorio")} className="flex items-center gap-2 font-heading font-bold text-lg" data-testid="directory-logo-home">
            <Store className="w-6 h-6" /> {dirName}
          </button>
          {config?.sponsor_enabled && config?.sponsor_name && (
            <div className="text-xs opacity-90 flex items-center gap-2" data-testid="directory-sponsor">
              <span>{es ? config.sponsor_label_es : config.sponsor_label_en}</span>
              {config.sponsor_logo_url
                ? <img src={config.sponsor_logo_url} alt={config.sponsor_name} className="h-6" />
                : <span className="font-bold">{config.sponsor_name}</span>}
            </div>
          )}
        </div>
        {/* Hero */}
        <div className="max-w-5xl mx-auto px-4 pb-10 pt-4">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight max-w-2xl">
            {es ? config?.tagline_es : config?.tagline_en}
          </h1>
          {/* Search bar */}
          <div className="mt-6 bg-white rounded-2xl p-3 shadow-lg flex flex-col sm:flex-row gap-2" data-testid="directory-search-bar">
            <div className="flex-1 flex items-center gap-2 px-2">
              <Search className="w-5 h-5 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()}
                placeholder={T("Business name…", "Nombre del negocio…")} data-testid="directory-search-q"
                className="w-full py-2 text-slate-800 outline-none text-sm" />
            </div>
            <select value={category} onChange={(e) => setCategory(e.target.value)} data-testid="directory-search-category"
              className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm">
              <option value="">{T("All services", "Todos los servicios")}</option>
              {cats.map((c) => <option key={c.slug} value={c.slug}>{es ? c.es : c.en}</option>)}
            </select>
            <input value={city} onChange={(e) => setCity(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder={T("City", "Ciudad")} data-testid="directory-search-city"
              className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm w-full sm:w-32" />
            <select value={stateF} onChange={(e) => setStateF(e.target.value)} data-testid="directory-search-state"
              className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm">
              <option value="">{T("State", "Estado")}</option>
              {states.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={search} data-testid="directory-search-btn"
              className="px-5 py-2 rounded-xl text-white font-semibold text-sm" style={{ background: primary }}>
              {T("Search", "Buscar")}
            </button>
          </div>
        </div>
      </header>

      {/* Results */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : results.length === 0 ? (
          <div className="text-center py-20 text-slate-500" data-testid="directory-empty">
            <Store className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="font-semibold">{T("No contractors found", "No se encontraron contratistas")}</p>
            <p className="text-sm">{T("Try another service or city.", "Prueba otro servicio o ciudad.")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="directory-results">
            {results.map((r) => (
              <button key={r.slug} onClick={() => navigate(`/directorio/${r.categories?.[0] || "contratista"}/${(r.city || "ciudad").toLowerCase().replace(/\s+/g, "-")}-${(r.state || "").toLowerCase()}/${r.slug}`)}
                data-testid={`directory-result-${r.slug}`}
                className="text-left bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-slate-100">
                <div className="h-32 bg-slate-100 relative">
                  {r.hero_url ? <img src={`${BACKEND}${r.hero_url}`} alt={r.business_name} className="w-full h-full object-cover" /> :
                    <div className="w-full h-full flex items-center justify-center text-slate-300"><Store className="w-8 h-8" /></div>}
                  {r.badge && (
                    <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-emerald-600 text-white text-[11px] font-bold px-2 py-1 rounded-full">
                      <BadgeCheck className="w-3.5 h-3.5" /> {T("Verified", "Verificado")}
                    </span>
                  )}
                </div>
                <div className="p-3.5">
                  <h3 className="font-bold text-slate-800 truncate">{r.business_name}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" /> {r.city}{r.state ? `, ${r.state}` : ""}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(r.categories || []).slice(0, 3).map((c) => (
                      <span key={c} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{catLabel(c)}</span>
                    ))}
                  </div>
                  <span className="inline-flex items-center gap-1 text-emerald-700 text-sm font-semibold mt-3">
                    {T("View profile", "Ver ficha")} <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Join CTA for contractors */}
        <div className="mt-12 rounded-2xl p-6 text-center text-white" style={{ background: primary }} data-testid="directory-join-cta">
          <h2 className="font-heading text-xl font-bold">{T("Are you a contractor?", "¿Eres contratista?")}</h2>
          <p className="text-sm opacity-90 mt-1 max-w-xl mx-auto">{T(`List your business free on ${dirName} and get found by local customers.`, `Aparece gratis en ${dirName} y deja que los clientes de tu zona te encuentren.`)}</p>
          <button onClick={() => navigate("/register")} data-testid="directory-join-btn"
            className="mt-4 inline-flex items-center gap-2 bg-white text-slate-900 font-semibold px-5 py-2.5 rounded-xl">
            <Phone className="w-4 h-4" /> {T("List my business free", "Publicar mi negocio gratis")}
          </button>
        </div>
      </main>
    </div>
  );
}
