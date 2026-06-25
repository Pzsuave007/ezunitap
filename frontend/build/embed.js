/*!
 * UniTech Embed Widget — drop-in lead/quote/appointment forms for external sites.
 *
 * Usage on any website:
 *   <div data-unitech-form data-slug="YOUR-SLUG" data-type="contact"></div>
 *   <script src="https://YOUR-UNITECH-DOMAIN/embed.js" async></script>
 *
 * data-type: "contact" | "quote" | "appointment"
 * data-lang: "es" (default) | "en"
 * data-accent: hex color (default "#059669")
 *
 * Submissions land directly in the UniTech CRM of the account that owns the slug,
 * tagged with the website domain they came from. No iframe; styles are inline so
 * they don't clash with the host site.
 */
(function () {
  var SCRIPT =
    document.currentScript ||
    (function () {
      var s = document.getElementsByTagName("script");
      return s[s.length - 1];
    })();
  var API = (function () {
    try {
      return new URL(SCRIPT.src).origin;
    } catch (e) {
      return "";
    }
  })();
  var SITE = location.hostname || "";

  function api(path) {
    return API + "/api" + path;
  }

  var T = {
    es: {
      contactTitle: "Contáctanos",
      quoteTitle: "Pide tu cotización gratis",
      apptTitle: "Agenda tu cita",
      name: "Nombre",
      phone: "Teléfono",
      email: "Correo (opcional)",
      message: "¿En qué te ayudamos?",
      service: "Servicio que necesitas",
      project: "Cuéntanos de tu proyecto",
      date: "Día",
      time: "Hora",
      notes: "Notas (opcional)",
      pickDate: "Elige un día",
      pickTime: "Elige una hora",
      send: "Enviar",
      book: "Agendar cita",
      sending: "Enviando…",
      okTitle: "¡Listo! 🎉",
      okMsg: "Gracias, recibimos tu información. Te contactaremos pronto.",
      okAppt: "Tu cita quedó agendada. ¡Te esperamos!",
      errReq: "Por favor escribe tu nombre y teléfono.",
      err: "Hubo un problema. Intenta de nuevo.",
      noAppt: "Las citas en línea no están disponibles por ahora.",
      powered: "Formulario por UniTech",
      chatTitle: "Asistente",
      chatPlaceholder: "Escribe tu mensaje…",
      chatGreeting: "¡Hola! 👋 ¿En qué puedo ayudarte hoy? Puedo responder tus dudas o ayudarte a agendar.",
      chatErr: "Ups, no pude responder. Intenta de nuevo.",
    },
    en: {
      contactTitle: "Contact us",
      quoteTitle: "Get your free quote",
      apptTitle: "Book an appointment",
      name: "Name",
      phone: "Phone",
      email: "Email (optional)",
      message: "How can we help?",
      service: "Service you need",
      project: "Tell us about your project",
      date: "Day",
      time: "Time",
      notes: "Notes (optional)",
      pickDate: "Pick a day",
      pickTime: "Pick a time",
      send: "Send",
      book: "Book appointment",
      sending: "Sending…",
      okTitle: "Done! 🎉",
      okMsg: "Thanks, we got your info. We'll reach out soon.",
      okAppt: "Your appointment is booked. See you soon!",
      errReq: "Please enter your name and phone.",
      err: "Something went wrong. Please try again.",
      noAppt: "Online booking is not available right now.",
      powered: "Form by UniTech",
      chatTitle: "Assistant",
      chatPlaceholder: "Type your message…",
      chatGreeting: "Hi! 👋 How can I help you today? I can answer questions or help you book.",
      chatErr: "Oops, I couldn't reply. Please try again.",
    },
  };

  function st(node, css) {
    for (var k in css) node.style[k] = css[k];
    return node;
  }

  function mk(tag, css, props) {
    var n = document.createElement(tag);
    st(n, { boxSizing: "border-box", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" });
    if (css) st(n, css);
    if (props) for (var k in props) n[k] = props[k];
    return n;
  }

  function fmtDate(iso, lang) {
    try {
      return new Date(iso + "T00:00:00").toLocaleDateString(lang === "en" ? "en-US" : "es-ES", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
    } catch (e) {
      return iso;
    }
  }

  function labelStyle() {
    return { display: "block", fontSize: "12px", fontWeight: "700", color: "#52525b", margin: "0 0 5px 2px" };
  }
  function inputStyle(accent) {
    return {
      width: "100%",
      height: "44px",
      padding: "0 12px",
      fontSize: "15px",
      color: "#18181b",
      background: "#fff",
      border: "1px solid #d4d4d8",
      borderRadius: "12px",
      outline: "none",
      marginBottom: "12px",
    };
  }

  function renderForm(container) {
    var slug = container.getAttribute("data-slug");
    var type = (container.getAttribute("data-type") || "contact").toLowerCase();
    var lang = (container.getAttribute("data-lang") || "es").toLowerCase();
    if (lang !== "en") lang = "es";
    var accent = container.getAttribute("data-accent") || "#059669";
    var t = T[lang];
    if (!slug) {
      container.innerHTML = "UniTech: missing data-slug";
      return;
    }

    var card = mk("div", {
      maxWidth: "460px",
      width: "100%",
      background: "#ffffff",
      border: "1px solid #e4e4e7",
      borderRadius: "18px",
      padding: "20px",
      boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
    });

    var title = mk("h3", { fontSize: "19px", fontWeight: "800", color: "#18181b", margin: "0 0 14px" });
    title.textContent = type === "appointment" ? t.apptTitle : type === "quote" ? t.quoteTitle : t.contactTitle;
    card.appendChild(title);

    var form = mk("form");
    card.appendChild(form);

    function field(labelText, inputNode) {
      var lab = mk("label", labelStyle());
      lab.textContent = labelText;
      form.appendChild(lab);
      form.appendChild(inputNode);
      return inputNode;
    }

    var nameI = field(t.name + " *", mk("input", inputStyle(accent), { type: "text", required: true }));
    var phoneI = field(t.phone + " *", mk("input", inputStyle(accent), { type: "tel", required: true }));
    var emailI = field(t.email, mk("input", inputStyle(accent), { type: "email" }));

    var serviceI, msgI, dateSel, timeSel, notesI;

    if (type === "quote") {
      serviceI = field(t.service, mk("input", inputStyle(accent), { type: "text" }));
      msgI = field(t.project, st(mk("textarea", inputStyle(accent)), { height: "90px", padding: "10px 12px", resize: "vertical" }));
    } else if (type === "appointment") {
      dateSel = field(t.date + " *", mk("select", inputStyle(accent), {}));
      var opt0 = mk("option", {}, { value: "", textContent: t.pickDate });
      dateSel.appendChild(opt0);
      timeSel = field(t.time + " *", mk("select", inputStyle(accent), {}));
      timeSel.appendChild(mk("option", {}, { value: "", textContent: t.pickTime }));
      notesI = field(t.notes, st(mk("textarea", inputStyle(accent)), { height: "70px", padding: "10px 12px", resize: "vertical" }));

      // Load availability and populate selects.
      var avail = {};
      fetch(api("/public/card/" + encodeURIComponent(slug) + "/availability"))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d.enabled || !d.dates || !d.dates.length) {
            title.textContent = t.apptTitle;
            var no = mk("div", { color: "#a1a1aa", fontSize: "14px", padding: "8px 0" });
            no.textContent = t.noAppt;
            form.innerHTML = "";
            form.appendChild(no);
            return;
          }
          d.dates.forEach(function (day) {
            avail[day.date] = day.slots;
            var o = mk("option", {}, { value: day.date, textContent: fmtDate(day.date, lang) });
            dateSel.appendChild(o);
          });
        })
        .catch(function () {});

      dateSel.addEventListener("change", function () {
        timeSel.innerHTML = "";
        timeSel.appendChild(mk("option", {}, { value: "", textContent: t.pickTime }));
        (avail[dateSel.value] || []).forEach(function (s) {
          timeSel.appendChild(mk("option", {}, { value: s, textContent: s }));
        });
      });
    } else {
      msgI = field(t.message, st(mk("textarea", inputStyle(accent)), { height: "90px", padding: "10px 12px", resize: "vertical" }));
    }

    var btn = mk("button", {
      width: "100%",
      height: "48px",
      marginTop: "4px",
      background: accent,
      color: "#fff",
      border: "none",
      borderRadius: "12px",
      fontSize: "16px",
      fontWeight: "700",
      cursor: "pointer",
    }, { type: "submit" });
    btn.textContent = type === "appointment" ? t.book : t.send;
    form.appendChild(btn);

    var errBox = mk("div", { color: "#dc2626", fontSize: "13px", marginTop: "8px", display: "none" });
    form.appendChild(errBox);

    var powered = mk("div", { textAlign: "center", fontSize: "11px", color: "#a1a1aa", marginTop: "12px" });
    powered.textContent = t.powered;
    card.appendChild(powered);

    function showError(msg) {
      errBox.textContent = msg;
      errBox.style.display = "block";
    }

    function success(msg) {
      card.removeChild(form);
      var ok = mk("div", { textAlign: "center", padding: "16px 4px" });
      var icon = mk("div", {
        width: "56px", height: "56px", borderRadius: "16px", background: "#dcfce7",
        color: accent, fontSize: "30px", display: "flex", alignItems: "center",
        justifyContent: "center", margin: "0 auto 12px",
      });
      icon.textContent = "✓";
      var h = mk("div", { fontSize: "18px", fontWeight: "800", color: "#18181b", marginBottom: "6px" });
      h.textContent = t.okTitle;
      var p = mk("div", { fontSize: "14px", color: "#52525b" });
      p.textContent = msg;
      ok.appendChild(icon); ok.appendChild(h); ok.appendChild(p);
      card.insertBefore(ok, powered);
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      errBox.style.display = "none";
      var name = (nameI.value || "").trim();
      var phone = (phoneI.value || "").trim();
      if (!name || !phone) { showError(t.errReq); return; }
      btn.disabled = true;
      var oldTxt = btn.textContent;
      btn.textContent = t.sending;
      st(btn, { opacity: "0.7" });

      var endpoint, body;
      if (type === "appointment") {
        if (!dateSel.value || !timeSel.value) { showError(t.errReq); btn.disabled = false; btn.textContent = oldTxt; st(btn, { opacity: "1" }); return; }
        endpoint = "/public/card/" + encodeURIComponent(slug) + "/appointment";
        body = { name: name, phone: phone, email: (emailI.value || "").trim(), date: dateSel.value, start_time: timeSel.value, notes: (notesI.value || "").trim(), source_site: SITE };
      } else {
        endpoint = "/public/card/" + encodeURIComponent(slug) + "/lead";
        body = {
          name: name, phone: phone, email: (emailI.value || "").trim(),
          description: (msgI && msgI.value || "").trim(),
          service: (type === "quote" && serviceI && serviceI.value || "").trim(),
          lead_type: type === "quote" ? "estimate" : "connect",
          preferred_contact: "phone",
          source_site: SITE,
        };
      }

      fetch(api(endpoint), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error((res.j && res.j.detail) || t.err);
          success(type === "appointment" ? t.okAppt : t.okMsg);
        })
        .catch(function (err) {
          showError((err && err.message) || t.err);
          btn.disabled = false;
          btn.textContent = oldTxt;
          st(btn, { opacity: "1" });
        });
    });

    container.innerHTML = "";
    container.appendChild(card);
  }

  function uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function renderChat(cfg) {
    var slug = cfg.slug;
    var lang = cfg.lang === "en" ? "en" : "es";
    var accent = cfg.accent || "#059669";
    if (!slug) return;
    var t = T[lang];
    var SKEY = "unitech_chat_" + slug;
    var session = (function () {
      try {
        var s = localStorage.getItem(SKEY);
        if (!s) { s = uuid(); localStorage.setItem(SKEY, s); }
        return s;
      } catch (e) { return uuid(); }
    })();

    // Floating launcher button
    var fab = mk("button", {
      position: "fixed", bottom: "20px", right: "20px", zIndex: "2147483000",
      width: "60px", height: "60px", borderRadius: "50%", background: accent,
      color: "#fff", border: "none", cursor: "pointer", fontSize: "26px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.25)", display: "flex",
      alignItems: "center", justifyContent: "center",
    });
    fab.innerHTML = "&#128172;"; // speech balloon
    document.body.appendChild(fab);

    var panel = mk("div", {
      position: "fixed", bottom: "20px", right: "20px", zIndex: "2147483001",
      width: "360px", maxWidth: "calc(100vw - 32px)", height: "520px",
      maxHeight: "calc(100vh - 40px)", background: "#fff", borderRadius: "18px",
      boxShadow: "0 16px 50px rgba(0,0,0,0.28)", display: "none",
      flexDirection: "column", overflow: "hidden", border: "1px solid #e4e4e7",
    });
    document.body.appendChild(panel);

    var head = mk("div", { background: accent, color: "#fff", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" });
    var headTitle = mk("div", { fontWeight: "800", fontSize: "15px" });
    headTitle.textContent = t.chatTitle;
    var closeBtn = mk("button", { background: "transparent", border: "none", color: "#fff", fontSize: "22px", cursor: "pointer", lineHeight: "1" });
    closeBtn.innerHTML = "&times;";
    head.appendChild(headTitle); head.appendChild(closeBtn);
    panel.appendChild(head);

    var msgs = mk("div", { flex: "1", overflowY: "auto", padding: "14px", background: "#fafafa", display: "flex", flexDirection: "column", gap: "8px" });
    panel.appendChild(msgs);

    function bubble(text, who) {
      var b = mk("div", {
        maxWidth: "82%", padding: "9px 12px", borderRadius: "14px", fontSize: "14px", lineHeight: "1.4",
        whiteSpace: "pre-wrap", wordBreak: "break-word",
        alignSelf: who === "user" ? "flex-end" : "flex-start",
        background: who === "user" ? accent : "#fff",
        color: who === "user" ? "#fff" : "#18181b",
        border: who === "user" ? "none" : "1px solid #e4e4e7",
      });
      b.textContent = text;
      msgs.appendChild(b);
      msgs.scrollTop = msgs.scrollHeight;
      return b;
    }

    var inputBar = mk("div", { display: "flex", gap: "8px", padding: "10px", borderTop: "1px solid #ededed", background: "#fff" });
    var input = mk("input", { flex: "1", height: "42px", padding: "0 12px", border: "1px solid #d4d4d8", borderRadius: "12px", fontSize: "14px", outline: "none" }, { type: "text", placeholder: t.chatPlaceholder });
    var sendB = mk("button", { width: "42px", height: "42px", borderRadius: "12px", background: accent, color: "#fff", border: "none", cursor: "pointer", fontSize: "18px", flex: "none" }, {});
    sendB.innerHTML = "&#10148;";
    inputBar.appendChild(input); inputBar.appendChild(sendB);
    panel.appendChild(inputBar);

    bubble(t.chatGreeting, "bot");

    var busy = false;
    function send() {
      var text = (input.value || "").trim();
      if (!text || busy) return;
      bubble(text, "user");
      input.value = "";
      busy = true;
      var typing = bubble("…", "bot");
      fetch(api("/public/card/" + encodeURIComponent(slug) + "/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: session, message: text, language: lang, source_site: SITE }),
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          typing.textContent = (d && d.reply) || t.chatErr;
          msgs.scrollTop = msgs.scrollHeight;
        })
        .catch(function () { typing.textContent = t.chatErr; })
        .finally(function () { busy = false; });
    }
    sendB.addEventListener("click", send);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") send(); });

    function open() { panel.style.display = "flex"; fab.style.display = "none"; setTimeout(function () { input.focus(); }, 100); }
    function close() { panel.style.display = "none"; fab.style.display = "flex"; }
    fab.addEventListener("click", open);
    closeBtn.addEventListener("click", close);
  }

  function init() {
    var nodes = document.querySelectorAll("[data-unitech-form]");
    for (var i = 0; i < nodes.length; i++) {
      if (!nodes[i].getAttribute("data-unitech-rendered")) {
        nodes[i].setAttribute("data-unitech-rendered", "1");
        renderForm(nodes[i]);
      }
    }
    var chatNodes = document.querySelectorAll("[data-unitech-chat]");
    for (var j = 0; j < chatNodes.length; j++) {
      if (!chatNodes[j].getAttribute("data-unitech-rendered")) {
        chatNodes[j].setAttribute("data-unitech-rendered", "1");
        renderChat({
          slug: chatNodes[j].getAttribute("data-slug"),
          lang: (chatNodes[j].getAttribute("data-lang") || "es").toLowerCase(),
          accent: chatNodes[j].getAttribute("data-accent") || "#059669",
        });
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
