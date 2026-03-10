const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = 8100;
const DATA_DIR = '/data/wiresheet';
const FLOWS_FILE = path.join(DATA_DIR, 'flows.json');

app.use(express.json());

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Fehler beim Erstellen des Data-Verzeichnisses:', err);
  }
}

async function getHomeAssistantToken() {
  try {
    const token = process.env.SUPERVISOR_TOKEN;
    return token;
  } catch (err) {
    console.error('Fehler beim Abrufen des HA Tokens:', err);
    return null;
  }
}

app.get('/flows', async (req, res) => {
  try {
    const data = await fs.readFile(FLOWS_FILE, 'utf-8');
    res.json(JSON.parse(data));
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.json({ nodes: [], connections: [] });
    } else {
      res.status(500).json({ error: 'Fehler beim Laden der Flows' });
    }
  }
});

app.post('/flows', async (req, res) => {
  try {
    await fs.writeFile(FLOWS_FILE, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (err) {
    console.error('Fehler beim Speichern der Flows:', err);
    res.status(500).json({ error: 'Fehler beim Speichern der Flows' });
  }
});

app.get('/ha/states', async (req, res) => {
  try {
    const token = await getHomeAssistantToken();
    if (!token) {
      return res.status(401).json({ error: 'Kein HA Token verfügbar' });
    }

    const response = await axios.get('http://supervisor/core/api/states', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    res.json(response.data);
  } catch (err) {
    console.error('Fehler beim Abrufen der HA States:', err);
    res.status(500).json({ error: 'Fehler beim Abrufen der Home Assistant States' });
  }
});

app.get('/ha/services', async (req, res) => {
  try {
    const token = await getHomeAssistantToken();
    if (!token) {
      return res.status(401).json({ error: 'Kein HA Token verfügbar' });
    }

    const response = await axios.get('http://supervisor/core/api/services', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    res.json(response.data);
  } catch (err) {
    console.error('Fehler beim Abrufen der HA Services:', err);
    res.status(500).json({ error: 'Fehler beim Abrufen der Home Assistant Services' });
  }
});

app.post('/ha/services/:domain/:service', async (req, res) => {
  try {
    const token = await getHomeAssistantToken();
    if (!token) {
      return res.status(401).json({ error: 'Kein HA Token verfügbar' });
    }

    const { domain, service } = req.params;
    const response = await axios.post(
      `http://supervisor/core/api/services/${domain}/${service}`,
      req.body,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json(response.data);
  } catch (err) {
    console.error('Fehler beim Aufrufen des HA Service:', err);
    res.status(500).json({ error: 'Fehler beim Aufrufen des Home Assistant Service' });
  }
});

app.post('/flows/execute', async (req, res) => {
  try {
    const { nodes, connections } = req.body;

    console.log('Führe Flow aus mit', nodes.length, 'Nodes und', connections.length, 'Verbindungen');

    res.json({
      success: true,
      message: 'Flow wird ausgeführt',
      executed: nodes.length
    });
  } catch (err) {
    console.error('Fehler beim Ausführen des Flows:', err);
    res.status(500).json({ error: 'Fehler beim Ausführen des Flows' });
  }
});

async function start() {
  await ensureDataDir();

  app.listen(PORT, () => {
    console.log(`Wiresheet API Server läuft auf Port ${PORT}`);
  });
}

start().catch(console.error);
