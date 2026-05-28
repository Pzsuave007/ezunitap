/**
 * LegalPages — Terms of Service and Privacy Policy.
 *
 * Public, English-language (client-facing) pages required by Stripe and
 * common compliance norms. Plain, contractor-friendly language.
 */
import { Link } from "react-router-dom";
import { ScrollText, Shield, ArrowLeft } from "lucide-react";

function PageShell({ icon: Icon, title, children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Volver
        </Link>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <Icon className="w-6 h-6" />
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold">
            {title}
          </h1>
        </div>
        <div className="prose prose-slate max-w-none [&>h2]:font-heading [&>h2]:text-xl [&>h2]:font-bold [&>h2]:mt-8 [&>h2]:mb-2 [&>p]:text-slate-700 [&>p]:leading-relaxed [&>ul]:text-slate-700 [&>li]:my-1">
          {children}
        </div>
        <div className="mt-12 pt-6 border-t border-slate-200 text-xs text-slate-500">
          Last updated: May 2026 · Unitap by Uni2 Marketing Agency LLC ·
          <a href="mailto:support@ezunitap.com" className="text-emerald-700 hover:underline ml-1">
            support@ezunitap.com
          </a>
        </div>
      </div>
    </div>
  );
}

export function TermsPage() {
  return (
    <PageShell icon={ScrollText} title="Terms of Service">
      <p>
        Welcome to <strong>Unitap</strong> (the &quot;Service&quot;), operated by
        Uni2 Marketing Agency LLC (&quot;we&quot;, &quot;us&quot;). By creating
        an account or using the Service you agree to these Terms.
      </p>

      <h2>1. Eligibility & Account</h2>
      <p>
        You must be at least 18 years old and provide accurate business
        information. You are responsible for your account credentials and any
        activity under your account.
      </p>

      <h2>2. The Service</h2>
      <p>
        Unitap is a CRM and quote/invoice/agreement platform for service
        contractors. We provide a digital Smart Card and may ship a physical
        NFC card to paying subscribers in the U.S., Canada, Mexico, and
        Puerto Rico.
      </p>

      <h2>3. Subscriptions & Billing</h2>
      <ul>
        <li>
          Paid plans start with a <strong>14-day free trial</strong>. You enter
          a payment method during signup; you will not be charged until the
          trial ends.
        </li>
        <li>
          After the trial, your card on file is charged automatically based on
          the plan you selected (monthly or annual).
        </li>
        <li>
          You may cancel at any time from the Stripe Customer Portal in
          Settings → Subscription. Cancellation takes effect at the end of the
          current billing period.
        </li>
        <li>
          All payments are processed by Stripe. We do not store full card
          numbers on our servers.
        </li>
        <li>
          Refunds are handled on a case-by-case basis. Contact us within 7
          days of a charge.
        </li>
      </ul>

      <h2>4. Physical NFC Card Shipment</h2>
      <p>
        Active paying subscribers are entitled to one (1) physical NFC card
        per active subscription, shipped to the address provided at checkout.
        Allow 10–14 business days for delivery. If you cancel during the
        trial, no physical card is shipped.
      </p>

      <h2>5. Acceptable Use</h2>
      <p>You agree not to use the Service to:</p>
      <ul>
        <li>Send spam or unsolicited communications</li>
        <li>Misrepresent your identity or business</li>
        <li>Violate any applicable law or third-party right</li>
        <li>Interfere with or compromise the Service infrastructure</li>
      </ul>
      <p>
        We may suspend or terminate accounts that violate these terms.
      </p>

      <h2>6. Your Content</h2>
      <p>
        You retain ownership of the content you create (quotes, invoices,
        client data, photos). You grant us a limited license to host, process,
        and display this content as needed to operate the Service.
      </p>

      <h2>7. AI-Generated Content</h2>
      <p>
        Unitap uses third-party AI providers (e.g., OpenAI) to generate
        quotes, agreements, and messages. You are responsible for reviewing
        and editing AI output before sending it to your clients. We do not
        guarantee accuracy or fitness for any particular purpose.
      </p>

      <h2>8. Disclaimer of Warranties</h2>
      <p>
        The Service is provided &quot;as is&quot; without warranty of any
        kind. We do not warrant that the Service will be uninterrupted or
        error-free.
      </p>

      <h2>9. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, our total liability for any
        claim arising out of the Service is limited to the amount you paid us
        in the 12 months preceding the claim.
      </p>

      <h2>10. Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. Material changes will be
        communicated by email or in-app notice. Continued use after changes
        constitutes acceptance.
      </p>

      <h2>11. Governing Law</h2>
      <p>
        These Terms are governed by the laws of the State of Washington, USA,
        without regard to its conflict of laws provisions.
      </p>

      <h2>12. Contact</h2>
      <p>
        Questions? Email{" "}
        <a href="mailto:support@ezunitap.com" className="text-emerald-700 hover:underline">
          support@ezunitap.com
        </a>
      </p>
    </PageShell>
  );
}

export function PrivacyPage() {
  return (
    <PageShell icon={Shield} title="Privacy Policy">
      <p>
        This Privacy Policy explains how Uni2 Marketing Agency LLC (&quot;we&quot;)
        collects and uses your information when you use Unitap.
      </p>

      <h2>1. Information We Collect</h2>
      <ul>
        <li>
          <strong>Account info:</strong> name, email, business name, phone,
          password (hashed).
        </li>
        <li>
          <strong>Billing info:</strong> handled by Stripe — we receive only
          a customer ID, last 4 digits, and subscription status. Full card
          numbers never touch our servers.
        </li>
        <li>
          <strong>Shipping address:</strong> collected at checkout for sending
          you the physical NFC card.
        </li>
        <li>
          <strong>Your business data:</strong> clients, quotes, invoices,
          jobs, calendar — used only to provide the Service.
        </li>
        <li>
          <strong>Usage logs:</strong> standard server logs including IP
          address, browser, and timestamps for security and debugging.
        </li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>To provide and improve the Service</li>
        <li>To process payments (via Stripe)</li>
        <li>To ship your NFC card</li>
        <li>To send transactional emails (receipts, important account notices)</li>
        <li>To respond to support requests</li>
      </ul>

      <h2>3. AI Processing</h2>
      <p>
        When you use the AI Quote Builder, Agreement, or Message Writer,
        relevant business details (job description, client name, materials)
        are sent to a third-party AI provider (OpenAI) to generate the
        output. We do not share your client contact information with the AI
        provider unless you explicitly include it in the prompt.
      </p>

      <h2>4. Third-Party Services</h2>
      <ul>
        <li><strong>Stripe</strong> — payments and subscription billing</li>
        <li><strong>OpenAI</strong> — AI text generation</li>
        <li><strong>Resend</strong> — transactional email delivery</li>
      </ul>
      <p>
        Each provider has its own privacy policy. We only share what is
        necessary to provide the Service.
      </p>

      <h2>5. Data Retention</h2>
      <p>
        We retain your account data for as long as your account is active.
        If you delete your account, we delete your business data within 30
        days, except where retention is legally required (e.g., billing
        records).
      </p>

      <h2>6. Your Rights</h2>
      <p>
        You can access, correct, export, or delete your data at any time
        from Settings, or by emailing{" "}
        <a href="mailto:support@ezunitap.com" className="text-emerald-700 hover:underline">
          support@ezunitap.com
        </a>
        .
      </p>

      <h2>7. Security</h2>
      <p>
        We use industry-standard security: HTTPS everywhere, hashed
        passwords, encrypted backups, and least-privilege access controls.
        No system is 100% secure, but we take this seriously.
      </p>

      <h2>8. Cookies</h2>
      <p>
        We use a single first-party cookie / localStorage entry to keep you
        logged in. We do not use third-party tracking or advertising
        cookies.
      </p>

      <h2>9. Children</h2>
      <p>
        The Service is not directed to anyone under 18. We do not knowingly
        collect data from minors.
      </p>

      <h2>10. Changes to This Policy</h2>
      <p>
        We may update this policy. Material changes will be announced
        in-app or by email.
      </p>

      <h2>11. Contact</h2>
      <p>
        Privacy questions:{" "}
        <a href="mailto:support@ezunitap.com" className="text-emerald-700 hover:underline">
          support@ezunitap.com
        </a>
      </p>
    </PageShell>
  );
}
