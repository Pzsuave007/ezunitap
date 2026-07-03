/*!
 * UniTech Embed Widget — drop-in lead/quote/appointment forms + AI chat for external sites.
 *
 * Forms:  <div data-unitech-form data-slug="YOUR-SLUG" data-type="contact"></div>
 *         <script src="https://YOUR-UNITECH-DOMAIN/embed.js" async></script>
 * Chat:   <script src="https://YOUR-UNITECH-DOMAIN/embed.js" data-unitech-chat data-slug="YOUR-SLUG" async></script>
 *
 * Customization (data-* attributes):
 *   data-type    : "contact" | "quote" | "appointment"   (forms only)
 *   data-lang    : "es" (default) | "en"
 *   data-accent  : hex color (default "#059669")
 *   data-theme   : "light" (default) | "dark"
 *   data-radius  : "rounded" (default) | "sharp" | "pill"
 *   data-title   : custom heading text (forms) / header text (chat)
 *   data-font    : "system" (default) | "inherit" (use host site font)
 *   data-branding: "on" (default) | "off"  (hide "Form by UniTech")
 *   data-position: "right" (default) | "left"   (chat launcher side)
 *   data-launcher: custom label text for the chat button (optional)
 *
 * Submissions land directly in the UniTech CRM of the account that owns the slug.
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

  var SYSTEM_FONT = "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
  var UI_FONT = SYSTEM_FONT; // set per-render based on data-font

  function st(node, css) {
    for (var k in css) node.style[k] = css[k];
    return node;
  }

  function mk(tag, css, props) {
    var n = document.createElement(tag);
    st(n, { boxSizing: "border-box", fontFamily: UI_FONT });
    if (css) st(n, css);
    if (props) for (var k in props) n[k] = props[k];
    return n;
  }

  // ---- customization helpers ----------------------------------------------
  function readOpts(el) {
    function a(name, def) {
      var v = el && el.getAttribute ? el.getAttribute(name) : null;
      return v === null || v === undefined || v === "" ? def : v;
    }
    var lang = (a("data-lang", "es") || "es").toLowerCase();
    if (lang !== "en") lang = "es";
    return {
      slug: a("data-slug", ""),
      type: (a("data-type", "contact") || "contact").toLowerCase(),
      lang: lang,
      accent: a("data-accent", "#059669"),
      theme: (a("data-theme", "light") || "light").toLowerCase() === "dark" ? "dark" : "light",
      radius: (a("data-radius", "rounded") || "rounded").toLowerCase(),
      title: a("data-title", ""),
      font: (a("data-font", "system") || "system").toLowerCase() === "inherit" ? "inherit" : "system",
      branding: (a("data-branding", "on") || "on").toLowerCase() !== "off",
      position: (a("data-position", "right") || "right").toLowerCase() === "left" ? "left" : "right",
      launcher: a("data-launcher", ""),
    };
  }

  function palette(theme) {
    if (theme === "dark") {
      return {
        cardBg: "#1c1c1f", text: "#fafafa", sub: "#a1a1aa", label: "#d4d4d8",
        border: "#3f3f46", inputBg: "#27272a", inputBorder: "#52525b",
        msgsBg: "#161618", botBg: "#27272a", botText: "#fafafa", botBorder: "#3f3f46",
        shadow: "0 16px 50px rgba(0,0,0,0.5)",
      };
    }
    return {
      cardBg: "#ffffff", text: "#18181b", sub: "#52525b", label: "#52525b",
      border: "#e4e4e7", inputBg: "#ffffff", inputBorder: "#d4d4d8",
      msgsBg: "#fafafa", botBg: "#ffffff", botText: "#18181b", botBorder: "#e4e4e7",
      shadow: "0 16px 50px rgba(0,0,0,0.28)",
    };
  }

  function radii(kind) {
    if (kind === "sharp") return { card: "4px", field: "6px", btn: "6px" };
    if (kind === "pill") return { card: "18px", field: "24px", btn: "26px" };
    return { card: "18px", field: "12px", btn: "12px" };
  }

  function labelStyle(pal) {
    return { display: "block", fontSize: "12px", fontWeight: "700", color: pal.label, margin: "0 0 5px 2px" };
  }
  function inputStyle(pal, rad) {
    return {
      width: "100%",
      height: "44px",
      padding: "0 12px",
      fontSize: "15px",
      color: pal.text,
      background: pal.inputBg,
      border: "1px solid " + pal.inputBorder,
      borderRadius: rad.field,
      outline: "none",
      marginBottom: "12px",
    };
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

  // ==========================================================================
  // FORMS
  // ==========================================================================
  function renderForm(container) {
    var o = readOpts(container);
    UI_FONT = o.font === "inherit" ? "inherit" : SYSTEM_FONT;
    var pal = palette(o.theme);
    var rad = radii(o.radius);
    var accent = o.accent;
    var type = o.type;
    var lang = o.lang;
    var t = T[lang];
    if (!o.slug) {
      container.innerHTML = "UniTech: missing data-slug";
      return;
    }
    var slug = o.slug;

    var card = mk("div", {
      maxWidth: "460px",
      width: "100%",
      background: pal.cardBg,
      border: "1px solid " + pal.border,
      borderRadius: rad.card,
      padding: "20px",
      boxShadow: o.theme === "dark" ? "0 10px 30px rgba(0,0,0,0.4)" : "0 10px 30px rgba(0,0,0,0.06)",
    });

    var title = mk("h3", { fontSize: "19px", fontWeight: "800", color: pal.text, margin: "0 0 14px" });
    title.textContent = o.title || (type === "appointment" ? t.apptTitle : type === "quote" ? t.quoteTitle : t.contactTitle);
    card.appendChild(title);

    var form = mk("form");
    card.appendChild(form);

    function field(labelText, inputNode) {
      var lab = mk("label", labelStyle(pal));
      lab.textContent = labelText;
      form.appendChild(lab);
      form.appendChild(inputNode);
      return inputNode;
    }

    var nameI = field(t.name + " *", mk("input", inputStyle(pal, rad), { type: "text", required: true }));
    var phoneI = field(t.phone + " *", mk("input", inputStyle(pal, rad), { type: "tel", required: true }));
    var emailI = field(t.email, mk("input", inputStyle(pal, rad), { type: "email" }));

    var serviceI, msgI, dateSel, timeSel, notesI;

    if (type === "quote") {
      serviceI = field(t.service, mk("input", inputStyle(pal, rad), { type: "text" }));
      msgI = field(t.project, st(mk("textarea", inputStyle(pal, rad)), { height: "90px", padding: "10px 12px", resize: "vertical" }));
    } else if (type === "appointment") {
      // Objects with a `.value` so the submit handler below stays unchanged.
      dateSel = { value: "" };
      timeSel = { value: "" };

      function pad2(n) { return (n < 10 ? "0" : "") + n; }
      function ymd(y, m, d) { return y + "-" + pad2(m + 1) + "-" + pad2(d); }
      var WD = lang === "en" ? ["S", "M", "T", "W", "T", "F", "S"] : ["D", "L", "M", "M", "J", "V", "S"];

      // Calendar container
      var calLabel = mk("label", labelStyle(pal)); calLabel.textContent = t.date + " *"; form.appendChild(calLabel);
      var cal = mk("div", { border: "1px solid " + pal.inputBorder, borderRadius: rad.field, padding: "10px", marginBottom: "12px", background: pal.inputBg });
      form.appendChild(cal);

      var calHead = mk("div", { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" });
      var prevB = mk("button", { width: "30px", height: "30px", borderRadius: "8px", border: "1px solid " + pal.inputBorder, background: "transparent", color: pal.text, cursor: "pointer", fontSize: "16px", lineHeight: "1" }, { type: "button" });
      prevB.innerHTML = "&#8249;";
      var monthLbl = mk("div", { fontWeight: "700", fontSize: "14px", color: pal.text });
      var nextB = mk("button", { width: "30px", height: "30px", borderRadius: "8px", border: "1px solid " + pal.inputBorder, background: "transparent", color: pal.text, cursor: "pointer", fontSize: "16px", lineHeight: "1" }, { type: "button" });
      nextB.innerHTML = "&#8250;";
      calHead.appendChild(prevB); calHead.appendChild(monthLbl); calHead.appendChild(nextB);
      cal.appendChild(calHead);

      var wdRow = mk("div", { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "2px", marginBottom: "4px" });
      WD.forEach(function (w) { var c = mk("div", { textAlign: "center", fontSize: "11px", fontWeight: "700", color: pal.sub, padding: "2px 0" }); c.textContent = w; wdRow.appendChild(c); });
      cal.appendChild(wdRow);

      var grid = mk("div", { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "3px" });
      cal.appendChild(grid);

      // Time slots
      var timeLabel = mk("label", labelStyle(pal)); timeLabel.textContent = t.time + " *"; form.appendChild(timeLabel);
      var timeWrap = mk("div", { display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px", minHeight: "38px", alignItems: "center" });
      var timeHint = mk("div", { fontSize: "13px", color: pal.sub }); timeHint.textContent = t.pickDate;
      timeWrap.appendChild(timeHint);
      form.appendChild(timeWrap);

      notesI = field(t.notes, st(mk("textarea", inputStyle(pal, rad)), { height: "70px", padding: "10px 12px", resize: "vertical" }));

      var avail = {};
      var availSet = {};
      var view = new Date();
      view.setDate(1);
      var minMonth = null, maxMonth = null;

      function mkey(dt) { return dt.getFullYear() * 12 + dt.getMonth(); }

      function renderTimes(dateStr) {
        timeWrap.innerHTML = "";
        timeSel.value = "";
        var slots = avail[dateStr] || [];
        if (!slots.length) { var h = mk("div", { fontSize: "13px", color: pal.sub }); h.textContent = t.pickTime; timeWrap.appendChild(h); return; }
        slots.forEach(function (s) {
          var chip = mk("button", { padding: "7px 12px", borderRadius: rad.field, border: "1px solid " + pal.inputBorder, background: pal.cardBg, color: pal.text, cursor: "pointer", fontSize: "13px", fontWeight: "600" }, { type: "button" });
          chip.textContent = s;
          chip.addEventListener("click", function () {
            timeSel.value = s;
            var all = timeWrap.querySelectorAll("button");
            for (var i = 0; i < all.length; i++) { all[i].style.background = pal.cardBg; all[i].style.color = pal.text; all[i].style.borderColor = pal.inputBorder; }
            chip.style.background = accent; chip.style.color = "#fff"; chip.style.borderColor = accent;
          });
          timeWrap.appendChild(chip);
        });
      }

      function renderMonth() {
        grid.innerHTML = "";
        monthLbl.textContent = view.toLocaleDateString(lang === "en" ? "en-US" : "es-ES", { month: "long", year: "numeric" });
        var y = view.getFullYear(), m = view.getMonth();
        var firstDow = new Date(y, m, 1).getDay();
        var days = new Date(y, m + 1, 0).getDate();
        for (var i = 0; i < firstDow; i++) grid.appendChild(mk("div", {}));
        for (var d = 1; d <= days; d++) {
          var ds = ymd(y, m, d);
          var isAvail = !!availSet[ds];
          var cell = mk("button", {
            height: "34px", borderRadius: "8px", border: "none", cursor: isAvail ? "pointer" : "default",
            fontSize: "13px", fontWeight: "600",
            background: dateSel.value === ds ? accent : "transparent",
            color: dateSel.value === ds ? "#fff" : (isAvail ? pal.text : pal.sub),
            opacity: isAvail ? "1" : "0.35",
          }, { type: "button", disabled: !isAvail });
          cell.textContent = String(d);
          if (isAvail) {
            (function (ds2) {
              cell.addEventListener("click", function () {
                dateSel.value = ds2;
                renderMonth();
                renderTimes(ds2);
              });
            })(ds);
          }
          grid.appendChild(cell);
        }
        prevB.style.visibility = (minMonth !== null && mkey(view) <= minMonth) ? "hidden" : "visible";
        nextB.style.visibility = (maxMonth !== null && mkey(view) >= maxMonth) ? "hidden" : "visible";
      }

      prevB.addEventListener("click", function () { view.setMonth(view.getMonth() - 1); renderMonth(); });
      nextB.addEventListener("click", function () { view.setMonth(view.getMonth() + 1); renderMonth(); });

      fetch(api("/public/card/" + encodeURIComponent(slug) + "/availability"))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d.enabled || !d.dates || !d.dates.length) {
            title.textContent = o.title || t.apptTitle;
            var no = mk("div", { color: pal.sub, fontSize: "14px", padding: "8px 0" });
            no.textContent = t.noAppt;
            form.innerHTML = "";
            form.appendChild(no);
            return;
          }
          d.dates.forEach(function (day) { avail[day.date] = day.slots; availSet[day.date] = true; });
          var keys = d.dates.map(function (x) { return x.date; }).sort();
          var first = new Date(keys[0] + "T00:00:00");
          var last = new Date(keys[keys.length - 1] + "T00:00:00");
          minMonth = mkey(first); maxMonth = mkey(last);
          view = new Date(first.getFullYear(), first.getMonth(), 1);
          renderMonth();
        })
        .catch(function () {});

      renderMonth();
    } else {

      msgI = field(t.message, st(mk("textarea", inputStyle(pal, rad)), { height: "90px", padding: "10px 12px", resize: "vertical" }));
    }

    var btn = mk("button", {
      width: "100%",
      height: "48px",
      marginTop: "4px",
      background: accent,
      color: "#fff",
      border: "none",
      borderRadius: rad.btn,
      fontSize: "16px",
      fontWeight: "700",
      cursor: "pointer",
    }, { type: "submit" });
    btn.textContent = type === "appointment" ? t.book : t.send;
    form.appendChild(btn);

    var errBox = mk("div", { color: "#f87171", fontSize: "13px", marginTop: "8px", display: "none" });
    form.appendChild(errBox);

    var powered;
    if (o.branding) {
      powered = mk("div", { textAlign: "center", fontSize: "11px", color: pal.sub, marginTop: "12px" });
      powered.textContent = t.powered;
      card.appendChild(powered);
    }

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
      var h = mk("div", { fontSize: "18px", fontWeight: "800", color: pal.text, marginBottom: "6px" });
      h.textContent = t.okTitle;
      var p = mk("div", { fontSize: "14px", color: pal.sub });
      p.textContent = msg;
      ok.appendChild(icon); ok.appendChild(h); ok.appendChild(p);
      if (powered) card.insertBefore(ok, powered); else card.appendChild(ok);
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

  // ==========================================================================
  // CHAT
  // ==========================================================================
  function uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function renderChat(o) {
    UI_FONT = o.font === "inherit" ? "inherit" : SYSTEM_FONT;
    var pal = palette(o.theme);
    var rad = radii(o.radius);
    var accent = o.accent;
    var lang = o.lang === "en" ? "en" : "es";
    var slug = o.slug;
    if (!slug) return;
    var t = T[lang];
    var side = o.position === "left" ? "left" : "right";
    var SKEY = "unitech_chat_" + slug;
    var session = (function () {
      try {
        var s = localStorage.getItem(SKEY);
        if (!s) { s = uuid(); localStorage.setItem(SKEY, s); }
        return s;
      } catch (e) { return uuid(); }
    })();

    // Floating launcher — circle icon, or a pill with text if data-launcher is set.
    var fabBase = {
      position: "fixed", bottom: "20px", zIndex: "2147483000",
      background: accent, color: "#fff", border: "none", cursor: "pointer",
      boxShadow: "0 8px 24px rgba(0,0,0,0.25)", display: "flex",
      alignItems: "center", justifyContent: "center", fontWeight: "700",
    };
    fabBase[side] = "20px";
    var fab;
    if (o.launcher) {
      fab = mk("button", fabBase);
      st(fab, { height: "54px", borderRadius: "27px", padding: "0 20px 0 16px", fontSize: "15px", gap: "8px" });
      var ic = mk("span", { fontSize: "20px" }); ic.innerHTML = "&#128172;";
      var lb = mk("span", {}); lb.textContent = o.launcher;
      fab.appendChild(ic); fab.appendChild(lb);
    } else {
      fab = mk("button", fabBase);
      st(fab, { width: "60px", height: "60px", borderRadius: "50%", fontSize: "26px" });
      fab.innerHTML = "&#128172;";
    }
    document.body.appendChild(fab);

    var panelCss = {
      position: "fixed", bottom: "20px", zIndex: "2147483001",
      width: "360px", maxWidth: "calc(100vw - 32px)", height: "520px",
      maxHeight: "calc(100vh - 40px)", background: pal.cardBg, borderRadius: rad.card,
      boxShadow: pal.shadow, display: "none",
      flexDirection: "column", overflow: "hidden", border: "1px solid " + pal.border,
    };
    panelCss[side] = "20px";
    var panel = mk("div", panelCss);
    document.body.appendChild(panel);

    var head = mk("div", { background: accent, color: "#fff", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" });
    var headTitle = mk("div", { fontWeight: "800", fontSize: "15px" });
    headTitle.textContent = o.title || t.chatTitle;
    var closeBtn = mk("button", { background: "transparent", border: "none", color: "#fff", fontSize: "22px", cursor: "pointer", lineHeight: "1" });
    closeBtn.innerHTML = "&times;";
    head.appendChild(headTitle); head.appendChild(closeBtn);
    panel.appendChild(head);

    var msgs = mk("div", { flex: "1", overflowY: "auto", padding: "14px", background: pal.msgsBg, display: "flex", flexDirection: "column", gap: "8px" });
    panel.appendChild(msgs);

    function bubble(text, who) {
      var b = mk("div", {
        maxWidth: "82%", padding: "9px 12px", borderRadius: "14px", fontSize: "14px", lineHeight: "1.4",
        whiteSpace: "pre-wrap", wordBreak: "break-word",
        alignSelf: who === "user" ? "flex-end" : "flex-start",
        background: who === "user" ? accent : pal.botBg,
        color: who === "user" ? "#fff" : pal.botText,
        border: who === "user" ? "none" : "1px solid " + pal.botBorder,
      });
      b.textContent = text;
      msgs.appendChild(b);
      msgs.scrollTop = msgs.scrollHeight;
      return b;
    }

    var inputBar = mk("div", { display: "flex", gap: "8px", padding: "10px", borderTop: "1px solid " + pal.border, background: pal.cardBg });
    var input = mk("input", { flex: "1", height: "42px", padding: "0 12px", border: "1px solid " + pal.inputBorder, background: pal.inputBg, color: pal.text, borderRadius: rad.field, fontSize: "14px", outline: "none" }, { type: "text", placeholder: t.chatPlaceholder });
    var sendB = mk("button", { width: "42px", height: "42px", borderRadius: rad.field, background: accent, color: "#fff", border: "none", cursor: "pointer", fontSize: "18px", flex: "none" }, {});
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

  // ==========================================================================
  // INIT
  // ==========================================================================
  var chatStarted = false;
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
        startChat(chatNodes[j]);
      }
    }
    // Auto-init from the <script> tag itself (WordPress/Wix strip empty divs).
    if (SCRIPT && SCRIPT.hasAttribute("data-unitech-chat")) {
      startChat(SCRIPT);
    }
  }

  function startChat(el) {
    if (chatStarted) return;
    var o = readOpts(el);
    if (!o.slug) return;
    chatStarted = true;
    renderChat(o);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
