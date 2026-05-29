import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Clients from "@/pages/Clients";
import ClientDetail from "@/pages/ClientDetail";
import Quotes from "@/pages/Quotes";
import QuoteBuilder from "@/pages/QuoteBuilder";
import QuoteDetail from "@/pages/QuoteDetail";
import Invoices from "@/pages/Invoices";
import InvoiceDetail from "@/pages/InvoiceDetail";
import Jobs from "@/pages/Jobs";
import Calendar from "@/pages/Calendar";
import Messages from "@/pages/Messages";
import Scope from "@/pages/Scope";
import Settings from "@/pages/Settings";
import PublicQuote from "@/pages/PublicQuote";
import SmartCard from "@/pages/SmartCard";
import CardAdmin from "@/pages/CardAdmin";
import Landing from "@/pages/Landing";
import AdminLeads from "@/pages/AdminLeads";
import Agreements from "@/pages/Agreements";
import AgreementBuilder from "@/pages/AgreementBuilder";
import AgreementDetail from "@/pages/AgreementDetail";
import PublicAgreement from "@/pages/PublicAgreement";
import Pricing from "@/pages/Pricing";
import PaymentSuccess from "@/pages/PaymentSuccess";
import AdminAccounts from "@/pages/AdminAccounts";
import AdminMessages from "@/pages/AdminMessages";
import AdminMetrics from "@/pages/AdminMetrics";
import AdminShipments from "@/pages/AdminShipments";
import NotificationsInbox from "@/pages/NotificationsInbox";
import PublicInvoice from "@/pages/PublicInvoice";
import { TermsPage, PrivacyPage } from "@/pages/LegalPages";
import { Loader2 } from "lucide-react";
import "@/App.css";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (user) return <Navigate to="/" replace />;
  return children;
}

/**
 * Wrapper for the protected app tree. If the visitor is at "/" and not logged in,
 * render the public Landing page instead of redirecting to /login. Any other
 * protected URL redirects to /login as usual.
 */
function HomeOrAuth() {
  const { user, loading } = useAuth();
  const isRoot = window.location.pathname === "/";
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (!user) {
    if (isRoot) return <Landing />;
    return <Navigate to="/login" replace />;
  }
  return <Layout />;
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
            <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
            <Route path="/p/quote/:id" element={<PublicQuote />} />
            <Route path="/p/agreement/:id" element={<PublicAgreement />} />
            <Route path="/p/invoice/:id" element={<PublicInvoice />} />
            <Route path="/c/:slug" element={<SmartCard />} />
            <Route path="/pago/exito" element={<PaymentSuccess />} />
            <Route path="/terminos" element={<TermsPage />} />
            <Route path="/privacidad" element={<PrivacyPage />} />

            <Route element={<HomeOrAuth />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/clientes" element={<Clients />} />
              <Route path="/clientes/:id" element={<ClientDetail />} />
              <Route path="/quotes" element={<Quotes />} />
              <Route path="/quotes/nuevo" element={<QuoteBuilder />} />
              <Route path="/quotes/:id" element={<QuoteDetail />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/invoices/nuevo" element={<InvoiceDetail />} />
              <Route path="/invoices/:id" element={<InvoiceDetail />} />
              <Route path="/contratos" element={<Agreements />} />
              <Route path="/contratos/nuevo" element={<AgreementBuilder />} />
              <Route path="/contratos/:id" element={<AgreementDetail />} />
              <Route path="/trabajos" element={<Jobs />} />
              <Route path="/calendario" element={<Calendar />} />
              <Route path="/tarjeta" element={<CardAdmin />} />
              <Route path="/mensajes" element={<Messages />} />
              <Route path="/scope" element={<Scope />} />
              <Route path="/ajustes" element={<Settings />} />
              <Route path="/precios" element={<Pricing />} />
              <Route path="/admin/metricas" element={<AdminMetrics />} />
              <Route path="/admin/mensajes" element={<AdminMessages />} />
              <Route path="/admin/cuentas" element={<AdminAccounts />} />
              <Route path="/admin/envios" element={<AdminShipments />} />
              <Route path="/admin/leads" element={<AdminLeads />} />
              <Route path="/notificaciones" element={<NotificationsInbox />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster position="top-center" richColors closeButton offset="60px" mobileOffset="80px" />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
