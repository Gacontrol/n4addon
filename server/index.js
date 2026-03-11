import express from "express";
import fetch from "node-fetch";
import WebSocket from "ws";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const HA_URL = process.env.HA_URL || "http://homeassistant:8123";
const HA_TOKEN = process.env.HA_TOKEN;

let clients = [];

/* -------------------------
   Home Assistant Websocket
------------------------- */

const ws = new WebSocket(`${HA_URL.replace("http", "ws")}/api/websocket`);

ws.on("open", () => {
  console.log("Connected to Home Assistant WebSocket");
});

ws.on("message", (data) => {
  const msg = JSON.parse(data);

  if (msg.type === "auth_required") {
    ws.send(JSON.stringify({
      type: "auth",
      access_token: HA_TOKEN
    }));
  }

  if (msg.type === "auth_ok") {
    console.log("HA authentication successful");

    ws.send(JSON.stringify({
      id: 1,
      type: "subscribe_events",
      event_type: "state_changed"
    }));
  }

  if (msg.type === "event" && msg.event?.event_type === "state_changed") {

    const payload = {
      entity_id: msg.event.data.entity_id,
      state: msg.event.data.new_state
    };

    clients.forEach(res => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    });

  }
});

/* -------------------------
   SSE Stream für Visus
------------------------- */

app.get("/events", (req, res) => {

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  });

  res.flushHeaders();

  clients.push(res);

  req.on("close", () => {
    clients = clients.filter(c => c !== res);
  });

});

/* -------------------------
   REST Proxy (wie vorher)
------------------------- */

app.get("/ha/states", async (req, res) => {

  const r = await fetch(`${HA_URL}/api/states`, {
    headers: {
      Authorization: `Bearer ${HA_TOKEN}`,
      "Content-Type": "application/json"
    }
  });

  const data = await r.json();
  res.json(data);

});

app.post("/ha/services/:domain/:service", async (req, res) => {

  const { domain, service } = req.params;

  const r = await fetch(`${HA_URL}/api/services/${domain}/${service}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HA_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(req.body)
  });

  const data = await r.json();
  res.json(data);

});

/* ------------------------- */

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
