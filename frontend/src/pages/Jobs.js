import { useEffect, useState, useRef } from "react";
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
import { Plus, Briefcase, Loader2, Camera } from "lucide-react";
import { toast } from "sonner";
import TourButton from "@/components/TourButton";
import { useAuth } from "@/context/AuthContext";
import SendDocumentDialog from "@/components/SendDocumentDialog";
import RequestReviewButton from "@/components/RequestReviewButton";

const labelFor = (s) => ({
  new_lead: "Nuevo Lead", estimate_sent: "Quote enviado", approved: "Aprobado",
  scheduled: "Agendado", in_progress: "En progreso", waiting_payment: "Esperando pago",
  completed: "Completado",
}[s] || s);

export default function Jobs() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [clients, setClients] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ client_id: "", title: "", status: "new_lead", scheduled_date: "", notes: "" });
  const [saving, setSaving] = useState(false);

  // Auto-prompt to request a review when a job is marked completed.
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewClient, setReviewClient] = useState(null);
  const [reviewJobTitle, setReviewJobTitle] = useState("");

  // Per-job photo upload (Antes / Durante / Después)
  const photoInput = useRef(null);
  const [photoJob, setPhotoJob] = useState(null);
  const [photoLabel, setPhotoLabel] = useState("during");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const uploadJobPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !photoJob) return;
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const params = new URLSearchParams({ label: photoLabel, job_id: photoJob.id });
      if (photoJob.client_id) params.append("client_id", photoJob.client_id);
      await api.post(`/photos?${params.toString()}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Foto subida al trabajo");
      setPhotoJob(null);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Error subiendo foto");
    } finally {
      setUploadingPhoto(false);
      e.target.value = "";
    }
  };

  const load = async () => {
    const [j, c] = await Promise.all([api.get("/jobs"), api.get("/clients")]);
    setJobs(j.data);
    setClients(c.data);
  };
  useEffect(() => { load(); }, []);

  const reviewUrl = user?.card_slug
    ? `${window.location.origin}/r/${user.card_slug}`
    : "";

  const promptReview = (job) => {
    if (!user?.google_review_url) {
      toast("¡Trabajo completado! 🎉 Configura tu link de Google Reviews para pedir reseñas.", {
        action: { label: "Configurar", onClick: () => navigate("/reviews") },
      });
      return;
    }
    const client = clients.find((c) => c.id === job.client_id) || null;
    setReviewClient(client);
    setReviewJobTitle(job.title);
    setReviewOpen(true);
  };

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
    await load();
    if (status === "completed" && job.status !== "completed") {
      promptReview(job);
    }
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
                    <Button
                      variant="outline"
                      onClick={() => { setPhotoJob(j); setPhotoLabel("during"); }}
                      data-testid={`job-photo-${j.id}`}
                      className="h-10 rounded-xl text-xs w-full mt-2 border-slate-200 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
                    >
                      <Camera className="w-4 h-4 mr-1.5 text-emerald-600" /> Subir foto
                    </Button>
                    {j.status === "completed" && (
                      <div className="mt-2">
                        <RequestReviewButton
                          client={clients.find((c) => c.id === j.client_id) || null}
                          jobTitle={j.title}
                          size="sm"
                          className="h-10 rounded-xl text-xs w-full"
                        />
                      </div>
                    )}
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

      <SendDocumentDialog
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        kind="review"
        publicUrl={reviewUrl}
        client={reviewClient}
        businessName={user?.business_name}
        jobTitle={reviewJobTitle}
      />

      {/* Per-job photo upload */}
      <Dialog open={!!photoJob} onOpenChange={(o) => !o && setPhotoJob(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader><DialogTitle className="font-heading">Subir foto del trabajo</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-500 -mt-1">{photoJob?.title}</p>
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Etiqueta</Label>
              <div className="flex gap-2 mt-2">
                {["before", "during", "after"].map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setPhotoLabel(l)}
                    data-testid={`job-photo-label-${l}`}
                    className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${photoLabel === l ? "bg-blue-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                  >
                    {l === "before" ? "Antes" : l === "during" ? "Durante" : "Después"}
                  </button>
                ))}
              </div>
            </div>
            <Button
              onClick={() => photoInput.current?.click()}
              disabled={uploadingPhoto}
              data-testid="job-photo-choose"
              className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700"
            >
              {uploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Camera className="w-4 h-4 mr-2" />}
              Elegir foto
            </Button>
            <input ref={photoInput} type="file" accept="image/*" hidden onChange={uploadJobPhoto} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
