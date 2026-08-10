import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Phone, MapPin, ChevronRight, Building2 } from "lucide-react";
import TourButton from "@/components/TourButton";

export default function Clients() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [clients, setClients] = useState([]);
  const [filter, setFilter] = useState("");

  const load = async () => {
    const { data } = await api.get("/clients");
    setClients(data);
  };
  useEffect(() => { load(); }, []);

  const filtered = clients.filter((c) =>
    [c.name, c.company, c.phone, c.email, c.address, c.job_type].some((f) =>
      (f || "").toLowerCase().includes(filter.toLowerCase())
    )
  );

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight">{t("clients.title")}</h1>
            <p className="text-slate-500 mt-1">{t("clients.count", { count: clients.length })}</p>
          </div>
          <TourButton tourKey="clients" />
        </div>
        <Button
          data-testid="new-client-btn"
          onClick={() => navigate("/clientes/nuevo")}
          className="rounded-xl bg-emerald-600 hover:bg-emerald-700 h-12 px-5 w-full sm:w-auto whitespace-nowrap"
        >
          <Plus className="w-4 h-4 mr-1" /> {t("clients.newClient")}
        </Button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          data-testid="search-clients"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t("clients.search")}
          className="h-12 pl-10 rounded-xl"
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="card-elevated p-10 text-center border-0 shadow-none">
          <p className="text-slate-500">{t("clients.empty")}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <Card
              key={c.id}
              data-testid={`client-card-${c.id}`}
              onClick={() => navigate(`/clientes/${c.id}`)}
              className="card-elevated p-4 border-0 shadow-none cursor-pointer tap"
            >
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{c.name}</div>
                  {c.company && <div className="text-xs text-slate-500 truncate flex items-center gap-1"><Building2 className="w-3 h-3" />{c.company}</div>}
                  <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5 flex-wrap">
                    {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                    {c.address && <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3" />{c.address}</span>}
                  </div>
                  {c.job_type && <div className="text-xs text-emerald-700 font-medium mt-1">{c.job_type}</div>}
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
