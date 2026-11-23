// Local development store: one JSON file on disk.
const fs = require("fs/promises");
const path = require("path");

const FILE = path.join(__dirname, "..", "data", "tickets.json");

async function read() {
  try { return JSON.parse(await fs.readFile(FILE, "utf8")); }
  catch { return {}; }
}
async function write(data) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(data, null, 2));
}

module.exports = {
  async get(id) { return (await read())[id] || null; },
  async save(t) { const d = await read(); d[t.id] = t; await write(d); },
  async all() { return Object.values(await read()); },
  async remove(id) { const d = await read(); delete d[id]; await write(d); },
};
