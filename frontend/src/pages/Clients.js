import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Phone, Mail, MapPin, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

const EMPTY = { name: "", phone: "", email: "", address: "", job_type: "", notes: "" };

export default function Clients() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [clients, setClients] = useState([]);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(searchParams.get("new") === "1");
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await api.get("/clients");
    setClients(data);
  };
  useEffect(() => { load(); }, []);

  const close = () => {
    setOpen(false);
    setForm(EMPTY);
    if (searchParams.get("new")) {
      searchParams.delete("new");
      setSearchParams(searchParams);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("El nombre es requerido");
    setSaving(true);
    try {
      await api.post("/clients", form);
      toast.success("Cliente agregado");
      close();
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Error");
    } finally {
      setSaving(false);
    }
  };

  const filtered = clients.filter((c) =>
    [c.name, c.phone, c.email, c.address, c.job_type].some((f) =>
      (f || "").toLowerCase().includes(filter.toLowerCase())
    )
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-slate-500 mt-1">{clients.length} cliente{clients.length !== 1 ? "s" : ""}</p>
        </div>
        <Button
          data-testid="new-client-btn"
          onClick={() => setOpen(true)}
          className="rounded-xl bg-emerald-600 hover:bg-emerald-700 h-12 px-5"
        >
          <Plus className="w-4 h-4 mr-1" /> Nuevo
        </Button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          data-testid="search-clients"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Buscar cliente..."
          className="h-12 pl-10 rounded-xl"
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="card-elevated p-10 text-center border-0 shadow-none">
          <p className="text-slate-500">No hay clientes. Agrega el primero.</p>
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
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-900 to-emerald-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                  {c.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{c.name}</div>
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

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Nuevo cliente</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div>
              <Label>Nombre *</Label>
              <Input data-testid="cli-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-12 rounded-xl mt-1.5" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Teléfono</Label>
                <Input data-testid="cli-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-12 rounded-xl mt-1.5" />
              </div>
              <div>
                <Label>Email</Label>
                <Input data-testid="cli-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-12 rounded-xl mt-1.5" />
              </div>
            </div>
            <div>
              <Label>Dirección</Label>
              <Input data-testid="cli-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="h-12 rounded-xl mt-1.5" />
            </div>
            <div>
              <Label>Tipo de trabajo</Label>
              <Input data-testid="cli-jobtype" value={form.job_type} onChange={(e) => setForm({ ...form, job_type: e.target.value })} className="h-12 rounded-xl mt-1.5" placeholder="Ej: Roofing, Drywall, Painting..." />
            </div>
            <div>
              <Label>Notas internas (español)</Label>
              <Textarea data-testid="cli-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-xl mt-1.5 min-h-[80px]" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} className="rounded-xl">Cancelar</Button>
              <Button
                type="submit"
                data-testid="cli-save"
                disabled={saving}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
