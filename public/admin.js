const $ = (id) => document.getElementById(id);
let password = sessionStorage.getItem("helpdesk-admin") || "";
let timer = null;

async function api(path, opts = {}) {
  const res = await fetch("/api" + path, {
    ...opts,
    headers: { "Content-Type": "application/json", "x-admin-password": password },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { logout(); throw new Error(data.error || "Wrong password."); }
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

function logout() {
  password = "";
  sessionStorage.removeItem("helpdesk-admin");
  clearInterval(timer);
  $("listView").classList.add("hidden");
  $("loginView").classList.remove("hidden");
}

function card(t) {
  const el = document.createElement("div");
  el.className = "card";

  const top = document.createElement("div");
  top.className = "top";
  const h = document.createElement("h3");
  h.textContent = t.name + " · " + t.email;
  const badge = document.createElement("span");
  badge.className = "badge " + t.status;
  badge.textContent = t.status === "answered" ? "Answered" : "Needs reply";
  top.append(h, badge);

  const thread = document.createElement("div");
  thread.className = "thread";
  for (const m of t.messages) {
    const d = document.createElement("div");
    d.className = "msg " + m.from;
    const s = document.createElement("small");
    s.textContent = m.author + " · " + new Date(m.at).toLocaleString();
    const b = document.createElement("span");
    b.textContent = m.text;
    d.append(s, b);
    thread.append(d);
  }

  const form = document.createElement("form");
  const ta = document.createElement("textarea");
  ta.placeholder = "Write a reply…";
  ta.required = true;
  const send = document.createElement("button");
  send.textContent = "Send reply";
  const del = document.createElement("button");
  del.type = "button";
  del.className = "danger";
  del.textContent = "Delete";
  del.style.marginLeft = "8px";
  const err = document.createElement("p");
  err.className = "err";
  form.append(ta, send, del, err);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api(`/admin/tickets/${t.id}/reply`, {
        method: "POST",
        body: JSON.stringify({ author: $("author").value, text: ta.value }),
      });
      localStorage.setItem("helpdesk-author", $("author").value);
      await refresh();
    } catch (x) { err.textContent = x.message; }
  });
  del.addEventListener("click", async () => {
    if (!confirm("Delete this request permanently?")) return;
    try { await api(`/admin/tickets/${t.id}`, { method: "DELETE" }); await refresh(); }
    catch (x) { err.textContent = x.message; }
  });

  el.append(top, thread, form);
  return el;
}

async function refresh() {
  // don't wipe a reply someone is typing: skip auto-refresh while a textarea has text
  const typing = [...document.querySelectorAll("#tickets textarea")].some((x) => x.value.trim());
  if (typing && refresh.auto) return;
  const list = await api("/admin/tickets");
  const box = $("tickets");
  box.textContent = "";
  list.forEach((t) => box.append(card(t)));
  const waiting = list.filter((t) => t.status === "waiting").length;
  $("count").textContent = `${list.length} request(s), ${waiting} waiting for a reply`;
}

function enter() {
  $("loginView").classList.add("hidden");
  $("listView").classList.remove("hidden");
  $("author").value = localStorage.getItem("helpdesk-author") || "";
  refresh.auto = false;
  refresh().catch(() => {});
  clearInterval(timer);
  timer = setInterval(() => { refresh.auto = true; refresh().catch(() => {}); }, 20000);
}

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("loginErr").textContent = "";
  password = $("pw").value;
  try {
    await api("/admin/tickets");
    sessionStorage.setItem("helpdesk-admin", password);
    enter();
  } catch (err) { $("loginErr").textContent = err.message; }
});
$("refresh").addEventListener("click", () => { refresh.auto = false; refresh().catch(() => {}); });
$("logout").addEventListener("click", logout);

if (password) api("/admin/tickets").then(enter).catch(() => {});
