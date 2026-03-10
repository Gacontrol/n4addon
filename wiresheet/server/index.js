const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = 8100;

const DATA_PATHS = [
  '/data/wiresheet',
  '/config/wiresheet',
  '/share/wiresheet',
  path.join(__dirname, '../data')
];

let dataDir = DATA_PATHS[0];
let pagesFile = path.join(dataDir, 'pages.json');

app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

async function findWritableDataDir() {
  for (const dir of DATA_PATHS) {
    try {
      await fs.mkdir(dir, { recursive: true });
      const testFile = path.join(dir, '.write-test');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      console.log(`Nutze Data-Verzeichnis: ${dir}`);
      return dir;
    } catch (err) {
      console.log(`Verzeichnis ${dir} nicht schreibbar:`, err.message);
    }
  }
  throw new Error('Kein schreibbares Data-Verzeichnis gefunden');
}

function getToken() {
  return process.env.SUPERVISOR_TOKEN || null;
}

function getHaBaseUrl() {
  if (process.env.SUPERVISOR_TOKEN) {
    return 'http://supervisor/core/api';
  }
  return null;
}

async function haGet(apiPath) {
  const token = getToken();
  const baseUrl = getHaBaseUrl();
  if (!token || !baseUrl) {
    throw new Error('Kein SUPERVISOR_TOKEN - laeuft das Addon in Home Assistant?');
  }
  const response = await axios.get(`${baseUrl}${apiPath}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    timeout: 10000
  });
  return response.data;
}

async function haPost(apiPath, body) {
  const token = getToken();
  const baseUrl = getHaBaseUrl();
  if (!token || !baseUrl) {
    throw new Error('Kein SUPERVISOR_TOKEN - laeuft das Addon in Home Assistant?');
  }
  const response = await axios.post(`${baseUrl}${apiPath}`, body, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    timeout: 10000
  });
  return response.data;
}

app.get('/api/status', (req, res) => {
  res.json({
    dataDir,
    haConnected: !!getToken(),
    supervisorToken: getToken() ? 'vorhanden' : 'fehlt'
  });
});

app.get(['/pages', '/api/pages'], async (req, res) => {
  try {
    const data = await fs.readFile(pagesFile, 'utf-8');
    const pages = JSON.parse(data);
    console.log(`Geladen: ${pages.length} Seiten aus ${pagesFile}`);
    res.json(pages);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log('Keine Seiten-Datei gefunden, verwende Standard');
      const defaultPages = [
        { id: 'page-1', name: 'Seite 1', cycleMs: 1000, running: false, nodes: [], connections: [] }
      ];
      res.json(defaultPages);
    } else {
      console.error('Fehler beim Laden:', err);
      res.status(500).json({ error: 'Fehler beim Laden der Seiten', details: err.message });
    }
  }
});

app.post(['/pages', '/api/pages'], async (req, res) => {
  try {
    const pages = req.body;
    if (!Array.isArray(pages)) {
      return res.status(400).json({ error: 'Ungueltige Daten - Array erwartet' });
    }
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(pagesFile, JSON.stringify(pages, null, 2));
    console.log(`Gespeichert: ${pages.length} Seiten nach ${pagesFile}`);
    res.json({ success: true, saved: pages.length });
  } catch (err) {
    console.error('Fehler beim Speichern:', err);
    res.status(500).json({ error: 'Fehler beim Speichern der Seiten', details: err.message });
  }
});

app.get(['/ha/states', '/api/ha/states'], async (req, res) => {
  try {
    const data = await haGet('/states');
    console.log(`HA States geladen: ${data.length} Entities`);
    res.json(data);
  } catch (err) {
    console.error('Fehler beim Abrufen der HA States:', err.message);
    res.status(503).json({ error: err.message });
  }
});

app.get(['/ha/states/:entityId', '/api/ha/states/:entityId'], async (req, res) => {
  try {
    const data = await haGet(`/states/${req.params.entityId}`);
    res.json(data);
  } catch (err) {
    res.status(503).json({ error: 'Entity nicht gefunden', details: err.message });
  }
});

app.get(['/ha/services', '/api/ha/services'], async (req, res) => {
  try {
    const data = await haGet('/services');
    res.json(data);
  } catch (err) {
    res.status(503).json({ error: 'Home Assistant nicht erreichbar', details: err.message });
  }
});

app.post(['/ha/services/:domain/:service', '/api/ha/services/:domain/:service'], async (req, res) => {
  try {
    const { domain, service } = req.params;
    const data = await haPost(`/services/${domain}/${service}`, req.body);
    res.json(data);
  } catch (err) {
    res.status(503).json({ error: 'Service-Aufruf fehlgeschlagen', details: err.message });
  }
});

app.post(['/ha/call', '/api/ha/call'], async (req, res) => {
  try {
    const { domain, service, data: serviceData } = req.body;
    const result = await haPost(`/services/${domain}/${service}`, serviceData || {});
    res.json({ success: true, result });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

app.post(['/pages/:pageId/execute', '/api/pages/:pageId/execute'], async (req, res) => {
  const { nodes, connections, manualOverrides = {} } = req.body;
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

      if (manualOverrides[nodeId] !== undefined) {
        nodeValues[nodeId] = manualOverrides[nodeId];
      } else if (node.type === 'ha-input') {
        // already loaded above
      } else if (node.type === 'dp-boolean' || node.type === 'dp-numeric' || node.type === 'dp-enum') {
        nodeValues[nodeId] = inputVals[0] !== undefined ? inputVals[0] : null;
      } else if (node.type === 'and-gate') {
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
            console.error(`HA Output Fehler fuer ${entityId}:`, e.message);
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
  try {
    dataDir = await findWritableDataDir();
    pagesFile = path.join(dataDir, 'pages.json');
    console.log(`Data-Verzeichnis: ${dataDir}`);
    console.log(`Pages-Datei: ${pagesFile}`);
    console.log(`SUPERVISOR_TOKEN: ${getToken() ? 'vorhanden' : 'FEHLT'}`);

    app.listen(PORT, () => {
      console.log(`Wiresheet API Server auf Port ${PORT}`);
    });
  } catch (err) {
    console.error('Start fehlgeschlagen:', err);
    process.exit(1);
  }
}

start().catch(console.error);
