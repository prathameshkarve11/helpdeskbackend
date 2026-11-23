// Local dev server:  npm install && ADMIN_PASSWORD=secret npm start
const express = require("express");
const path = require("path");
const { createApp } = require("./src/app");
const store = require("./src/fileStore");

const app = createApp(store);
app.use(express.static(path.join(__dirname, "public")));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Open http://localhost:${port}   (admin: /admin.html)`);
  if (!process.env.ADMIN_PASSWORD) console.log('Admin password is "changeme" – set ADMIN_PASSWORD!');
});
