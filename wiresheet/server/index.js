const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = 8100;
const DATA_DIR = '/data/wiresheet';
const PAGES_FILE = path.join(DATA_DIR, 'pages.json');

app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Fehler beim Erstellen des Data-Verzeichnisses:', err);
  }
}

function getToken() {
  return process.env.SUPERVISOR_TOKEN || null;
}

async function haGet(path) {
  const token = getToken();
  if (!token) throw new Error('Kein SUPERVISOR_TOKEN');
  const response = await axios.get(`http://supervisor/core/api${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  });
  return response.data;
}

async function haPost(path, body) {
  const token = getToken();
  if (!token) throw new Error('Kein SUPERVISOR_TOKEN');
  const response = await axios.post(`http://supervisor/core/api${path}`, body, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  });
  return response.data;
}

app.get('/pages', async (req, res) => {
  try {
    const data = await fs.readFile(PAGES_FILE, 'utf-8');
    res.json(JSON.parse(data));
  } catch (err) {
    if (err.code === 'ENOENT') {
      const defaultPages = [
        { id: 'page-1', name: 'Seite 1', cycleMs: 1000, running: false, nodes: [], connections: [] }
      ];
      res.json(defaultPages);
    } else {
      res.status(500).json({ error: 'Fehler beim Laden der Seiten' });
    }
  }
});

app.post('/pages', async (req, res) => {
  try {
    await ensureDataDir();
    await fs.writeFile(PAGES_FILE, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (err) {
    console.error('Fehler beim Speichern der Seiten:', err);
    res.status(500).json({ error: 'Fehler beim Speichern der Seiten' });
  }
});

app.get('/ha/states', async (req, res) => {
  try {
    const data = await haGet('/states');
    res.json(data);
  } catch (err) {
    console.error('Fehler beim Abrufen der HA States:', err.message);
    res.status(503).json({ error: 'Home Assistant nicht erreichbar', details: err.message });
  }
});

app.get('/ha/states/:entityId', async (req, res) => {
  try {
    const data = await haGet(`/states/${req.params.entityId}`);
    res.json(data);
  } catch (err) {
    res.status(503).json({ error: 'Entity nicht gefunden', details: err.message });
  }
});

app.get('/ha/services', async (req, res) => {
  try {
    const data = await haGet('/services');
    res.json(data);
  } catch (err) {
    res.status(503).json({ error: 'Home Assistant nicht erreichbar', details: err.message });
  }
});

app.post('/ha/services/:domain/:service', async (req, res) => {
  try {
    const { domain, service } = req.params;
    const data = await haPost(`/services/${domain}/${service}`, req.body);
    res.json(data);
  } catch (err) {
    res.status(503).json({ error: 'Service-Aufruf fehlgeschlagen', details: err.message });
  }
});

app.post('/ha/call', async (req, res) => {
  try {
    const { domain, service, data: serviceData } = req.body;
    const result = await haPost(`/services/${domain}/${service}`, serviceData || {});
    res.json({ success: true, result });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

app.post('/pages/:pageId/execute', async (req, res) => {
  const { nodes, connections } = req.body;
  try {
    const nodeValues = {};
    const statePromises = nodes
      .filter(n => (n.type === 'ha-input') && n.data.entityId)
      .map(async (n) => {
        try {
          const state = await haGet(`/states/${n.data.entityId}`);
          const val = parseFloat(state.state);
          nodeValues[n.id] = isNaN(val) ? state.state : val;
        } catch {
          nodeValues[n.id] = null;
        }
      });

    await Promise.all(statePromises);

    const topoOrder = [];
    const visited = new Set();
    const getInputs = (nodeId) => connections.filter(c => c.target === nodeId).map(c => c.source);

    const visit = (nodeId) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      for (const srcId of getInputs(nodeId)) visit(srcId);
      topoOrder.push(nodeId);
    };
    nodes.forEach(n => visit(n.id));

    for (const nodeId of topoOrder) {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) continue;
      const incomingConns = connections.filter(c => c.target === nodeId);
      const inputVals = incomingConns.map(c => nodeValues[c.source]);

      const cfg = node.data.config || {};

      if (node.type === 'and-gate') {
        nodeValues[nodeId] = inputVals.length > 0 && inputVals.every(v => !!v);
      } else if (node.type === 'or-gate') {
        nodeValues[nodeId] = inputVals.some(v => !!v);
      } else if (node.type === 'not-gate') {
        nodeValues[nodeId] = !inputVals[0];
      } else if (node.type === 'compare') {
        const a = parseFloat(inputVals[0]) || 0;
        const b = cfg.compareValue !== undefined ? parseFloat(cfg.compareValue) : (parseFloat(inputVals[1]) || 0);
        const op = cfg.compareOperator || '>';
        if (op === '>') nodeValues[nodeId] = a > b;
        else if (op === '>=') nodeValues[nodeId] = a >= b;
        else if (op === '==') nodeValues[nodeId] = a == b;
        else if (op === '<=') nodeValues[nodeId] = a <= b;
        else if (op === '<') nodeValues[nodeId] = a < b;
        else if (op === '!=') nodeValues[nodeId] = a != b;
        else nodeValues[nodeId] = false;
      } else if (node.type === 'threshold') {
        const val = parseFloat(inputVals[0]) || 0;
        const thr = cfg.thresholdValue !== undefined ? parseFloat(cfg.thresholdValue) : 0;
        nodeValues[nodeId] = val > thr ? 'above' : 'below';
      } else if (node.type === 'delay') {
        nodeValues[nodeId] = inputVals[0];
      } else if (node.type === 'ha-output' && node.data.entityId) {
        const val = inputVals[0];
        if (val !== null && val !== undefined) {
          const entityId = node.data.entityId;
          const [domain] = entityId.split('.');
          try {
            if (domain === 'light') {
              await haPost(`/services/light/${val ? 'turn_on' : 'turn_off'}`, { entity_id: entityId });
            } else if (domain === 'switch') {
              await haPost(`/services/switch/${val ? 'turn_on' : 'turn_off'}`, { entity_id: entityId });
            } else if (domain === 'input_boolean') {
              await haPost(`/services/input_boolean/${val ? 'turn_on' : 'turn_off'}`, { entity_id: entityId });
            } else if (domain === 'input_number') {
              await haPost('/services/input_number/set_value', { entity_id: entityId, value: val });
            }
            nodeValues[nodeId] = val;
          } catch (e) {
            nodeValues[nodeId] = null;
          }
        }
      }
    }

    res.json({ success: true, nodeValues });
  } catch (err) {
    console.error('Execute error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

async function start() {
  await ensureDataDir();
  app.listen(PORT, () => {
    console.log(`Wiresheet API Server auf Port ${PORT}`);
  });
}

start().catch(console.error);
