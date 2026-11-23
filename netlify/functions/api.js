// Netlify Function: wraps the same Express app, stores tickets in Netlify Blobs.
const serverless = require("serverless-http");
const { createApp } = require("../../src/app");

exports.handler = async (event, context) => {
  const { getStore, connectLambda } = await import("@netlify/blobs");
  connectLambda(event);
  const blobs = getStore("tickets");

  const store = {
    get: (id) => blobs.get(id, { type: "json" }),
    save: (t) => blobs.setJSON(t.id, t),
    remove: (id) => blobs.delete(id),
    async all() {
      const { blobs: list } = await blobs.list();
      const items = await Promise.all(list.map((b) => blobs.get(b.key, { type: "json" })));
      return items.filter(Boolean);
    },
  };

  return serverless(createApp(store))(event, context);
};
