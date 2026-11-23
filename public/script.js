const $ = (id) => document.getElementById(id);
const KEY = "helpdesk-ticket";
let current = null; // { id, email }
let timer = null;

async function api(path, opts = {}) {
  const res = await fetch("/api" + path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

function fmt(iso) { return new Date(iso).toLocaleString(); }

function showTicket(t) {
  $("newView").classList.add("hidden");
  $("lookupView").classList.add("hidden");
  $("ticketView").classList.remove("hidden");
  $("codeLine").textContent = t.id;
  const st = $("status");
  st.textContent = t.status === "answered" ? "Answered" : "Waiting for reply";
  st.className = "badge " + t.status;

  const thread = $("thread");
  thread.textContent = "";
  for (const m of t.messages) {
    const div = document.createElement("div");
    div.className = "msg " + m.from;
    const small = document.createElement("small");
    small.textContent = (m.from === "admin" ? m.author + " (support)" : "You") + " · " + fmt(m.at);
    const body = document.createElement("span");
    body.textContent = m.text; // textContent = safe from HTML injection
    div.append(small, body);
    thread.append(div);
  }
}

function showNew() {
  clearInterval(timer);
  current = null;
  localStorage.removeItem(KEY);
  $("ticketView").classList.add("hidden");
  $("newView").classList.remove("hidden");
  $("lookupView").classList.remove("hidden");
}

async function load() {
  if (!current) return;
  const t = await api(`/tickets/${current.id}?email=${encodeURIComponent(current.email)}`);
  showTicket(t);
}

function open(id, email) {
  current = { id, email };
  localStorage.setItem(KEY, JSON.stringify(current));
  clearInterval(timer);
  timer = setInterval(() => load().catch(() => {}), 15000); // auto-refresh for new replies
}

$("newForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("newErr").textContent = "";
  try {
    const email = $("email").value.trim().toLowerCase();
    const t = await api("/tickets", {
      method: "POST",
      body: JSON.stringify({ name: $("name").value, email, message: $("message").value }),
    });
    e.target.reset();
    open(t.id, email);
    showTicket(t);
  } catch (err) { $("newErr").textContent = err.message; }
});

$("followForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("followErr").textContent = "";
  try {
    const t = await api(`/tickets/${current.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ email: current.email, text: $("follow").value }),
    });
    e.target.reset();
    showTicket(t);
  } catch (err) { $("followErr").textContent = err.message; }
});

$("lookupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("lookupErr").textContent = "";
  try {
    const id = $("lcode").value.trim();
    const email = $("lemail").value.trim().toLowerCase();
    const t = await api(`/tickets/${encodeURIComponent(id)}?email=${encodeURIComponent(email)}`);
    open(id, email);
    showTicket(t);
  } catch (err) { $("lookupErr").textContent = err.message; }
});

$("newBtn").addEventListener("click", showNew);

// returning visitor on the same browser: reopen automatically
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || "null");
  if (saved) {
    current = saved;
    open(saved.id, saved.email);
    load().catch(() => showNew());
  }
} catch { /* ignore */ }
