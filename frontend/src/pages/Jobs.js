import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import StatusBadge, { JOB_STATUSES } from "@/components/StatusBadge";
import { Plus, Briefcase, Loader2 } from "lucide-react";
import { toast } from "sonner";
import TourButton from "@/components/TourButton";

const labelFor = (s) => ({
  new_lead: "Nuevo Lead", estimate_sent: "Quote enviado", approved: "Aprobado",
  scheduled: "Agendado", in_progress: "En progreso", waiting_payment: "Esperando pago",
  completed: "Completado",
}[s] || s);

export default function Jobs() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [clients, setClients] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ client_id: "", title: "", status: "new_lead", scheduled_date: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [j, c] = await Promise.all([api.get("/jobs"), api.get("/clients")]);
    setJobs(j.data);
    setClients(c.data);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.client_id || !form.title) return toast.error("Falta cliente o título");
    setSaving(true);
    try {
      await api.post("/jobs", form);
      toast.success("Trabajo creado");
      setOpen(false);
      setForm({ client_id: "", title: "", status: "new_lead", scheduled_date: "", notes: "" });
      load();
    } catch {
      toast.error("Error");
    } finally { setSaving(false); }
  };

  const updateStatus = async (job, status) => {
    await api.put(`/jobs/${job.id}`, { ...job, status });
    load();
  };

  const clientName = (id) => clients.find((c) => c.id === id)?.name || "Cliente";

  const grouped = JOB_STATUSES.reduce((acc, s) => {
    acc[s] = jobs.filter((j) => j.status === s);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Trabajos</h1>
          <p className="text-slate-500 mt-1">{jobs.length} en total</p>
        </div>
        <div className="flex items-center gap-2">
          <TourButton tourKey="jobs" />
          <Button onClick={() => setOpen(true)} data-testid="new-job-btn" className="rounded-xl bg-emerald-600 hover:bg-emerald-700 h-12 px-5">
            <Plus className="w-4 h-4 mr-1" /> Nuevo
          </Button>
        </div>
      </div>

      {jobs.length === 0 ? (
        <Card className="card-elevated p-10 text-center border-0 shadow-none">
          <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 mb-4">Sin trabajos.</p>
          <Button onClick={() => setOpen(true)} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">Crear trabajo</Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {JOB_STATUSES.map((s) => grouped[s].length > 0 && (
            <div key={s}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-heading font-bold text-sm uppercase tracking-wider text-slate-500">{labelFor(s)}</h3>
                <span className="text-xs text-slate-400">({grouped[s].length})</span>
              </div>
              <div className="space-y-2">
                {grouped[s].map((j) => (
                  <Card key={j.id} className="card-elevated p-4 border-0 shadow-none" data-testid={`job-card-${j.id}`}>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate">{j.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{clientName(j.client_id)}</div>
                      </div>
                      <StatusBadge kind="job" status={j.status} />
                    </div>
                    <Select value={j.status} onValueChange={(v) => updateStatus(j, v)}>
                      <SelectTrigger className="h-10 rounded-xl text-xs" data-testid={`job-status-${j.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {JOB_STATUSES.map((st) => <SelectItem key={st} value={st}>{labelFor(st)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader><DialogTitle className="font-heading">Nuevo trabajo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Cliente *</Label>
              <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                <SelectTrigger className="h-12 rounded-xl mt-1.5" data-testid="job-client-select"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Título *</Label>
              <Input data-testid="job-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-12 rounded-xl mt-1.5" />
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="h-12 rounded-xl mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{JOB_STATUSES.map((s) => <SelectItem key={s} value={s}>{labelFor(s)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fecha programada</Label>
              <Input type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} className="h-12 rounded-xl mt-1.5" />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-xl mt-1.5" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={save} data-testid="save-job" disabled={saving} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
