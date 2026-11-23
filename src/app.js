// Shared Express app. It only talks to a "store" object, so the same code runs
// locally (JSON file) and on Netlify (Netlify Blobs, which stores JSON too).
const express = require("express");
const crypto = require("crypto");

function createApp(store) {
  const app = express();
  app.use(express.json({ limit: "50kb" }));
  // serverless can hand us the body as a Buffer – normalise it
  app.use((req, _res, next) => {
    if (Buffer.isBuffer(req.body)) {
      try { req.body = JSON.parse(req.body.toString("utf8")); } catch { req.body = {}; }
    }
    next();
  });

  const router = express.Router();
  const wrap = (fn) => (req, res) =>
    fn(req, res).catch((err) => {
      console.error(err);
      res.status(500).json({ error: "Server error, please try again." });
    });

  const clean = (v, max) => String(v || "").trim().slice(0, max);
  const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const adminOnly = (req, res, next) => {
    const pw = process.env.ADMIN_PASSWORD || "changeme";
    if (req.get("x-admin-password") === pw) return next();
    res.status(401).json({ error: "Wrong admin password." });
  };

  // what a visitor is allowed to see
  const view = (t) => ({
    id: t.id, name: t.name, email: t.email,
    createdAt: t.createdAt, messages: t.messages,
    status: t.messages[t.messages.length - 1].from === "admin" ? "answered" : "waiting",
  });

  // ---------- visitor routes ----------
  router.post("/tickets", wrap(async (req, res) => {
    const name = clean(req.body.name, 80);
    const email = clean(req.body.email, 120).toLowerCase();
    const text = clean(req.body.message, 3000);
    if (!name || !validEmail(email) || !text)
      return res.status(400).json({ error: "Please fill in your name, a valid email and your problem." });
    const ticket = {
      id: crypto.randomBytes(8).toString("hex"), // 16-char secret code
      name, email,
      createdAt: new Date().toISOString(),
      messages: [{ from: "user", author: name, text, at: new Date().toISOString() }],
    };
    await store.save(ticket);
    res.json(view(ticket));
  }));

  // a request is only returned if BOTH the code and the email match
  async function owned(req, res) {
    const t = await store.get(clean(req.params.id, 40));
    const email = clean(req.query.email || (req.body && req.body.email), 120).toLowerCase();
    if (!t || t.email !== email) {
      res.status(404).json({ error: "Request not found. Check your code and email." });
      return null;
    }
    return t;
  }

  router.get("/tickets/:id", wrap(async (req, res) => {
    const t = await owned(req, res);
    if (t) res.json(view(t));
  }));

  router.post("/tickets/:id/messages", wrap(async (req, res) => {
    const t = await owned(req, res);
    if (!t) return;
    const text = clean(req.body.text, 3000);
    if (!text) return res.status(400).json({ error: "Message is empty." });
    t.messages.push({ from: "user", author: t.name, text, at: new Date().toISOString() });
    await store.save(t);
    res.json(view(t));
  }));

  // ---------- admin routes ----------
  router.get("/admin/tickets", adminOnly, wrap(async (_req, res) => {
    const all = await store.all();
    const last = (t) => t.messages[t.messages.length - 1].at;
    all.sort((a, b) => last(b).localeCompare(last(a)));
    res.json(all.map(view));
  }));

  router.post("/admin/tickets/:id/reply", adminOnly, wrap(async (req, res) => {
    const t = await store.get(clean(req.params.id, 40));
    if (!t) return res.status(404).json({ error: "Not found." });
    const text = clean(req.body.text, 3000);
    const author = clean(req.body.author, 60) || "Support";
    if (!text) return res.status(400).json({ error: "Reply is empty." });
    t.messages.push({ from: "admin", author, text, at: new Date().toISOString() });
    await store.save(t);
    res.json(view(t));
  }));

  router.delete("/admin/tickets/:id", adminOnly, wrap(async (req, res) => {
    await store.remove(clean(req.params.id, 40));
    res.json({ ok: true });
  }));

  app.use(["/api", "/.netlify/functions/api"], router);
  return app;
}

module.exports = { createApp };
