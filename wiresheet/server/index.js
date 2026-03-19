const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const axios = require('axios');
const { spawn } = require('child_process');
const dpStore = require('./dpStore');

const app = express();
const visuApp = express();
const PORT = 8100;
const VISU_PORT = 8101;

const DATA_PATHS = [
  '/data/wiresheet',
  '/config/wiresheet',
  '/share/wiresheet',
  path.join(__dirname, '../data')
];

let dataDir = DATA_PATHS[0];
let pagesFile = path.join(dataDir, 'pages.json');
let blocksFile = path.join(dataDir, 'custom-blocks.json');
let visuPagesFile = path.join(dataDir, 'visu-pages.json');
let dpValuesFile = path.join(dataDir, 'dp-values.json');
let driverConfigFile = path.join(dataDir, 'driver-config.json');
let alarmConfigFile = path.join(dataDir, 'alarm-config.json');
let trendConfigFile = path.join(dataDir, 'trend-config.json');
let trendDataDir = path.join(dataDir, 'trends');
let buildingConfigFile = path.join(dataDir, 'building-config.json');

const trendConfig = { trackedNodes: [] };
const trendBuffers = new Map();
const TREND_FLUSH_INTERVAL = 30000;
const TREND_MAX_BUFFER = 500;
const TREND_MAX_POINTS_PER_FILE = 86400;
let trendFlushTimer = null;

const runningPages = new Map();
const pageNodeStates = new Map();
const lastNodeValues = new Map();
const impulseQueue = new Map();

let driverConfig = {
  modbusDevices: [],
  modbusDriverEnabled: true,
  driverBindings: [],
  haDriverEnabled: true
};
const modbusLiveValues = new Map();
const haLiveValues = new Map();
const haLastWrittenValues = new Map();
let driverPollingInterval = null;
const DRIVER_POLL_INTERVAL = 2000;
let isPollingRunning = false;
const modbusDeviceOnlineStatus = new Map();

async function pingModbusDevice(device) {
  const net = require('net');
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (online) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(online);
    };
    socket.setTimeout(2000);
    socket.on('connect', () => finish(true));
    socket.on('error', () => finish(false));
    socket.on('timeout', () => finish(false));
    socket.connect(device.port || 502, device.host);
  });
}

async function pollAllDrivers() {
  if (isPollingRunning) return;
  isPollingRunning = true;
  try {
  if (!driverConfig.modbusDriverEnabled && !driverConfig.haDriverEnabled) {
    isPollingRunning = false;
    return;
  }

  if (driverConfig.modbusDriverEnabled) {
    const enabledDevices = (driverConfig.modbusDevices || []).filter(d => d.enabled);
    for (const device of enabledDevices) {
      const online = await pingModbusDevice(device);
      modbusDeviceOnlineStatus.set(device.id, { online, lastSeen: online ? Date.now() : (modbusDeviceOnlineStatus.get(device.id)?.lastSeen) });
      if (!online) {
        console.log(`Modbus device ${device.name} (${device.host}) offline - skipping poll`);
        continue;
      }
      for (const dp of (device.datapoints || [])) {
        if (dp.isConfig) continue;
        try {
          let rawValue = await modbusReadRegister(
            device.host,
            device.port,
            device.unitId,
            dp.address,
            dp.registerType || 'holding',
            dp.dataType || 'uint16',
            device.timeout || 3000
          );
          let value = rawValue;
          if (dp.scale && dp.scale !== 1) value = value * dp.scale;
          if (dp.offset) value = value + dp.offset;
          if (dp.bitIndex !== undefined && dp.bitIndex >= 0) {
            value = (rawValue >> dp.bitIndex) & 1 ? true : false;
          }
          modbusLiveValues.set(`${device.id}:${dp.id}`, value);
        } catch (err) {
          console.log(`Modbus poll error ${device.name}/${dp.name}: ${err.message}`);
        }
      }
    }
  }

  if (driverConfig.haDriverEnabled) {
    try {
      const token = getToken();
      if (token) {
        const haRes = await fetch('http://supervisor/core/api/states', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (haRes.ok) {
          const states = await haRes.json();
          for (const entity of states) {
            haLiveValues.set(entity.entity_id, {
              state: entity.state,
              attributes: entity.attributes
            });
          }
        }
      }
    } catch (err) {
      console.log(`HA poll error: ${err.message}`);
    }
  }

  broadcastSSE('driver-values', {
    modbus: Object.fromEntries(modbusLiveValues),
    ha: Object.fromEntries(haLiveValues)
  });
  broadcastSSE('modbus-device-status', Object.fromEntries(modbusDeviceOnlineStatus));
  } catch (err) {
    console.error('pollAllDrivers error:', err.message);
  } finally {
    isPollingRunning = false;
  }
}

function startDriverPolling() {
  if (driverPollingInterval) {
    clearInterval(driverPollingInterval);
  }
  if (driverConfig.modbusDriverEnabled || driverConfig.haDriverEnabled) {
    console.log('Starte Treiber-Polling...');
    pollAllDrivers();
    driverPollingInterval = setInterval(pollAllDrivers, DRIVER_POLL_INTERVAL);
  }
}

function stopDriverPolling() {
  if (driverPollingInterval) {
    clearInterval(driverPollingInterval);
    driverPollingInterval = null;
    console.log('Treiber-Polling gestoppt');
  }
}

async function loadPersistentDpValues() {
  await dpStore.load(dpValuesFile, fs);
}

function setPersistentDpValue(nodeId, value) {
  dpStore.set(nodeId, value, { persist: true });
}

async function loadDriverConfig() {
  try {
    const data = await fs.readFile(driverConfigFile, 'utf-8');
    const cfg = JSON.parse(data);
    driverConfig = {
      modbusDevices: cfg.modbusDevices || [],
      modbusDriverEnabled: cfg.modbusDriverEnabled !== false,
      driverBindings: cfg.driverBindings || [],
      haDriverEnabled: cfg.haDriverEnabled !== false
    };
    console.log(`Treiber-Konfiguration geladen: ${driverConfig.modbusDevices.length} Modbus-Geraete, ${driverConfig.driverBindings.length} Bindings`);
    startDriverPolling();
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Fehler beim Laden der Treiber-Konfiguration:', err.message);
    }
  }
}

async function saveDriverConfig() {
  try {
    await fs.writeFile(driverConfigFile, JSON.stringify(driverConfig, null, 2));
    console.log('Treiber-Konfiguration gespeichert');
  } catch (err) {
    console.error('Fehler beim Speichern der Treiber-Konfiguration:', err.message);
  }
}

function getNodeState(pageId, nodeId) {
  if (!pageNodeStates.has(pageId)) pageNodeStates.set(pageId, {});
  const ps = pageNodeStates.get(pageId);
  if (!ps[nodeId]) ps[nodeId] = {};
  return ps[nodeId];
}

let cachedDeviceRegistry = null;
let cachedEntityRegistry = null;
let cachedConfigEntries = null;
let registryCacheTime = 0;
const REGISTRY_CACHE_TTL = 60000;

app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use((req, res, next) => {
  const ingressMatch = req.path.match(/^\/api\/hassio_ingress\/[^/]+(\/api\/.*)$/);
  if (ingressMatch) {
    req.url = ingressMatch[1];
    return next();
  }
  const appMatch = req.path.match(/^\/app\/[^/]+(\/api\/.*)$/);
  if (appMatch) {
    req.url = appMatch[1];
    return next();
  }
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
  if (process.env.SUPERVISOR_TOKEN) {
    return process.env.SUPERVISOR_TOKEN;
  }
  if (process.env.HASSIO_TOKEN) {
    return process.env.HASSIO_TOKEN;
  }
  try {
    if (fsSync.existsSync('/run/secrets/supervisor_token')) {
      return fsSync.readFileSync('/run/secrets/supervisor_token', 'utf8').trim();
    }
  } catch {}
  return null;
}

function getHaBaseUrl() {
  if (getToken()) {
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

async function haWsCommand(msgType, payload = {}) {
  const token = getToken();
  if (!token) {
    throw new Error('Kein Token');
  }
  const response = await axios.post(
    'http://supervisor/core/api/websocket_api',
    { type: msgType, ...payload },
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: 10000
    }
  );
  return response.data;
}

async function loadRegistries() {
  const now = Date.now();
  if (cachedDeviceRegistry && cachedEntityRegistry && cachedConfigEntries && now - registryCacheTime < REGISTRY_CACHE_TTL) {
    return { devices: cachedDeviceRegistry, entities: cachedEntityRegistry, configEntries: cachedConfigEntries };
  }

  try {
    const token = getToken();
    if (!token) throw new Error('Kein Token');

    const [devRes, entRes, configRes] = await Promise.all([
      axios.get('http://supervisor/core/api/config/device_registry', {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000
      }).catch(() => ({ data: [] })),
      axios.get('http://supervisor/core/api/config/entity_registry', {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000
      }).catch(() => ({ data: [] })),
      axios.get('http://supervisor/core/api/config/config_entries', {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000
      }).catch(() => ({ data: [] }))
    ]);

    cachedDeviceRegistry = Array.isArray(devRes.data) ? devRes.data : [];
    cachedEntityRegistry = Array.isArray(entRes.data) ? entRes.data : [];
    cachedConfigEntries = Array.isArray(configRes.data) ? configRes.data : [];
    registryCacheTime = now;

    console.log(`Registry geladen: ${cachedDeviceRegistry.length} Devices, ${cachedEntityRegistry.length} Entity-Eintraege, ${cachedConfigEntries.length} Config-Entries`);
  } catch (err) {
    console.log('Registry-Laden fehlgeschlagen:', err.message);
    cachedDeviceRegistry = cachedDeviceRegistry || [];
    cachedEntityRegistry = cachedEntityRegistry || [];
    cachedConfigEntries = cachedConfigEntries || [];
  }

  return { devices: cachedDeviceRegistry, entities: cachedEntityRegistry, configEntries: cachedConfigEntries };
}

app.get('/api/status', (req, res) => {
  const envKeys = Object.keys(process.env).filter(k =>
    k.includes('SUPER') || k.includes('HASSIO') || k.includes('HA_') || k.includes('HOME')
  );

  const runningStatus = {};
  runningPages.forEach((info, pageId) => {
    runningStatus[pageId] = {
      running: true,
      cycleMs: info.cycleMs,
      lastRun: info.lastRun,
      cycleCount: info.cycleCount
    };
  });

  res.json({
    dataDir,
    haConnected: !!getToken(),
    supervisorToken: getToken() ? 'vorhanden' : 'fehlt',
    envVars: envKeys,
    supervisorTokenPresent: !!process.env.SUPERVISOR_TOKEN,
    hassioTokenPresent: !!process.env.HASSIO_TOKEN,
    runningPages: runningStatus
  });
});

app.get(['/pages', '/api/pages'], async (req, res) => {
  try {
    const data = await fs.readFile(pagesFile, 'utf-8');
    const pages = JSON.parse(data);

    pages.forEach(page => {
      if (runningPages.has(page.id)) {
        page.running = true;
      }
    });

    console.log(`Geladen: ${pages.length} Seiten aus ${pagesFile}`);
    res.json(pages);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log('Keine Seiten-Datei gefunden, verwende Standard');
      const defaultPages = [
        { id: 'page-1', name: 'Seite 1', cycleMs: 250, running: true, nodes: [], connections: [] }
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

app.get(['/driver-config', '/api/driver-config'], async (req, res) => {
  res.json(driverConfig);
});

app.get(['/modbus-device-status', '/api/modbus-device-status'], (req, res) => {
  res.json(Object.fromEntries(modbusDeviceOnlineStatus));
});

app.post(['/driver-config', '/api/driver-config'], async (req, res) => {
  try {
    const cfg = req.body;
    driverConfig = {
      modbusDevices: cfg.modbusDevices || [],
      modbusDriverEnabled: cfg.modbusDriverEnabled !== false,
      driverBindings: cfg.driverBindings || [],
      haDriverEnabled: cfg.haDriverEnabled !== false
    };
    await saveDriverConfig();
    startDriverPolling();
    res.json({ success: true });
  } catch (err) {
    console.error('Fehler beim Speichern der Treiber-Konfiguration:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get(['/driver-live-values', '/api/driver-live-values'], (req, res) => {
  res.json({
    modbus: Object.fromEntries(modbusLiveValues),
    ha: Object.fromEntries(haLiveValues)
  });
});

app.get(['/alarm-config', '/api/alarm-config'], async (req, res) => {
  try {
    const data = await fs.readFile(alarmConfigFile, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    if (err.code === 'ENOENT') {
      const now = Date.now();
      const defaultClasses = [
        { id: 'ac-prio1', name: 'Priorität 1', description: 'Kritische Alarme', priority: 'critical', color: '#ef4444', soundEnabled: false, autoAcknowledge: false, createdAt: now, updatedAt: now },
        { id: 'ac-prio2', name: 'Priorität 2', description: 'Wichtige Alarme', priority: 'high', color: '#f97316', soundEnabled: false, autoAcknowledge: false, createdAt: now, updatedAt: now },
        { id: 'ac-prio3', name: 'Priorität 3', description: 'Warnungen', priority: 'medium', color: '#eab308', soundEnabled: false, autoAcknowledge: false, createdAt: now, updatedAt: now },
      ];
      const defaultConsoles = [
        { id: 'cons-default', name: 'Alarmkonsole', description: 'Alle Alarme', alarmClassIds: ['ac-prio1', 'ac-prio2', 'ac-prio3'], showHistory: true, historyLimit: 500, sortBy: 'time', sortDirection: 'desc', createdAt: now, updatedAt: now }
      ];
      res.json({ alarmClasses: defaultClasses, alarmConsoles: defaultConsoles, activeAlarms: [], alarmHistory: [] });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

app.post(['/alarm-config', '/api/alarm-config'], async (req, res) => {
  try {
    await fs.writeFile(alarmConfigFile, JSON.stringify(req.body, null, 2));
    broadcastSSE('alarms', {
      activeAlarms: req.body.activeAlarms || [],
      alarmClasses: req.body.alarmClasses,
      alarmConsoles: req.body.alarmConsoles,
      alarmHistory: req.body.alarmHistory
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Fehler beim Speichern der Alarm-Konfiguration:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get(['/building-config', '/api/building-config'], async (req, res) => {
  try {
    const data = await fs.readFile(buildingConfigFile, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.json({ buildings: [] });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

app.post(['/building-config', '/api/building-config'], async (req, res) => {
  try {
    await fs.writeFile(buildingConfigFile, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (err) {
    console.error('Fehler beim Speichern der Gebäude-Konfiguration:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post(['/alarm/acknowledge', '/api/alarm/acknowledge'], async (req, res) => {
  try {
    const { alarmId } = req.body;
    const data = await fs.readFile(alarmConfigFile, 'utf8');
    const config = JSON.parse(data);

    const alarm = (config.activeAlarms || []).find(a => a.id === alarmId);
    if (alarm) {
      alarm.state = 'acknowledged';
      alarm.acknowledgedAt = Date.now();
      await fs.writeFile(alarmConfigFile, JSON.stringify(config, null, 2));
      broadcastSSE('alarms', { activeAlarms: config.activeAlarms });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Alarm acknowledge error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post(['/alarm/acknowledge-all', '/api/alarm/acknowledge-all'], async (req, res) => {
  try {
    const data = await fs.readFile(alarmConfigFile, 'utf8');
    const config = JSON.parse(data);

    const now = Date.now();
    (config.activeAlarms || []).forEach(a => {
      if (a.state === 'active') {
        a.state = 'acknowledged';
        a.acknowledgedAt = now;
      }
    });

    await fs.writeFile(alarmConfigFile, JSON.stringify(config, null, 2));
    broadcastSSE('alarms', { activeAlarms: config.activeAlarms });
    res.json({ success: true });
  } catch (err) {
    console.error('Alarm acknowledge-all error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post(['/alarm/clear', '/api/alarm/clear'], async (req, res) => {
  try {
    const { alarmId } = req.body;
    const data = await fs.readFile(alarmConfigFile, 'utf8');
    const config = JSON.parse(data);

    const alarmIndex = (config.activeAlarms || []).findIndex(a => a.id === alarmId);
    if (alarmIndex >= 0) {
      const removedAlarm = config.activeAlarms.splice(alarmIndex, 1)[0];
      removedAlarm.clearedAt = Date.now();
      config.alarmHistory = config.alarmHistory || [];
      config.alarmHistory.unshift(removedAlarm);
      if (config.alarmHistory.length > 1000) {
        config.alarmHistory = config.alarmHistory.slice(0, 1000);
      }
      await fs.writeFile(alarmConfigFile, JSON.stringify(config, null, 2));
      broadcastSSE('alarms', { activeAlarms: config.activeAlarms });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Alarm clear error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post(['/alarm/shelve', '/api/alarm/shelve'], async (req, res) => {
  try {
    const { alarmId, durationMs, reason } = req.body;
    const data = await fs.readFile(alarmConfigFile, 'utf8');
    const config = JSON.parse(data);

    const alarm = (config.activeAlarms || []).find(a => a.id === alarmId);
    if (alarm) {
      alarm.shelved = true;
      alarm.shelvedUntil = Date.now() + durationMs;
      alarm.shelveReason = reason;
      await fs.writeFile(alarmConfigFile, JSON.stringify(config, null, 2));
      broadcastSSE('alarms', { activeAlarms: config.activeAlarms });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Alarm shelve error:', err);
    res.status(500).json({ error: err.message });
  }
});

async function loadTrendConfig() {
  try {
    const data = await fs.readFile(trendConfigFile, 'utf8');
    const cfg = JSON.parse(data);
    trendConfig.trackedNodes = cfg.trackedNodes || [];
    console.log(`Trend-Konfiguration geladen: ${trendConfig.trackedNodes.length} getrackte Knoten`);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Fehler beim Laden der Trend-Konfiguration:', err.message);
    }
  }
}

async function saveTrendConfig() {
  try {
    await fs.writeFile(trendConfigFile, JSON.stringify(trendConfig, null, 2));
  } catch (err) {
    console.error('Fehler beim Speichern der Trend-Konfiguration:', err.message);
  }
}

function getTrendFilePath(nodeId, date) {
  const d = date || new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const safeId = nodeId.replace(/[^a-zA-Z0-9\-_:]/g, '_');
  return path.join(trendDataDir, `${safeId}_${dateStr}.jsonl`);
}

function recordTrendValue(nodeId, value, timestamp) {
  const tracked = trendConfig.trackedNodes.find(n => n.nodeId === nodeId);
  if (!tracked || !tracked.enabled) return;

  if (!trendBuffers.has(nodeId)) {
    trendBuffers.set(nodeId, []);
  }
  const buf = trendBuffers.get(nodeId);
  buf.push({ ts: timestamp || Date.now(), v: value });

  if (buf.length >= TREND_MAX_BUFFER) {
    flushTrendBuffer(nodeId);
  }
}

async function flushTrendBuffer(nodeId) {
  const buf = trendBuffers.get(nodeId);
  if (!buf || buf.length === 0) return;
  trendBuffers.set(nodeId, []);

  const grouped = new Map();
  for (const entry of buf) {
    const d = new Date(entry.ts);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!grouped.has(dateStr)) grouped.set(dateStr, []);
    grouped.get(dateStr).push(entry);
  }

  for (const [dateStr, entries] of grouped) {
    const safeId = nodeId.replace(/[^a-zA-Z0-9\-_:]/g, '_');
    const filePath = path.join(trendDataDir, `${safeId}_${dateStr}.jsonl`);
    try {
      const lines = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
      await fs.appendFile(filePath, lines);
    } catch (err) {
      console.error(`Fehler beim Schreiben von Trend-Daten fuer ${nodeId}:`, err.message);
    }
  }
}

async function flushAllTrendBuffers() {
  for (const nodeId of trendBuffers.keys()) {
    await flushTrendBuffer(nodeId);
  }
}

function startTrendFlush() {
  if (trendFlushTimer) clearInterval(trendFlushTimer);
  trendFlushTimer = setInterval(flushAllTrendBuffers, TREND_FLUSH_INTERVAL);
}

async function readTrendData(nodeId, fromTs, toTs) {
  const safeId = nodeId.replace(/[^a-zA-Z0-9\-_:]/g, '_');
  const from = new Date(fromTs);
  const to = new Date(toTs);
  const results = [];

  const current = new Date(from);
  while (current <= to) {
    const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
    const filePath = path.join(trendDataDir, `${safeId}_${dateStr}.jsonl`);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.ts >= fromTs && entry.ts <= toTs) {
            results.push(entry);
          }
        } catch {}
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error(`Fehler beim Lesen von Trend-Daten:`, err.message);
      }
    }
    current.setDate(current.getDate() + 1);
  }

  const bufEntries = (trendBuffers.get(nodeId) || []).filter(e => e.ts >= fromTs && e.ts <= toTs);
  for (const e of bufEntries) {
    if (!results.find(r => r.ts === e.ts)) results.push(e);
  }

  results.sort((a, b) => a.ts - b.ts);
  return results;
}

app.get(['/trend', '/api/trend'], async (req, res) => {
  try {
    const { nodeIds, from, to } = req.query;
    if (!nodeIds || !from || !to) {
      return res.status(400).json({ error: 'nodeIds, from und to sind erforderlich' });
    }
    const ids = String(nodeIds).split(',').filter(Boolean);
    const fromTs = parseInt(from);
    const toTs = parseInt(to);
    const result = {};
    await Promise.all(ids.map(async (nodeId) => {
      await flushTrendBuffer(nodeId);
      result[nodeId] = await readTrendData(nodeId, fromTs, toTs);
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(['/trend-config', '/api/trend-config'], (req, res) => {
  res.json(trendConfig);
});

app.post(['/trend-config', '/api/trend-config'], async (req, res) => {
  try {
    const { trackedNodes, chartGroups } = req.body;
    trendConfig.trackedNodes = trackedNodes || [];
    if (chartGroups !== undefined) trendConfig.chartGroups = chartGroups;
    await saveTrendConfig();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(['/trend-data', '/api/trend-data'], async (req, res) => {
  try {
    const { nodeId, from, to } = req.query;
    if (!nodeId || !from || !to) {
      return res.status(400).json({ error: 'nodeId, from und to sind erforderlich' });
    }
    await flushTrendBuffer(nodeId);
    const data = await readTrendData(nodeId, parseInt(from), parseInt(to));
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete(['/trend-data', '/api/trend-data'], async (req, res) => {
  try {
    const { nodeId } = req.query;
    if (!nodeId) return res.status(400).json({ error: 'nodeId erforderlich' });
    const safeId = nodeId.replace(/[^a-zA-Z0-9\-_:]/g, '_');
    try {
      const files = await fs.readdir(trendDataDir);
      for (const file of files) {
        if (file.startsWith(safeId + '_')) {
          await fs.unlink(path.join(trendDataDir, file));
        }
      }
    } catch {}
    trendBuffers.delete(nodeId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(['/ha/states', '/api/ha/states'], async (req, res) => {
  try {
    const [states, registry] = await Promise.all([
      haGet('/states'),
      loadRegistries()
    ]);

    const deviceMap = new Map();
    registry.devices.forEach(d => {
      deviceMap.set(d.id, d);
    });

    const entityRegMap = new Map();
    registry.entities.forEach(e => {
      entityRegMap.set(e.entity_id, e);
    });

    const configEntryMap = new Map();
    registry.configEntries.forEach(ce => {
      configEntryMap.set(ce.entry_id, ce);
    });

    const enrichedStates = states.map(state => {
      const regEntry = entityRegMap.get(state.entity_id);
      let deviceInfo = null;
      let integrationName = null;
      let integrationTitle = null;

      if (regEntry) {
        if (regEntry.device_id) {
          deviceInfo = deviceMap.get(regEntry.device_id);
        }
        integrationName = regEntry.platform || null;

        if (regEntry.config_entry_id) {
          const configEntry = configEntryMap.get(regEntry.config_entry_id);
          if (configEntry) {
            integrationTitle = configEntry.title || configEntry.domain || integrationName;
          }
        }

        if (!integrationTitle && deviceInfo && deviceInfo.config_entries && deviceInfo.config_entries.length > 0) {
          const configEntry = configEntryMap.get(deviceInfo.config_entries[0]);
          if (configEntry) {
            integrationTitle = configEntry.title || configEntry.domain || integrationName;
          }
        }
      }

      return {
        ...state,
        attributes: {
          ...state.attributes,
          _device_id: regEntry?.device_id || null,
          _device_name: deviceInfo?.name_by_user || deviceInfo?.name || null,
          _integration: integrationTitle || integrationName || state.entity_id.split('.')[0],
          _area_id: deviceInfo?.area_id || regEntry?.area_id || null
        }
      };
    });

    console.log(`HA States geladen: ${enrichedStates.length} Entities`);
    res.json(enrichedStates);
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

function toBool(val) {
  if (val === true || val === 1) return true;
  if (val === false || val === 0) return false;
  if (typeof val === 'string') {
    const lower = val.toLowerCase();
    if (lower === 'on' || lower === 'true' || lower === '1') return true;
    if (lower === 'off' || lower === 'false' || lower === '0') return false;
  }
  return !!val;
}

function toNumber(val) {
  if (val === true) return 1;
  if (val === false) return 0;
  if (val === null || val === undefined) return 0;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function getDefaultValueForNodeType(nodeType) {
  switch (nodeType) {
    case 'and-gate':
    case 'or-gate':
    case 'xor-gate':
    case 'not-gate':
    case 'dp-boolean':
    case 'rising-edge':
    case 'falling-edge':
    case 'compare':
    case 'switch':
    case 'light-toggle':
      return false;
    case 'math-add':
    case 'math-sub':
    case 'math-mul':
    case 'math-div':
    case 'math-min':
    case 'math-max':
    case 'math-avg':
    case 'math-abs':
    case 'dp-numeric':
    case 'dp-enum':
    case 'scaling':
    case 'smoothing':
    case 'pid-controller':
    case 'counter':
    case 'const-value':
    case 'timer':
    case 'heating-curve':
      return 0;
    case 'threshold':
      return 'below';
    case 'delay':
    case 'select':
    case 'sr-flipflop':
    case 'rs-flipflop':
    case 'python-script':
    case 'ha-input':
    case 'ha-output':
    case 'aggregate-control':
    case 'pump-control':
    case 'valve-control':
    case 'sensor-control':
    case 'modbus-device-input':
    case 'modbus-device-output':
    case 'time-trigger':
    case 'state-trigger':
      return null;
    default:
      return null;
  }
}

function getDefaultOutputsForNodeType(node) {
  const nodeType = node.type;
  const outputs = node.data && node.data.outputs ? node.data.outputs : [];
  const defaults = {};

  switch (nodeType) {
    case 'and-gate':
    case 'or-gate':
    case 'xor-gate':
    case 'not-gate':
    case 'compare':
    case 'switch':
    case 'timer':
    case 'rising-edge':
    case 'falling-edge':
    case 'light-toggle':
      defaults['output-0'] = false;
      break;
    case 'sr-flipflop':
    case 'rs-flipflop':
      defaults['output-0'] = false;
      defaults['output-1'] = true;
      break;
    case 'threshold':
      defaults['output-0'] = 'below';
      defaults['output-1'] = null;
      break;
    case 'math-add':
    case 'math-sub':
    case 'math-mul':
    case 'math-div':
    case 'math-min':
    case 'math-max':
    case 'math-avg':
    case 'math-abs':
    case 'const-value':
    case 'scaling':
    case 'smoothing':
    case 'pid-controller':
    case 'counter':
    case 'heating-curve':
      defaults['output-0'] = 0;
      break;
    case 'select':
      defaults['output-0'] = null;
      break;
    case 'delay':
      defaults['output-0'] = null;
      break;
    case 'dp-boolean':
      defaults['output-0'] = false;
      break;
    case 'dp-numeric':
    case 'dp-enum':
      defaults['output-0'] = 0;
      break;
    case 'aggregate-control':
    case 'pump-control':
      defaults['output-0'] = false;
      defaults['output-1'] = 0;
      defaults['output-2'] = false;
      defaults['output-3'] = false;
      defaults['output-4'] = true;
      defaults['output-5'] = false;
      defaults['output-6'] = 0;
      defaults['output-7'] = 0;
      break;
    case 'valve-control':
      defaults['output-0'] = 0;
      defaults['output-1'] = false;
      break;
    case 'sensor-control':
      defaults['output-0'] = 0;
      defaults['output-1'] = false;
      break;
    case 'python-script': {
      const pythonOutputs = (node.data && node.data.config && node.data.config.pythonOutputs) || [];
      pythonOutputs.forEach((_, idx) => {
        defaults[`output-${idx}`] = null;
      });
      defaults['_error'] = null;
      break;
    }
    default:
      outputs.forEach((_, idx) => {
        defaults[`output-${idx}`] = null;
      });
  }

  return defaults;
}

async function executePythonCode(code, inputs) {
  return new Promise((resolve, reject) => {
    const normalizedInputs = {};
    for (const [key, value] of Object.entries(inputs)) {
      normalizedInputs[key.toLowerCase()] = value;
    }
    const inputJson = JSON.stringify(normalizedInputs);

    const wrappedCode = `
import json
import sys

_inputs = json.loads('''${inputJson}''')

${Object.keys(normalizedInputs).map(k => `${k} = _inputs.get('${k}')`).join('\n')}

${code}

_outputs = {}
for name in dir():
    if name.startswith('out'):
        _outputs[name] = eval(name)

print(json.dumps(_outputs))
`;

    console.log('Python wrappedCode:', wrappedCode);

    const python = spawn('python3', ['-c', wrappedCode], {
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => { stdout += data.toString(); });
    python.stderr.on('data', (data) => { stderr += data.toString(); });

    python.on('close', (code) => {
      if (code !== 0) {
        console.error('Python error:', stderr);
        reject(new Error(stderr || `Python exited with code ${code}`));
        return;
      }
      try {
        const result = JSON.parse(stdout.trim());
        resolve(result);
      } catch (e) {
        reject(new Error(`Invalid JSON output: ${stdout}`));
      }
    });

    python.on('error', (err) => {
      reject(err);
    });

    setTimeout(() => {
      python.kill();
      reject(new Error('Python script timeout'));
    }, 5000);
  });
}

async function executePageLogic(nodes, connections, manualOverrides = {}, pageId = null) {
  const nodeValues = {};

  const modbusDevices = driverConfig.modbusDevices || [];
  const modbusDeviceMap = new Map();
  for (const device of modbusDevices) {
    modbusDeviceMap.set(device.id, device);
  }

  const bindingValues = {};
  const inputBindings = (driverConfig.driverBindings || []).filter(b => b.direction === 'input');

  const bindingPromises = inputBindings.map(async (binding) => {
    const bindingKey = `${binding.nodeId}:${binding.portId}`;
    try {
      if (binding.driverType === 'modbus') {
        if (!driverConfig.modbusDriverEnabled) {
          console.log(`Binding ${bindingKey}: Modbus-Treiber deaktiviert`);
          return;
        }
        const device = modbusDeviceMap.get(binding.deviceId);
        if (!device) {
          console.log(`Binding ${bindingKey}: Modbus-Geraet ${binding.deviceId} nicht gefunden`);
          return;
        }
        if (!device.enabled) {
          console.log(`Binding ${bindingKey}: Geraet ${device.name} deaktiviert`);
          return;
        }
        const dp = device.datapoints?.find(d => d.id === binding.datapointId);
        if (!dp) {
          console.log(`Binding ${bindingKey}: Datenpunkt ${binding.datapointId} nicht gefunden`);
          return;
        }
        let rawValue = await modbusReadRegister(
          device.host,
          device.port,
          device.unitId,
          dp.address,
          dp.registerType || 'holding',
          dp.dataType || 'uint16',
          device.timeout || 3000
        );
        let value = rawValue;
        if (dp.scale && dp.scale !== 1) value = value * dp.scale;
        if (dp.offset) value = value + dp.offset;
        if (dp.bitIndex !== undefined && dp.bitIndex >= 0) {
          value = (rawValue >> dp.bitIndex) & 1 ? true : false;
        }
        bindingValues[bindingKey] = value;
        modbusLiveValues.set(`${binding.deviceId}:${binding.datapointId}`, value);
        console.log(`Binding Modbus Read ${device.name}/${dp.name}: ${value}`);
      } else if (binding.driverType === 'homeassistant' && binding.haEntityId) {
        if (!driverConfig.haDriverEnabled) {
          return;
        }
        const cachedState = haLiveValues.get(binding.haEntityId);
        if (cachedState) {
          const rawState = cachedState.state;
          const numVal = parseFloat(rawState);
          bindingValues[bindingKey] = !isNaN(numVal) ? numVal : rawState;
        }
      }
    } catch (err) {
      console.error(`Binding ${bindingKey} Read Fehler:`, err.message);
    }
  });

  const statePromises = nodes
    .filter(n => (n.type === 'ha-input') && n.data.entityId)
    .map(async (n) => {
      const cachedState = haLiveValues.get(n.data.entityId);
      if (cachedState) {
        const rawState = cachedState.state;
        const numVal = parseFloat(rawState);
        nodeValues[n.id] = !isNaN(numVal) ? numVal : rawState;
      } else {
        nodeValues[n.id] = null;
      }
    });

  const modbusInputPromises = nodes
    .filter(n => n.type === 'modbus-device-input')
    .map(async (n) => {
      const cfg = n.data.config || {};
      const deviceId = cfg.modbusDeviceId;
      const datapoints = cfg.modbusDatapoints || [];
      const device = modbusDeviceMap.get(deviceId);

      if (!device) {
        console.log(`Modbus Input ${n.id}: Geraet ${deviceId} nicht gefunden`);
        nodeValues[n.id] = null;
        return;
      }

      const dpValues = {};
      for (let i = 0; i < datapoints.length; i++) {
        const dp = datapoints[i];
        try {
          let rawValue = await modbusReadRegister(
            device.host,
            device.port,
            device.unitId,
            dp.address,
            dp.registerType || 'holding',
            dp.dataType || 'uint16',
            device.timeout || 3000
          );

          let value = rawValue;
          if (dp.scale && dp.scale !== 1) {
            value = value * dp.scale;
          }
          if (dp.offset) {
            value = value + dp.offset;
          }
          if (dp.bitIndex !== undefined && dp.bitIndex >= 0) {
            value = (rawValue >> dp.bitIndex) & 1 ? true : false;
          }

          dpValues[dp.id] = value;
          nodeValues[`${n.id}:output-${i}`] = value;
          console.log(`Modbus Read ${device.name}/${dp.name} (${dp.address}): ${value}`);
        } catch (err) {
          console.error(`Modbus Read Fehler ${device.name}/${dp.name}:`, err.message);
          dpValues[dp.id] = null;
          nodeValues[`${n.id}:output-${i}`] = null;
        }
      }

      const firstValue = Object.values(dpValues)[0] ?? null;
      nodeValues[n.id] = firstValue;
    });

  await Promise.all([...bindingPromises, ...statePromises, ...modbusInputPromises]);

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

  const caseContainerActiveCase = new Map();

  const updateCaseContainerValue = (containerId) => {
    const node = nodes.find(n => n.id === containerId);
    if (!node || node.type !== 'case-container') return;

    const containerConns = connections.filter(c => c.target === containerId);
    let caseVal = 0;
    for (const conn of containerConns) {
      if (nodeValues[conn.source] !== undefined) {
        caseVal = parseInt(nodeValues[conn.source]) || 0;
        break;
      }
    }
    caseContainerActiveCase.set(containerId, caseVal);
    nodeValues[containerId] = caseVal;
    console.log(`Case Container ${containerId} aktiver Case: ${caseVal}`);
  };

  for (const node of nodes) {
    if (node.type === 'case-container') {
      updateCaseContainerValue(node.id);
    }
  }

  for (const nodeId of topoOrder) {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) continue;

    if (node.type === 'case-container') {
      updateCaseContainerValue(node.id);
      continue;
    }

    if (node.data.parentContainerId) {
      const parentContainer = nodes.find(n => n.id === node.data.parentContainerId);
      if (parentContainer && parentContainer.type === 'case-container') {
        const activeCase = caseContainerActiveCase.get(parentContainer.id) || 0;
        const nodeCase = node.data.caseIndex;
        if (nodeCase !== undefined && nodeCase !== activeCase) {
          const defaultVal = getDefaultValueForNodeType(node.type);
          nodeValues[nodeId] = defaultVal;
          const outputDefaults = getDefaultOutputsForNodeType(node);
          for (const [portKey, portVal] of Object.entries(outputDefaults)) {
            nodeValues[`${nodeId}:${portKey}`] = portVal;
          }
          console.log(`Node ${nodeId} (${node.type}) inaktiv - Case ${nodeCase} != aktiver Case ${activeCase} - auf Default gesetzt`);
          continue;
        }
      }
    }

    const incomingConns = connections.filter(c => c.target === nodeId);

    const getInputValue = (conn) => {
      if (conn.sourcePort) {
        const portKey = `${conn.source}:${conn.sourcePort}`;
        if (nodeValues[portKey] !== undefined) {
          return nodeValues[portKey];
        }
      }
      return nodeValues[conn.source];
    };

    const nodeInputs = node.data.inputs || [];
    const inputVals = nodeInputs.map((inputPort, idx) => {
      const portKey = `${nodeId}:${inputPort.id}`;
      if (bindingValues[portKey] !== undefined) {
        nodeValues[portKey] = bindingValues[portKey];
        return bindingValues[portKey];
      }
      const conn = incomingConns.find(c => c.targetPort === inputPort.id);
      if (conn) {
        const connVal = getInputValue(conn);
        nodeValues[portKey] = connVal;
        return connVal;
      }
      const dpVal = dpStore.get(portKey);
      if (dpVal !== undefined) {
        nodeValues[portKey] = dpVal;
        return dpVal;
      }
      const primaryVal = dpStore.get(nodeId);
      if (primaryVal !== undefined && nodeInputs.length === 1) {
        nodeValues[portKey] = primaryVal;
        return primaryVal;
      }
      const portDefaultValues = (node.data.config || {}).portDefaultValues || {};
      const defaultStr = portDefaultValues[inputPort.id];
      if (defaultStr !== undefined && defaultStr !== '') {
        let defaultVal;
        if (defaultStr === 'true') defaultVal = true;
        else if (defaultStr === 'false') defaultVal = false;
        else if (defaultStr === 'null') defaultVal = null;
        else {
          const num = Number(defaultStr);
          defaultVal = (!isNaN(num) && defaultStr.trim() !== '') ? num : defaultStr;
        }
        nodeValues[portKey] = defaultVal;
        return defaultVal;
      }
      return undefined;
    });

    const cfg = node.data.config || {};

    if (manualOverrides[nodeId] !== undefined) {
      nodeValues[nodeId] = manualOverrides[nodeId];
    } else if (node.type === 'ha-input') {
    } else if (node.type === 'dp-boolean' || node.type === 'dp-numeric' || node.type === 'dp-enum') {
      const convertToDpType = (val) => {
        if (node.type === 'dp-boolean') {
          if (typeof val === 'boolean') return val;
          if (typeof val === 'number') return val > 0;
          if (typeof val === 'string') return val === 'true' || val === '1' || val === 'on';
          return Boolean(val);
        }
        return val;
      };

      if (inputVals[0] !== undefined) {
        const converted = convertToDpType(inputVals[0]);
        nodeValues[nodeId] = converted;
        setPersistentDpValue(nodeId, converted);
      } else {
        const persistentVal = dpStore.get(nodeId);
        if (persistentVal !== undefined) {
          const converted = convertToDpType(persistentVal);
          nodeValues[nodeId] = converted;
        } else {
          nodeValues[nodeId] = node.type === 'dp-boolean' ? false : 0;
        }
      }
    } else if (dpStore.get(nodeId) !== undefined && !['dp-boolean','dp-numeric','dp-enum'].includes(node.type)) {
      const ov = dpStore.get(nodeId);
      nodeValues[nodeId] = ov;
    } else if (node.type === 'and-gate') {
      nodeValues[nodeId] = inputVals.length === 0 ? false : inputVals.every(v => toBool(v));
    } else if (node.type === 'or-gate') {
      nodeValues[nodeId] = inputVals.length === 0 ? false : inputVals.some(v => toBool(v));
    } else if (node.type === 'xor-gate') {
      const trueCount = inputVals.filter(v => toBool(v)).length;
      nodeValues[nodeId] = trueCount % 2 === 1;
    } else if (node.type === 'not-gate') {
      nodeValues[nodeId] = !toBool(inputVals[0]);
    } else if (node.type === 'switch') {
      const sw = toBool(inputVals[0]);
      const valTrue = inputVals[1];
      const valFalse = inputVals[2];
      if (sw) {
        nodeValues[nodeId] = valTrue !== undefined ? valTrue : true;
      } else {
        nodeValues[nodeId] = valFalse !== undefined ? valFalse : false;
      }
    } else if (node.type === 'select') {
      const a = inputVals[0];
      const b = inputVals[1];
      const sel = toBool(inputVals[2]);
      nodeValues[nodeId] = sel ? b : a;
    } else if (node.type === 'math-add') {
      nodeValues[nodeId] = toNumber(inputVals[0]) + toNumber(inputVals[1]);
    } else if (node.type === 'math-sub') {
      nodeValues[nodeId] = toNumber(inputVals[0]) - toNumber(inputVals[1]);
    } else if (node.type === 'math-mul') {
      nodeValues[nodeId] = toNumber(inputVals[0]) * toNumber(inputVals[1]);
    } else if (node.type === 'math-div') {
      const divisor = toNumber(inputVals[1]);
      nodeValues[nodeId] = divisor !== 0 ? toNumber(inputVals[0]) / divisor : 0;
    } else if (node.type === 'math-min') {
      nodeValues[nodeId] = Math.min(toNumber(inputVals[0]), toNumber(inputVals[1]));
    } else if (node.type === 'math-max') {
      nodeValues[nodeId] = Math.max(toNumber(inputVals[0]), toNumber(inputVals[1]));
    } else if (node.type === 'math-avg') {
      const avgVals = inputVals.map(v => toNumber(v));
      nodeValues[nodeId] = avgVals.length > 0 ? avgVals.reduce((a, b) => a + b, 0) / avgVals.length : 0;
    } else if (node.type === 'math-abs') {
      nodeValues[nodeId] = Math.abs(toNumber(inputVals[0]));
    } else if (node.type === 'const-value') {
      nodeValues[nodeId] = cfg.constValue !== undefined ? cfg.constValue : 0;
    } else if (node.type === 'compare') {
      const a = toNumber(inputVals[0]);
      const b = cfg.compareValue !== undefined ? toNumber(cfg.compareValue) : toNumber(inputVals[1]);
      const op = cfg.compareOperator || '>';
      if (op === '>') nodeValues[nodeId] = a > b;
      else if (op === '>=') nodeValues[nodeId] = a >= b;
      else if (op === '==') nodeValues[nodeId] = a == b;
      else if (op === '<=') nodeValues[nodeId] = a <= b;
      else if (op === '<') nodeValues[nodeId] = a < b;
      else if (op === '!=') nodeValues[nodeId] = a != b;
      else nodeValues[nodeId] = false;
    } else if (node.type === 'threshold') {
      const val = toNumber(inputVals[0]);
      const thr = cfg.thresholdValue !== undefined ? toNumber(cfg.thresholdValue) : 0;
      const hasHysteresis = cfg.hysteresisUpper !== undefined && cfg.hysteresisLower !== undefined;
      if (hasHysteresis) {
        const upperBand = thr + toNumber(cfg.hysteresisUpper);
        const lowerBand = thr - toNumber(cfg.hysteresisLower);
        const st = pageId ? getNodeState(pageId, nodeId) : node.__hysteresisState || (node.__hysteresisState = {});
        const prevOutput = st.output !== undefined ? st.output : false;
        let output = prevOutput;
        if (val >= upperBand) output = true;
        else if (val < lowerBand) output = false;
        st.output = output;
        nodeValues[nodeId] = output;
      } else {
        nodeValues[nodeId] = val >= thr;
      }
    } else if (node.type === 'timer') {
      const inputVal = toBool(inputVals[0]);
      const timerOnMs = cfg.timerOnMs !== undefined ? cfg.timerOnMs : (cfg.timerMs || 1000);
      const timerOffMs = cfg.timerOffMs !== undefined ? cfg.timerOffMs : 0;
      const now = Date.now();
      const st = pageId ? getNodeState(pageId, nodeId) : node.__timerState || (node.__timerState = {});
      if (st.prevInput === undefined) {
        st.prevInput = inputVal;
        st.output = false;
        st.pendingTs = null;
        st.pendingTarget = null;
      }
      const risingEdge = inputVal && !st.prevInput;
      const fallingEdge = !inputVal && st.prevInput;
      if (risingEdge) {
        if (timerOnMs <= 0) {
          st.output = true;
          st.pendingTs = null;
          st.pendingTarget = null;
        } else {
          st.pendingTs = now;
          st.pendingTarget = 'on';
        }
      } else if (fallingEdge) {
        if (timerOffMs <= 0) {
          st.output = false;
          st.pendingTs = null;
          st.pendingTarget = null;
        } else {
          st.pendingTs = now;
          st.pendingTarget = 'off';
        }
      }
      if (st.pendingTarget === 'on' && st.pendingTs !== null) {
        if (now - st.pendingTs >= timerOnMs) {
          st.output = true;
          st.pendingTs = null;
          st.pendingTarget = null;
        }
      } else if (st.pendingTarget === 'off' && st.pendingTs !== null) {
        if (now - st.pendingTs >= timerOffMs) {
          st.output = false;
          st.pendingTs = null;
          st.pendingTarget = null;
        }
      }
      if (!inputVal && st.pendingTarget === 'on') {
        st.pendingTs = null;
        st.pendingTarget = null;
      }
      if (inputVal && st.pendingTarget === 'off') {
        st.pendingTs = null;
        st.pendingTarget = null;
      }
      st.prevInput = inputVal;
      nodeValues[nodeId] = st.output;
      nodeValues[`${nodeId}:output-0`] = st.output;
    } else if (node.type === 'delay') {
      const now = Date.now();
      const delayMs = cfg.delayMs !== undefined ? cfg.delayMs : 1000;
      const st = pageId ? getNodeState(pageId, nodeId) : node.__delayState || (node.__delayState = {});
      if (!st.queue) st.queue = [];
      if (inputVals[0] !== undefined && inputVals[0] !== null) {
        st.queue.push({ value: inputVals[0], sendAt: now + delayMs });
      }
      st.queue = st.queue.filter(e => e.sendAt <= now + delayMs * 10);
      const ready = st.queue.filter(e => e.sendAt <= now);
      const latest = ready.length > 0 ? ready[ready.length - 1] : null;
      if (latest !== null) {
        st.lastOutput = latest.value;
        st.queue = st.queue.filter(e => e.sendAt > now);
      }
      nodeValues[nodeId] = st.lastOutput !== undefined ? st.lastOutput : null;
    } else if (node.type === 'smoothing') {
      const inputVal = toNumber(inputVals[0]);
      const now = Date.now();
      const durationMs = cfg.smoothingDuration !== undefined ? cfg.smoothingDuration : 86400000;
      const method = cfg.smoothingMethod || 'average';
      const st = pageId ? getNodeState(pageId, nodeId) : node.__smoothingState || (node.__smoothingState = {});
      if (!st.history) st.history = [];
      if (inputVals[0] !== null && inputVals[0] !== undefined) {
        st.history.push({ value: inputVal, ts: now });
      }
      const cutoff = now - durationMs;
      st.history = st.history.filter(e => e.ts >= cutoff);
      const vals = st.history.map(e => e.value);
      let smoothed = null, minVal = null, maxVal = null;
      if (vals.length > 0) {
        minVal = Math.min(...vals);
        maxVal = Math.max(...vals);
        if (method === 'average') {
          smoothed = vals.reduce((a, b) => a + b, 0) / vals.length;
        } else if (method === 'exponential') {
          const alpha = Math.min(1, 2 / (vals.length + 1));
          smoothed = vals[0];
          for (let i = 1; i < vals.length; i++) {
            smoothed = alpha * vals[i] + (1 - alpha) * smoothed;
          }
        } else if (method === 'median') {
          const sorted = [...vals].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          smoothed = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
        }
      }
      nodeValues[nodeId] = smoothed;
      nodeValues[`${nodeId}:output-0`] = smoothed;
      nodeValues[`${nodeId}:output-1`] = minVal;
      nodeValues[`${nodeId}:output-2`] = maxVal;
    } else if (node.type === 'counter') {
      const pulseInput = toBool(inputVals[0]);
      const resetInput = toBool(inputVals[1]);
      const counterMin = cfg.counterMin !== undefined ? cfg.counterMin : 0;
      const counterMax = cfg.counterMax !== undefined ? cfg.counterMax : 100;
      const st = pageId ? getNodeState(pageId, nodeId) : node.__counterState || (node.__counterState = {});
      if (st.count === undefined) st.count = counterMin;
      if (st.prevPulse === undefined) st.prevPulse = false;
      if (st.prevReset === undefined) st.prevReset = false;
      const risingPulse = pulseInput && !st.prevPulse;
      const risingReset = resetInput && !st.prevReset;
      if (risingReset) {
        st.count = counterMin;
      } else if (risingPulse) {
        st.count = st.count + 1;
        if (st.count > counterMax) st.count = counterMin;
      }
      st.prevPulse = pulseInput;
      st.prevReset = resetInput;
      nodeValues[nodeId] = st.count;
      nodeValues[`${nodeId}:output-0`] = st.count;
    } else if (node.type === 'sr-flipflop') {
      const setInput = toBool(inputVals[0]);
      const resetInput = toBool(inputVals[1]);
      const st = pageId ? getNodeState(pageId, nodeId) : node.__srState || (node.__srState = {});
      if (st.output === undefined) st.output = false;
      if (setInput) st.output = true;
      if (resetInput) st.output = false;
      nodeValues[nodeId] = st.output;
      nodeValues[`${nodeId}:output-0`] = st.output;
      nodeValues[`${nodeId}:output-1`] = !st.output;
    } else if (node.type === 'rs-flipflop') {
      const resetInput = toBool(inputVals[0]);
      const setInput = toBool(inputVals[1]);
      const st = pageId ? getNodeState(pageId, nodeId) : node.__rsState || (node.__rsState = {});
      if (st.output === undefined) st.output = false;
      if (resetInput) st.output = false;
      if (setInput) st.output = true;
      nodeValues[nodeId] = st.output;
      nodeValues[`${nodeId}:output-0`] = st.output;
      nodeValues[`${nodeId}:output-1`] = !st.output;
    } else if (node.type === 'rising-edge') {
      const inputVal = toBool(inputVals[0]);
      const st = pageId ? getNodeState(pageId, nodeId) : node.__risingState || (node.__risingState = {});
      if (st.prevInput === undefined) st.prevInput = inputVal;
      const risingEdge = inputVal && !st.prevInput;
      st.prevInput = inputVal;
      nodeValues[nodeId] = risingEdge;
      nodeValues[`${nodeId}:output-0`] = risingEdge;
    } else if (node.type === 'falling-edge') {
      const inputVal = toBool(inputVals[0]);
      const st = pageId ? getNodeState(pageId, nodeId) : node.__fallingState || (node.__fallingState = {});
      if (st.prevInput === undefined) st.prevInput = inputVal;
      const fallingEdge = !inputVal && st.prevInput;
      st.prevInput = inputVal;
      nodeValues[nodeId] = fallingEdge;
      nodeValues[`${nodeId}:output-0`] = fallingEdge;
    } else if (node.type === 'time-trigger') {
      const cronExpr = cfg.cronExpression || '0 * * * *';
      const st = pageId ? getNodeState(pageId, nodeId) : node.__timeTrigState || (node.__timeTrigState = {});
      if (st.lastFired === undefined) st.lastFired = null;
      const now = new Date();
      let fired = false;
      try {
        const parts = cronExpr.trim().split(/\s+/);
        if (parts.length === 5) {
          const [min, hour, dom, mon, dow] = parts;
          const matchField = (field, val, min0, max0) => {
            if (field === '*') return true;
            return field.split(',').some(p => {
              if (p.includes('/')) {
                const [range, step] = p.split('/');
                const s = parseInt(step);
                const start = range === '*' ? min0 : parseInt(range);
                return ((val - start) % s === 0) && val >= start;
              }
              if (p.includes('-')) {
                const [a, b] = p.split('-').map(Number);
                return val >= a && val <= b;
              }
              return parseInt(p) === val;
            });
          };
          const matches = matchField(min, now.getMinutes(), 0, 59) &&
                          matchField(hour, now.getHours(), 0, 23) &&
                          matchField(dom, now.getDate(), 1, 31) &&
                          matchField(mon, now.getMonth() + 1, 1, 12) &&
                          matchField(dow, now.getDay(), 0, 6);
          const currentMinuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
          if (matches && st.lastFired !== currentMinuteKey) {
            fired = true;
            st.lastFired = currentMinuteKey;
          }
        }
      } catch (e) {
        console.error(`time-trigger cron parse error: ${e.message}`);
      }
      nodeValues[nodeId] = fired;
      nodeValues[`${nodeId}:output-0`] = fired;
    } else if (node.type === 'state-trigger') {
      const inputVal = inputVals[0];
      const triggerState = cfg.triggerState !== undefined ? String(cfg.triggerState) : null;
      const st = pageId ? getNodeState(pageId, nodeId) : node.__stateTrigState || (node.__stateTrigState = {});
      if (st.prevVal === undefined) st.prevVal = inputVal;
      let triggered = false;
      const changed = inputVal !== st.prevVal;
      if (changed) {
        if (triggerState === null || triggerState === '' || String(inputVal) === triggerState) {
          triggered = true;
        }
        st.prevVal = inputVal;
      }
      nodeValues[nodeId] = triggered;
      nodeValues[`${nodeId}:output-0`] = triggered;
    } else if (node.type === 'scaling') {
      const inputVal = toNumber(inputVals[0]);
      const inMin = cfg.scalingInMin !== undefined ? toNumber(cfg.scalingInMin) : 0;
      const inMax = cfg.scalingInMax !== undefined ? toNumber(cfg.scalingInMax) : 100;
      const outMin = cfg.scalingOutMin !== undefined ? toNumber(cfg.scalingOutMin) : 0;
      const outMax = cfg.scalingOutMax !== undefined ? toNumber(cfg.scalingOutMax) : 100;
      let scaled = null;
      if (inputVals[0] !== null && inputVals[0] !== undefined && inMax !== inMin) {
        scaled = outMin + ((inputVal - inMin) / (inMax - inMin)) * (outMax - outMin);
        if (cfg.scalingClamp) {
          scaled = Math.max(Math.min(outMin, outMax), Math.min(Math.max(outMin, outMax), scaled));
        }
      }
      nodeValues[nodeId] = scaled;
      nodeValues[`${nodeId}:output-0`] = scaled;
    } else if (node.type === 'pump-control' || node.type === 'aggregate-control') {
      const startCmd = toBool(inputVals[0]);
      const aggregateFeedback = toBool(inputVals[1]);
      const faultInput = toBool(inputVals[2]);
      const revisionSwitch = toBool(inputVals[3]);
      const handStartInput = inputVals[4];
      const speedSetpoint = toNumber(inputVals[5]);
      const resetInputWire = toBool(inputVals[6]);

      const visuHOA = cfg.pumpVisuHOA ?? cfg.aggregateVisuHOA;
      const visuHandStart = cfg.pumpVisuHandStart ?? cfg.aggregateVisuHandStart;
      const visuReset = cfg.pumpVisuReset ?? cfg.aggregateVisuReset;

      const hoaMode = visuHOA !== undefined ? toNumber(visuHOA) : 2;
      const handStart = visuHandStart !== undefined ? toBool(visuHandStart) : toBool(handStartInput);
      const resetInput = visuReset === true ? true : resetInputWire;

      const startDelayMs = cfg.pumpStartDelayMs ?? cfg.aggregateStartDelayMs ?? 0;
      const stopDelayMs = cfg.pumpStopDelayMs ?? cfg.aggregateStopDelayMs ?? 0;
      const feedbackTimeoutMs = cfg.pumpFeedbackTimeoutMs ?? cfg.aggregateFeedbackTimeoutMs ?? 10000;
      const enableFeedback = (cfg.pumpEnableFeedback ?? cfg.aggregateEnableFeedback) !== false;
      const speedMin = cfg.pumpSpeedMin ?? cfg.aggregateSpeedMin ?? 0;
      const speedMax = cfg.pumpSpeedMax ?? cfg.aggregateSpeedMax ?? 100;
      const antiSeizeIntervalMs = cfg.pumpAntiSeizeIntervalMs ?? cfg.aggregateAntiSeizeIntervalMs ?? 604800000;
      const antiSeizeRunMs = cfg.pumpAntiSeizeRunMs ?? cfg.aggregateAntiSeizeRunMs ?? 60000;
      const antiSeizeSpeed = cfg.pumpAntiSeizeSpeed ?? cfg.aggregateAntiSeizeSpeed ?? 30;

      const now = Date.now();
      const st = pageId ? getNodeState(pageId, nodeId) : node.__aggregateState || (node.__aggregateState = {});

      const initOpHours = cfg.pumpOperatingHours ?? cfg.aggregateOperatingHours ?? 0;
      const initStartCount = cfg.pumpStartCount ?? cfg.aggregateStartCount ?? 0;
      if (st.operatingHoursMs === undefined) st.operatingHoursMs = initOpHours * 3600000;
      if (st.startCount === undefined) st.startCount = initStartCount;
      if (st.aggregateCmd === undefined) st.aggregateCmd = false;
      if (st.fault === undefined) st.fault = false;
      if (st.faultLatch === undefined) st.faultLatch = false;
      if (st.feedbackFault === undefined) st.feedbackFault = false;
      if (st.lastRunTs === undefined) st.lastRunTs = now;
      if (st.antiSeizeActive === undefined) st.antiSeizeActive = false;
      if (st.antiSeizeStartTs === undefined) st.antiSeizeStartTs = null;
      if (st.startDelayTs === undefined) st.startDelayTs = null;
      if (st.stopDelayTs === undefined) st.stopDelayTs = null;
      if (st.startTs === undefined) st.startTs = null;
      if (st.prevAggregateCmd === undefined) st.prevAggregateCmd = false;
      if (st.lastTickTs === undefined) st.lastTickTs = now;

      if (resetInput && (st.faultLatch || st.feedbackFault)) {
        if (!faultInput) {
          st.faultLatch = false;
        }
        st.feedbackFault = false;
      }

      if (faultInput && !st.faultLatch) {
        st.faultLatch = true;
      }

      const hasFault = st.faultLatch || st.feedbackFault;
      const ready = !hasFault && !revisionSwitch;

      let wantStart = false;
      if (hoaMode === 2) {
        wantStart = startCmd && ready;
      } else if (hoaMode === 1) {
        wantStart = handStart && !revisionSwitch && !hasFault;
      }

      if (!st.antiSeizeActive && hoaMode === 2 && !revisionSwitch && !hasFault && !wantStart) {
        if (now - st.lastRunTs > antiSeizeIntervalMs) {
          st.antiSeizeActive = true;
          st.antiSeizeStartTs = now;
        }
      }

      if (st.antiSeizeActive) {
        if (now - st.antiSeizeStartTs >= antiSeizeRunMs) {
          st.antiSeizeActive = false;
          st.antiSeizeStartTs = null;
          st.lastRunTs = now;
        } else {
          wantStart = true;
        }
      }

      let targetCmd = wantStart;

      if (targetCmd && !st.aggregateCmd) {
        if (startDelayMs > 0) {
          if (st.startDelayTs === null) st.startDelayTs = now;
          if (now - st.startDelayTs >= startDelayMs) {
            st.aggregateCmd = true;
            st.startDelayTs = null;
          }
        } else {
          st.aggregateCmd = true;
        }
      } else if (!targetCmd && st.aggregateCmd) {
        if (stopDelayMs > 0) {
          if (st.stopDelayTs === null) st.stopDelayTs = now;
          if (now - st.stopDelayTs >= stopDelayMs) {
            st.aggregateCmd = false;
            st.stopDelayTs = null;
          }
        } else {
          st.aggregateCmd = false;
        }
      } else {
        st.startDelayTs = null;
        st.stopDelayTs = null;
      }

      if (st.aggregateCmd && !st.prevAggregateCmd) {
        st.startCount++;
        st.startTs = now;
      }
      st.prevAggregateCmd = st.aggregateCmd;

      if (enableFeedback && st.aggregateCmd && st.startTs !== null) {
        if (!aggregateFeedback && (now - st.startTs > feedbackTimeoutMs)) {
          st.feedbackFault = true;
        }
      }

      const running = aggregateFeedback;
      if (running) {
        const deltaMs = now - st.lastTickTs;
        st.operatingHoursMs += deltaMs;
        st.lastRunTs = now;
      }
      st.lastTickTs = now;

      let speedOutput = 0;
      if (st.aggregateCmd) {
        let sp = st.antiSeizeActive ? antiSeizeSpeed : speedSetpoint;
        sp = Math.max(speedMin, Math.min(speedMax, sp || 0));
        speedOutput = sp;
      }

      const alarm = hasFault;
      const operatingHours = st.operatingHoursMs / 3600000;

      nodeValues[nodeId] = st.aggregateCmd;
      nodeValues[`${nodeId}:output-0`] = st.aggregateCmd;
      nodeValues[`${nodeId}:output-1`] = speedOutput;
      nodeValues[`${nodeId}:output-2`] = running;
      nodeValues[`${nodeId}:output-3`] = hasFault;
      nodeValues[`${nodeId}:output-4`] = ready;
      nodeValues[`${nodeId}:output-5`] = alarm;
      nodeValues[`${nodeId}:output-6`] = operatingHours;
      nodeValues[`${nodeId}:output-7`] = st.startCount;
    } else if (node.type === 'valve-control') {
      const setpoint = toNumber(inputVals[0]);
      const feedback = toNumber(inputVals[1]);
      const resetInputWire = toBool(inputVals[2]);

      const visuSetpoint = cfg.valveVisuSetpoint;
      const visuReset = cfg.valveVisuReset;
      const visuHOA = cfg.valveVisuHOA ?? 2;

      const isHandMode = visuHOA === 1;
      const actualSetpoint = isHandMode && visuSetpoint !== undefined ? toNumber(visuSetpoint) : setpoint;
      const resetInput = visuReset === true ? true : resetInputWire;

      const minOutput = cfg.valveMinOutput ?? 0;
      const maxOutput = cfg.valveMaxOutput ?? 100;
      const monitoringEnable = cfg.valveMonitoringEnable !== false;
      const tolerance = cfg.valveTolerance ?? 5;
      const alarmDelayMs = cfg.valveAlarmDelayMs ?? 10000;

      const now = Date.now();
      const st = pageId ? getNodeState(pageId, nodeId) : node.__valveState || (node.__valveState = {});

      if (st.alarmTimerStart === undefined) st.alarmTimerStart = null;
      if (st.alarmLatch === undefined) st.alarmLatch = false;

      let valveOutput;
      if (isHandMode) {
        valveOutput = Math.max(minOutput, Math.min(maxOutput, actualSetpoint || 0));
      } else {
        valveOutput = Math.max(minOutput, Math.min(maxOutput, setpoint || 0));
      }
      const deviation = Math.abs(valveOutput - feedback);

      if (resetInput && st.alarmLatch) {
        st.alarmLatch = false;
        st.alarmTimerStart = null;
        if (visuReset === true) {
          cfg.valveVisuReset = false;
        }
      }

      if (monitoringEnable && deviation > tolerance) {
        if (st.alarmTimerStart === null) {
          st.alarmTimerStart = now;
        } else if (now - st.alarmTimerStart >= alarmDelayMs) {
          st.alarmLatch = true;
        }
      } else {
        st.alarmTimerStart = null;
      }

      nodeValues[nodeId] = valveOutput;
      nodeValues[`${nodeId}:output-0`] = valveOutput;
      nodeValues[`${nodeId}:output-1`] = st.alarmLatch;
      nodeValues[`${nodeId}:hoaMode`] = visuHOA;
    } else if (node.type === 'sensor-control') {
      const sensorIn = toNumber(inputVals[0]);
      const resetInputWire = toBool(inputVals[1]);

      const visuReset = cfg.sensorVisuReset;
      const resetInput = visuReset === true ? true : resetInputWire;

      const minLimit = cfg.sensorMinLimit ?? 0;
      const maxLimit = cfg.sensorMaxLimit ?? 100;
      const monitoringEnable = cfg.sensorMonitoringEnable !== false;
      const alarmDelayMs = cfg.sensorAlarmDelayMs ?? 5000;

      const visuHOA = cfg.sensorVisuHOA || 'auto';
      const manualValue = cfg.sensorManualValue ?? 0;
      const isHandMode = visuHOA === 'hand';

      const now = Date.now();
      const st = pageId ? getNodeState(pageId, nodeId) : node.__sensorState || (node.__sensorState = {});

      if (st.alarmTimerStart === undefined) st.alarmTimerStart = null;
      if (st.alarmLatch === undefined) st.alarmLatch = false;

      const sensorOut = isHandMode ? manualValue : sensorIn;
      const outOfLimits = sensorOut < minLimit || sensorOut > maxLimit;

      if (resetInput && st.alarmLatch) {
        st.alarmLatch = false;
        st.alarmTimerStart = null;
        if (visuReset === true) {
          cfg.sensorVisuReset = false;
        }
      }

      if (monitoringEnable && outOfLimits) {
        if (st.alarmTimerStart === null) {
          st.alarmTimerStart = now;
        } else if (now - st.alarmTimerStart >= alarmDelayMs) {
          st.alarmLatch = true;
        }
      } else {
        st.alarmTimerStart = null;
      }

      nodeValues[nodeId] = sensorOut;
      nodeValues[`${nodeId}:output-0`] = sensorOut;
      nodeValues[`${nodeId}:output-1`] = st.alarmLatch;
      nodeValues[`${nodeId}:input-0`] = sensorIn;
      nodeValues[`${nodeId}:hoaMode`] = visuHOA;
      nodeValues[`${nodeId}:manualValue`] = manualValue;
    } else if (node.type === 'pid-controller') {
      const setpoint = toNumber(inputVals[0]);
      const actualValue = toNumber(inputVals[1]);
      const enable = toBool(inputVals[2]);

      const Kp = cfg.pidKp ?? 1.0;
      const Ki = cfg.pidKi ?? 0.1;
      const Kd = cfg.pidKd ?? 0.0;
      const windupLimit = cfg.pidWindupLimit ?? 100;
      const minOutput = cfg.pidMinOutput ?? 0;
      const maxOutput = cfg.pidMaxOutput ?? 100;
      const reverseAction = cfg.pidReverseAction === true;

      const visuHOA = cfg.pidVisuHOA || 'auto';
      const manualOutput = cfg.pidManualOutput ?? 0;
      const isHandMode = visuHOA === 'hand';

      const now = Date.now();
      const st = pageId ? getNodeState(pageId, nodeId) : node.__pidState || (node.__pidState = {});

      if (st.integral === undefined) st.integral = 0;
      if (st.lastError === undefined) st.lastError = 0;
      if (st.lastTime === undefined) st.lastTime = now;

      let controlOutput = 0;

      if (isHandMode) {
        controlOutput = Math.max(minOutput, Math.min(maxOutput, manualOutput));
        st.integral = 0;
        st.lastError = 0;
      } else if (!enable) {
        controlOutput = 0;
        st.integral = 0;
        st.lastError = 0;
      } else {
        const dt = (now - st.lastTime) / 1000;
        const error = reverseAction ? (actualValue - setpoint) : (setpoint - actualValue);

        const P = Kp * error;

        st.integral = st.integral + (Ki * error * dt);
        st.integral = Math.max(-windupLimit, Math.min(windupLimit, st.integral));
        const I = st.integral;

        const D = dt > 0 ? Kd * (error - st.lastError) / dt : 0;

        const output = P + I + D;
        controlOutput = Math.max(minOutput, Math.min(maxOutput, output));

        st.lastError = error;
      }
      st.lastTime = now;

      nodeValues[nodeId] = controlOutput;
      nodeValues[`${nodeId}:output-0`] = controlOutput;
      nodeValues[`${nodeId}:input-0`] = setpoint;
      nodeValues[`${nodeId}:input-1`] = actualValue;
      nodeValues[`${nodeId}:input-2`] = enable;
      nodeValues[`${nodeId}:hoaMode`] = visuHOA;
      nodeValues[`${nodeId}:manualOutput`] = manualOutput;
    } else if (node.type === 'heating-curve') {
      const inputValue = toNumber(inputVals[0]);
      const enableRaw = inputVals[1];
      const enable = enableRaw === null || enableRaw === undefined ? true : toBool(enableRaw);

      const minInput = cfg.hcMinInput ?? -20;
      const maxInput = cfg.hcMaxInput ?? 20;
      const minOutput = cfg.hcMinOutput ?? 20;
      const maxOutput = cfg.hcMaxOutput ?? 80;
      const reverseDirection = cfg.hcReverseDirection !== false;

      let outputValue = 0;

      if (enable && inputValue !== null && inputValue !== undefined && !isNaN(inputValue)) {
        const inputLimited = Math.max(minInput, Math.min(maxInput, inputValue));
        const inputRange = maxInput - minInput;

        if (inputRange !== 0) {
          if (reverseDirection) {
            outputValue = maxOutput - ((inputLimited - minInput) * (maxOutput - minOutput) / inputRange);
          } else {
            outputValue = minOutput + ((inputLimited - minInput) * (maxOutput - minOutput) / inputRange);
          }
        } else {
          outputValue = minOutput;
        }
      }

      nodeValues[nodeId] = outputValue;
      nodeValues[`${nodeId}:output-0`] = outputValue;
      nodeValues[`${nodeId}:input-0`] = inputValue;
      nodeValues[`${nodeId}:input-1`] = enable;
    } else if (node.type === 'light-toggle') {
      const taster = toBool(inputVals[0]);
      const rueckmeldung = toBool(inputVals[1]);
      const pulseMs = toNumber(cfg.lightTogglePulseMs) || 500;
      const state = getNodeState(pageId, nodeId);

      const prevTaster = state.prevTaster;
      state.prevTaster = taster;

      const now = Date.now();

      if (taster && !prevTaster) {
        const command = !rueckmeldung;
        state.pulseValue = command;
        state.pulseUntil = now + pulseMs;
      }

      if (state.pulseUntil && now < state.pulseUntil) {
        nodeValues[nodeId] = state.pulseValue;
        nodeValues[`${nodeId}:output-0`] = state.pulseValue;
      } else {
        if (state.pulseUntil && now >= state.pulseUntil) {
          state.pulseUntil = null;
          state.pulseValue = null;
        }
        nodeValues[nodeId] = null;
        nodeValues[`${nodeId}:output-0`] = null;
      }

      nodeValues[`${nodeId}:input-0`] = taster;
      nodeValues[`${nodeId}:input-1`] = rueckmeldung;

    } else if (node.type === 'python-script') {
      const pythonInputs = cfg.pythonInputs || [];
      const pythonCode = cfg.pythonCode || '';
      const pythonOutputs = cfg.pythonOutputs || [];
      const inputs = {};

      pythonInputs.forEach((inp, idx) => {
        const conn = incomingConns.find(c => c.targetPort === `input-${idx}`);
        let val = null;
        if (conn) {
          val = getInputValue(conn);
        }
        inputs[inp.id] = val;
        nodeValues[`${nodeId}:input-${idx}`] = val;
      });

      console.log(`Python Script ${nodeId}: Code=${pythonCode ? pythonCode.substring(0, 50) + '...' : 'leer'}, Inputs=`, inputs);
      if (pythonCode && pythonCode.trim()) {
        try {
          const outputs = await executePythonCode(pythonCode, inputs);
          console.log(`Python Script ${nodeId} Outputs:`, outputs);
          const firstOutputId = pythonOutputs.length > 0 ? pythonOutputs[0].id.toLowerCase() : null;
          const firstOutput = firstOutputId ? outputs[firstOutputId] : null;
          nodeValues[nodeId] = firstOutput;
          nodeValues[`${nodeId}:_error`] = null;
          pythonOutputs.forEach((out, idx) => {
            const outputId = out.id.toLowerCase();
            nodeValues[`${nodeId}:output-${idx}`] = outputs[outputId];
          });
        } catch (e) {
          console.error(`Python Script Fehler (${nodeId}):`, e.message);
          const errorMsg = e.message || 'Unknown error';
          nodeValues[nodeId] = null;
          nodeValues[`${nodeId}:_error`] = errorMsg;
          pythonOutputs.forEach((out, idx) => {
            nodeValues[`${nodeId}:output-${idx}`] = null;
          });
        }
      } else {
        console.log(`Python Script ${nodeId}: Kein Code vorhanden, ueberspringe`);
        nodeValues[nodeId] = null;
        nodeValues[`${nodeId}:_error`] = null;
      }
    } else if (node.type === 'ha-output' && node.data.entityId) {
      let allowWrite = true;
      if (node.data.parentContainerId) {
        const parentContainer = nodes.find(n => n.id === node.data.parentContainerId);
        if (parentContainer && parentContainer.type === 'case-container') {
          const activeCase = caseContainerActiveCase.get(parentContainer.id) || 0;
          const nodeCase = node.data.caseIndex;
          if (nodeCase !== undefined && nodeCase !== activeCase) {
            allowWrite = false;
            console.log(`HA-Output ${nodeId} nicht geschrieben - Case ${nodeCase} ist inaktiv (aktiv: ${activeCase})`);
          }
        }
      }

      if (allowWrite) {
        const val = inputVals[0];
        if (val !== null && val !== undefined) {
          const entityId = node.data.entityId;
          const [domain] = entityId.split('.');
          const isNumericDomain = ['input_number', 'number', 'climate', 'cover'].includes(domain);
          const writeKey = `node:${nodeId}:${entityId}`;
          const lastWritten = haLastWrittenValues.get(writeKey);
          const haState = haLiveValues.get(entityId);

          let normalizedVal;
          if (isNumericDomain) {
            normalizedVal = parseFloat(val);
            if (isNaN(normalizedVal)) normalizedVal = null;
          } else {
            normalizedVal = toBool(val);
          }

          if (normalizedVal === null) {
            nodeValues[nodeId] = null;
          } else {
            if (haState && lastWritten !== undefined) {
              let haCurrentVal;
              if (isNumericDomain) {
                haCurrentVal = parseFloat(haState.state);
              } else {
                haCurrentVal = haState.state === 'on' || haState.state === 'true';
              }
              if (String(haCurrentVal) !== String(lastWritten)) {
                haLastWrittenValues.delete(writeKey);
              }
            }

            const valueChanged = haLastWrittenValues.get(writeKey) === undefined || String(haLastWrittenValues.get(writeKey)) !== String(normalizedVal);
            if (valueChanged) {
              try {
                if (domain === 'light') {
                  await haPost(`/services/light/${normalizedVal ? 'turn_on' : 'turn_off'}`, { entity_id: entityId });
                } else if (domain === 'switch') {
                  await haPost(`/services/switch/${normalizedVal ? 'turn_on' : 'turn_off'}`, { entity_id: entityId });
                } else if (domain === 'input_boolean') {
                  await haPost(`/services/input_boolean/${normalizedVal ? 'turn_on' : 'turn_off'}`, { entity_id: entityId });
                } else if (domain === 'input_number') {
                  await haPost('/services/input_number/set_value', { entity_id: entityId, value: normalizedVal });
                } else if (domain === 'number') {
                  await haPost('/services/number/set_value', { entity_id: entityId, value: normalizedVal });
                } else if (domain === 'climate') {
                  await haPost('/services/climate/set_temperature', { entity_id: entityId, temperature: normalizedVal });
                } else if (domain === 'cover') {
                  await haPost('/services/cover/set_cover_position', { entity_id: entityId, position: normalizedVal });
                } else {
                  await haPost(`/services/${domain}/${normalizedVal ? 'turn_on' : 'turn_off'}`, { entity_id: entityId });
                }
                haLastWrittenValues.set(writeKey, normalizedVal);
                console.log(`HA Output ${entityId}: ${normalizedVal} (geaendert)`);
                nodeValues[nodeId] = normalizedVal;
              } catch (e) {
                console.error(`HA Output Fehler fuer ${entityId}:`, e.message);
                nodeValues[nodeId] = null;
              }
            } else {
              nodeValues[nodeId] = normalizedVal;
            }
          }
        }
      }
    } else if (node.type === 'modbus-device-output') {
      let allowWrite = true;
      if (node.data.parentContainerId) {
        const parentContainer = nodes.find(n => n.id === node.data.parentContainerId);
        if (parentContainer && parentContainer.type === 'case-container') {
          const activeCase = caseContainerActiveCase.get(parentContainer.id) || 0;
          const nodeCase = node.data.caseIndex;
          if (nodeCase !== undefined && nodeCase !== activeCase) {
            allowWrite = false;
            console.log(`Modbus-Output ${nodeId} nicht geschrieben - Case ${nodeCase} ist inaktiv (aktiv: ${activeCase})`);
          }
        }
      }

      console.log(`[MODBUS-OUT DEBUG] Node: ${nodeId}, inputVals: ${JSON.stringify(inputVals)}, inputs: ${JSON.stringify(node.data.inputs)}`);

      if (!driverConfig.modbusDriverEnabled) {
        console.log(`Modbus Output ${nodeId}: Modbus-Treiber deaktiviert`);
        nodeValues[nodeId] = inputVals[0] ?? null;
      } else if (allowWrite) {
        const deviceId = cfg.modbusDeviceId;
        const datapoints = cfg.modbusDatapoints || [];
        const device = modbusDeviceMap.get(deviceId);
        console.log(`[MODBUS-OUT DEBUG] deviceId: ${deviceId}, found: ${!!device}, modbusDriverEnabled: ${driverConfig.modbusDriverEnabled}`);

        if (!device) {
          console.log(`Modbus Output ${nodeId}: Geraet ${deviceId} nicht gefunden`);
          nodeValues[nodeId] = null;
        } else if (!device.enabled) {
          console.log(`Modbus Output ${nodeId}: Geraet ${device.name} deaktiviert`);
          nodeValues[nodeId] = inputVals[0] ?? null;
        } else {
          for (let i = 0; i < datapoints.length; i++) {
            const dp = datapoints[i];
            const val = inputVals[i];

            if (val !== null && val !== undefined) {
              try {
                const queueKey = `${device.host}:${device.port}:${device.unitId}:${dp.address}`;
                if (dp.bitIndex !== undefined && dp.bitIndex >= 0) {
                  const bitValue = toBool(val);
                  await enqueueModbusWrite(queueKey, () => modbusWriteBit(
                    device.host,
                    device.port,
                    device.unitId,
                    dp.address,
                    dp.bitIndex,
                    bitValue,
                    dp.registerType || 'holding',
                    device.timeout || 3000
                  ));
                  console.log(`Modbus WriteBit ${device.name}/${dp.name} (${dp.address}:${dp.bitIndex}): ${bitValue}`);
                } else {
                  let writeValue = val;
                  if (dp.scale && dp.scale !== 1) {
                    writeValue = writeValue / dp.scale;
                  }
                  if (dp.offset) {
                    writeValue = writeValue - dp.offset;
                  }
                  await enqueueModbusWrite(queueKey, () => modbusWriteRegister(
                    device.host,
                    device.port,
                    device.unitId,
                    dp.address,
                    writeValue,
                    dp.registerType || 'holding',
                    dp.dataType || 'uint16',
                    device.timeout || 3000
                  ));
                  console.log(`Modbus Write ${device.name}/${dp.name} (${dp.address}): ${writeValue}`);
                }
                nodeValues[`${nodeId}:input-${i}`] = val;
              } catch (err) {
                console.error(`Modbus Write Fehler ${device.name}/${dp.name}:`, err.message);
              }
            }
          }
          nodeValues[nodeId] = inputVals[0] ?? null;
        }
      }
    } else if (node.type === 'modbus-driver') {
      const devices = cfg.modbusDevices || [];
      let anyOffline = false;
      for (const device of devices) {
        if (!device.enabled) continue;
        try {
          await new Promise((resolve, reject) => {
            const pingSocket = new net.Socket();
            let pingHandled = false;
            const pingTimeout = setTimeout(() => {
              if (!pingHandled) {
                pingHandled = true;
                pingSocket.destroy();
                reject(new Error('Timeout'));
              }
            }, 2000);
            pingSocket.on('connect', () => {
              if (pingHandled) return;
              pingHandled = true;
              clearTimeout(pingTimeout);
              pingSocket.destroy();
              resolve();
            });
            pingSocket.on('error', (err) => {
              if (pingHandled) return;
              pingHandled = true;
              clearTimeout(pingTimeout);
              pingSocket.destroy();
              reject(err);
            });
            pingSocket.connect(device.port || 502, device.host);
          });
        } catch {
          anyOffline = true;
          console.log(`Modbus Treiber: Geraet ${device.name} (${device.host}) ist offline`);
          break;
        }
      }
      const statusValue = anyOffline ? 1 : 0;
      nodeValues[nodeId] = statusValue;
      nodeValues[`${nodeId}:output-0`] = statusValue;
      console.log(`Modbus Treiber Status: ${anyOffline ? 'Stoerung (1)' : 'Normal (0)'}`);
    }
  }

  for (const [key, value] of Object.entries(bindingValues)) {
    nodeValues[key] = value;
  }

  const outputBindings = (driverConfig.driverBindings || []).filter(b => b.direction === 'output');
  const outputBindingPromises = outputBindings.map(async (binding) => {
    const bindingKey = `${binding.nodeId}:${binding.portId}`;
    try {
      const sourceNode = nodes.find(n => n.id === binding.nodeId);
      if (!sourceNode) {
        console.log(`Output Binding ${bindingKey}: Node nicht gefunden`);
        return;
      }

      const outputPorts = sourceNode.data.outputs || [];
      const portIndex = outputPorts.findIndex((p, idx) => p.id === binding.portId || `output-${idx}` === binding.portId);
      let valueToWrite = nodeValues[binding.nodeId];

      const portKey = `${binding.nodeId}:${binding.portId}`;
      if (nodeValues[portKey] !== undefined) {
        valueToWrite = nodeValues[portKey];
      }

      if (valueToWrite === undefined || valueToWrite === null) {
        console.log(`Output Binding ${bindingKey}: Kein Wert vorhanden`);
        return;
      }

      if (binding.driverType === 'modbus') {
        if (!driverConfig.modbusDriverEnabled) {
          return;
        }
        const device = modbusDeviceMap.get(binding.deviceId);
        if (!device) {
          console.log(`Output Binding ${bindingKey}: Modbus-Geraet ${binding.deviceId} nicht gefunden`);
          return;
        }
        if (!device.enabled) {
          console.log(`Output Binding ${bindingKey}: Geraet ${device.name} deaktiviert`);
          return;
        }
        const dp = device.datapoints?.find(d => d.id === binding.datapointId);
        if (!dp) {
          console.log(`Output Binding ${bindingKey}: Datenpunkt ${binding.datapointId} nicht gefunden`);
          return;
        }

        const queueKey = `${device.host}:${device.port}:${device.unitId}`;

        if (dp.bitIndex !== undefined && dp.bitIndex >= 0) {
          const bitValue = valueToWrite ? 1 : 0;
          await enqueueModbusWrite(queueKey, () => modbusWriteBit(
            device.host,
            device.port,
            device.unitId,
            dp.address,
            dp.bitIndex,
            bitValue,
            dp.registerType || 'holding',
            device.timeout || 3000
          ));
          console.log(`Output Binding Modbus WriteBit ${device.name}/${dp.name} (${dp.address}:${dp.bitIndex}): ${bitValue}`);
        } else {
          let writeValue = Number(valueToWrite);
          if (dp.scale && dp.scale !== 1) writeValue = writeValue / dp.scale;
          if (dp.offset) writeValue = writeValue - dp.offset;
          writeValue = Math.round(writeValue);

          await enqueueModbusWrite(queueKey, () => modbusWriteRegister(
            device.host,
            device.port,
            device.unitId,
            dp.address,
            writeValue,
            dp.registerType || 'holding',
            dp.dataType || 'uint16',
            device.timeout || 3000
          ));
          console.log(`Output Binding Modbus Write ${device.name}/${dp.name} (${dp.address}): ${writeValue}`);
        }
      } else if (binding.driverType === 'homeassistant' && binding.haEntityId) {
        if (!driverConfig.haDriverEnabled) {
          return;
        }
        const bindingWriteKey = `binding:${binding.id}:${binding.haEntityId}`;
        const lastBindingWritten = haLastWrittenValues.get(bindingWriteKey);
        const domain = binding.haDomain || binding.haEntityId.split('.')[0];
        const isBoolDomain = ['light', 'switch', 'input_boolean'].includes(domain) || (!['input_number', 'number', 'climate', 'cover'].includes(domain));
        let normalizedValue = valueToWrite;
        if (isBoolDomain) normalizedValue = toBool(valueToWrite);
        const haBindingState = haLiveValues.get(binding.haEntityId);
        if (haBindingState && lastBindingWritten !== undefined) {
          let haBindingCurrent;
          if (isBoolDomain) haBindingCurrent = haBindingState.state === 'on' || haBindingState.state === 'true';
          else haBindingCurrent = String(parseFloat(haBindingState.state));
          if (String(haBindingCurrent) !== String(lastBindingWritten)) {
            haLastWrittenValues.delete(bindingWriteKey);
          }
        }
        const bindingValueChanged = haLastWrittenValues.get(bindingWriteKey) === undefined || String(haLastWrittenValues.get(bindingWriteKey)) !== String(normalizedValue);
        if (!bindingValueChanged) {
          return;
        }
        let service = 'turn_on';
        let serviceData = {};

        if (domain === 'light') {
          service = normalizedValue ? 'turn_on' : 'turn_off';
          serviceData = { entity_id: binding.haEntityId };
        } else if (domain === 'switch' || domain === 'input_boolean') {
          service = normalizedValue ? 'turn_on' : 'turn_off';
          serviceData = { entity_id: binding.haEntityId };
        } else if (domain === 'input_number' || domain === 'number') {
          service = 'set_value';
          serviceData = { entity_id: binding.haEntityId, value: Number(valueToWrite) };
        } else if (domain === 'climate') {
          service = 'set_temperature';
          serviceData = { entity_id: binding.haEntityId, temperature: Number(valueToWrite) };
        } else if (domain === 'cover') {
          service = 'set_cover_position';
          serviceData = { entity_id: binding.haEntityId, position: Number(valueToWrite) };
        } else {
          service = normalizedValue ? 'turn_on' : 'turn_off';
          serviceData = { entity_id: binding.haEntityId };
        }

        await haPost(`/services/${domain}/${service}`, serviceData);
        haLastWrittenValues.set(bindingWriteKey, normalizedValue);
        console.log(`Output Binding HA ${domain}.${service} ${binding.haEntityId}: ${normalizedValue} (geaendert)`);
      }
    } catch (err) {
      console.error(`Output Binding ${bindingKey} Write Fehler:`, err.message);
    }
  });

  await Promise.all(outputBindingPromises);

  return nodeValues;
}

app.post(['/pages/:pageId/execute', '/api/pages/:pageId/execute'], async (req, res) => {
  const { pageId } = req.params;

  if (runningPages.has(pageId) && runningPages.get(pageId).running) {
    const nodeValues = lastNodeValues.get(pageId) || {};
    return res.json({ success: true, nodeValues });
  }

  const { nodes, connections, manualOverrides = {} } = req.body;
  try {
    const nodeValues = await executePageLogic(nodes, connections, manualOverrides, pageId);

    res.json({ success: true, nodeValues });
  } catch (err) {
    console.error('Execute error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

async function triggerImmediateExecution(affectedNodeId) {
  for (const [pageId, pageInfo] of runningPages.entries()) {
    if (!pageInfo.running) continue;
    try {
      const data = await fs.readFile(pagesFile, 'utf-8');
      const pages = JSON.parse(data);
      const page = pages.find(p => p.id === pageId);
      if (!page) continue;
      if (affectedNodeId && !page.nodes.some(n => n.id === affectedNodeId)) continue;
      if (pageInfo.timeout) {
        clearTimeout(pageInfo.timeout);
        pageInfo.timeout = null;
      }
      const manualOverrides = {};
      for (const node of page.nodes) {
        if (node.data.override?.manual) manualOverrides[node.id] = node.data.override.value;
      }
      const nodeValues = await executePageLogic(page.nodes, page.connections, manualOverrides, pageId);
      lastNodeValues.set(pageId, nodeValues);
      dpStore.setFromLogicOutput(nodeValues);
      if (pageInfo.running) {
        pageInfo.timeout = setTimeout(() => runPageCycle(pageId), pageInfo.cycleMs);
      }
    } catch (err) {
      console.error(`Sofort-Ausfuehrung Fehler fuer ${pageId}:`, err.message);
    }
  }
}

async function runPageCycle(pageId) {
  const pageInfo = runningPages.get(pageId);
  if (!pageInfo || !pageInfo.running) return;

  try {
    const data = await fs.readFile(pagesFile, 'utf-8');
    const pages = JSON.parse(data);
    const page = pages.find(p => p.id === pageId);

    if (!page) {
      console.log(`Seite ${pageId} nicht gefunden, stoppe Ausfuehrung`);
      stopPage(pageId);
      return;
    }

    if (page.nodes.length > 0) {
      const manualOverrides = {};
      for (const node of page.nodes) {
        if (node.data.override?.manual) {
          manualOverrides[node.id] = node.data.override.value;
        }
      }

      const pendingResets = [];
      for (const [dpKey, queue] of [...impulseQueue.entries()]) {
        if (queue.length === 0) { impulseQueue.delete(dpKey); continue; }
        const item = queue.shift();
        if (queue.length === 0) impulseQueue.delete(dpKey);
        dpStore.set(dpKey, item.val, { silent: true });
        pendingResets.push({ dpKey, val: item.val, resetVal: item.resetVal });
      }

      const nodeValues = await executePageLogic(page.nodes, page.connections, manualOverrides, pageId);

      for (const item of pendingResets) {
        if (item.val === item.resetVal) continue;
        const q = impulseQueue.get(item.dpKey) || [];
        q.unshift({ val: item.resetVal, resetVal: item.resetVal });
        impulseQueue.set(item.dpKey, q);
        dpStore.set(item.dpKey, item.resetVal, { silent: true });
      }

      lastNodeValues.set(pageId, nodeValues);
      dpStore.setFromLogicOutput(nodeValues);

      const trendNow = Date.now();
      for (const trackedNode of trendConfig.trackedNodes) {
        if (!trackedNode.enabled) continue;
        const val = nodeValues[trackedNode.nodeId];
        if (val !== undefined && val !== null) {
          recordTrendValue(trackedNode.nodeId, val, trendNow);
        }
      }
    }

    pageInfo.lastRun = Date.now();
    pageInfo.cycleCount++;

  } catch (err) {
    console.error(`Zyklus-Fehler fuer ${pageId}:`, err.message);
  }

  if (pageInfo.running) {
    pageInfo.timeout = setTimeout(() => runPageCycle(pageId), pageInfo.cycleMs);
  }
}

function startPage(pageId, cycleMs) {
  if (runningPages.has(pageId)) {
    const existing = runningPages.get(pageId);
    if (existing.timeout) clearTimeout(existing.timeout);
  }

  const pageInfo = {
    running: true,
    cycleMs: Math.max(20, cycleMs || 250),
    lastRun: null,
    cycleCount: 0,
    timeout: null
  };

  runningPages.set(pageId, pageInfo);
  console.log(`Seite ${pageId} gestartet mit ${pageInfo.cycleMs}ms Zykluszeit`);

  runPageCycle(pageId);
}

function stopPage(pageId) {
  const pageInfo = runningPages.get(pageId);
  if (pageInfo) {
    pageInfo.running = false;
    if (pageInfo.timeout) {
      clearTimeout(pageInfo.timeout);
    }
    runningPages.delete(pageId);
    pageNodeStates.delete(pageId);
    lastNodeValues.delete(pageId);
    console.log(`Seite ${pageId} gestoppt`);
  }
}

app.post(['/pages/:pageId/start', '/api/pages/:pageId/start'], async (req, res) => {
  const { pageId } = req.params;
  const { cycleMs } = req.body;

  try {
    const data = await fs.readFile(pagesFile, 'utf-8');
    const pages = JSON.parse(data);
    const page = pages.find(p => p.id === pageId);

    if (!page) {
      return res.status(404).json({ error: 'Seite nicht gefunden' });
    }

    const actualCycleMs = cycleMs || page.cycleMs || 250;
    startPage(pageId, actualCycleMs);

    page.running = true;
    await fs.writeFile(pagesFile, JSON.stringify(pages, null, 2));

    res.json({ success: true, pageId, cycleMs: actualCycleMs });
  } catch (err) {
    console.error('Start-Fehler:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post(['/pages/:pageId/stop', '/api/pages/:pageId/stop'], async (req, res) => {
  const { pageId } = req.params;

  try {
    stopPage(pageId);

    const data = await fs.readFile(pagesFile, 'utf-8');
    const pages = JSON.parse(data);
    const page = pages.find(p => p.id === pageId);

    if (page) {
      page.running = false;
      await fs.writeFile(pagesFile, JSON.stringify(pages, null, 2));
    }

    res.json({ success: true, pageId });
  } catch (err) {
    console.error('Stop-Fehler:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get(['/pages/running', '/api/pages/running'], (req, res) => {
  const status = {};
  runningPages.forEach((info, pageId) => {
    status[pageId] = {
      running: info.running,
      cycleMs: info.cycleMs,
      lastRun: info.lastRun,
      cycleCount: info.cycleCount
    };
  });
  res.json(status);
});

app.get(['/blocks', '/api/blocks'], async (req, res) => {
  try {
    const data = await fs.readFile(blocksFile, 'utf-8');
    const blocks = JSON.parse(data);
    console.log(`Geladen: ${blocks.length} Custom Blocks`);
    res.json(blocks);
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.json([]);
    } else {
      console.error('Fehler beim Laden der Blocks:', err);
      res.status(500).json({ error: 'Fehler beim Laden der Blocks', details: err.message });
    }
  }
});

app.post(['/blocks', '/api/blocks'], async (req, res) => {
  try {
    const blocks = req.body;
    if (!Array.isArray(blocks)) {
      return res.status(400).json({ error: 'Ungueltige Daten - Array erwartet' });
    }
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(blocksFile, JSON.stringify(blocks, null, 2));
    console.log(`Gespeichert: ${blocks.length} Custom Blocks`);
    res.json({ success: true, saved: blocks.length });
  } catch (err) {
    console.error('Fehler beim Speichern der Blocks:', err);
    res.status(500).json({ error: 'Fehler beim Speichern der Blocks', details: err.message });
  }
});

app.get(['/visu-pages', '/api/visu-pages'], async (req, res) => {
  try {
    const data = await fs.readFile(visuPagesFile, 'utf-8');
    const pages = JSON.parse(data);
    console.log(`Geladen: ${pages.length} Visu-Seiten`);
    res.json(pages);
  } catch (err) {
    if (err.code === 'ENOENT') {
      const defaultPages = [
        { id: 'visu-page-1', name: 'Visu 1', widgets: [], backgroundColor: '#0f172a', gridSize: 10, showGrid: true }
      ];
      res.json(defaultPages);
    } else {
      console.error('Fehler beim Laden der Visu-Seiten:', err);
      res.status(500).json({ error: 'Fehler beim Laden der Visu-Seiten', details: err.message });
    }
  }
});

app.post(['/visu-pages', '/api/visu-pages'], async (req, res) => {
  try {
    const pages = req.body;
    if (!Array.isArray(pages)) {
      return res.status(400).json({ error: 'Ungueltige Daten - Array erwartet' });
    }
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(visuPagesFile, JSON.stringify(pages, null, 2));
    console.log(`Gespeichert: ${pages.length} Visu-Seiten`);
    res.json({ success: true, saved: pages.length });
  } catch (err) {
    console.error('Fehler beim Speichern der Visu-Seiten:', err);
    res.status(500).json({ error: 'Fehler beim Speichern der Visu-Seiten', details: err.message });
  }
});

function parseDpKey(dpKey) {
  if (!dpKey) return { nodeId: dpKey, segment: 'primary' };
  const colonIdx = dpKey.indexOf(':');
  if (colonIdx === -1) return { nodeId: dpKey, segment: 'primary' };
  const nodeId = dpKey.slice(0, colonIdx);
  const rest = dpKey.slice(colonIdx + 1);
  if (rest.startsWith('cfg:')) return { nodeId, segment: 'cfg', paramKey: rest.slice(4) };
  if (rest.startsWith('output-')) return { nodeId, segment: 'output', portId: rest };
  if (rest.startsWith('input-')) return { nodeId, segment: 'input', portId: rest };
  return { nodeId, segment: 'port', portId: rest };
}

async function resolvePrimaryDpKey(dpKey) {
  const parsed = parseDpKey(dpKey);
  if (parsed.segment !== 'primary') return dpKey;
  try {
    const data = await fs.readFile(pagesFile, 'utf-8');
    const pages = JSON.parse(data);
    for (const page of pages) {
      const node = page.nodes.find(n => n.id === parsed.nodeId);
      if (node) {
        const inputs = node.data?.inputs || [];
        if (inputs.length === 1) return `${parsed.nodeId}:${inputs[0].id}`;
        if (inputs.length > 1) return dpKey;
        return dpKey;
      }
    }
  } catch {}
  return dpKey;
}

async function writeCfgParam(nodeId, paramKey, value) {
  const data = await fs.readFile(pagesFile, 'utf-8');
  const pages = JSON.parse(data);
  let updated = false;
  for (const page of pages) {
    const node = page.nodes.find(n => n.id === nodeId);
    if (node) {
      if (!node.data.config) node.data.config = {};
      node.data.config[paramKey] = value;
      updated = true;
      break;
    }
  }
  if (updated) {
    await fs.writeFile(pagesFile, JSON.stringify(pages, null, 2));
  }
  return updated;
}

async function broadcastNodeConfigs() {
  try {
    const data = await fs.readFile(pagesFile, 'utf-8');
    const pages = JSON.parse(data);
    const nodeConfigs = {};
    for (const page of pages) {
      for (const node of (page.nodes || [])) {
        if (node.data?.config) nodeConfigs[node.id] = node.data.config;
      }
    }
    broadcastSSE('state', { liveValues: getLiveSnapshot(), nodeConfigs });
  } catch {}
}

function normalizeDpWritePayload(body) {
  if (body.dpKey) return { dpKey: body.dpKey, value: body.value, mode: body.mode || 'set', releaseValue: body.releaseValue };

  const { nodeId, portId, paramKey, value, impulse, releaseValue } = body;
  let dpKey;
  if (paramKey) {
    dpKey = `${nodeId}:cfg:${paramKey}`;
  } else if (portId) {
    dpKey = `${nodeId}:${portId}`;
  } else {
    dpKey = nodeId;
  }
  return { dpKey, value, mode: impulse ? 'impulse' : 'set', releaseValue };
}

function expandCompositeControl(nodeId, ctrl, rawValue) {
  const writes = [];
  const aggCtrl = rawValue.pumpControl || rawValue.aggregateControl;
  if (aggCtrl) {
    const prefix = rawValue.aggregateControl ? 'aggregate' : 'pump';
    if (aggCtrl.hoaMode !== undefined) writes.push({ dpKey: `${nodeId}:cfg:${prefix}VisuHOA`, value: aggCtrl.hoaMode });
    if (aggCtrl.handStart !== undefined) writes.push({ dpKey: `${nodeId}:cfg:${prefix}VisuHandStart`, value: aggCtrl.handStart });
    if (aggCtrl.reset !== undefined) writes.push({ dpKey: `${nodeId}:cfg:${prefix}VisuReset`, value: aggCtrl.reset });
    for (const key of Object.keys(aggCtrl)) {
      if (key.startsWith('param_')) writes.push({ dpKey: `${nodeId}:cfg:${key.slice(6)}`, value: aggCtrl[key] });
    }
    return writes;
  }
  const valveCtrl = rawValue.valveControl;
  if (valveCtrl) {
    if (valveCtrl.setpoint !== undefined) writes.push({ dpKey: `${nodeId}:cfg:valveVisuSetpoint`, value: valveCtrl.setpoint });
    if (valveCtrl.reset !== undefined) writes.push({ dpKey: `${nodeId}:cfg:valveVisuReset`, value: valveCtrl.reset });
    if (valveCtrl.hoa !== undefined) writes.push({ dpKey: `${nodeId}:cfg:valveVisuHOA`, value: valveCtrl.hoa });
    for (const key of Object.keys(valveCtrl)) {
      if (key.startsWith('param_')) writes.push({ dpKey: `${nodeId}:cfg:${key.slice(6)}`, value: valveCtrl[key] });
    }
    return writes;
  }
  const sensorCtrl = rawValue.sensorControl;
  if (sensorCtrl) {
    if (sensorCtrl.reset !== undefined) writes.push({ dpKey: `${nodeId}:cfg:sensorVisuReset`, value: sensorCtrl.reset });
    if (sensorCtrl.hoaMode !== undefined) writes.push({ dpKey: `${nodeId}:cfg:sensorVisuHOA`, value: sensorCtrl.hoaMode });
    if (sensorCtrl.manualValue !== undefined) writes.push({ dpKey: `${nodeId}:cfg:sensorManualValue`, value: sensorCtrl.manualValue });
    for (const key of Object.keys(sensorCtrl)) {
      if (key.startsWith('param_')) writes.push({ dpKey: `${nodeId}:cfg:${key.slice(6)}`, value: sensorCtrl[key] });
    }
    return writes;
  }
  const hcCtrl = rawValue.heatingCurveControl;
  if (hcCtrl) {
    for (const key of Object.keys(hcCtrl)) {
      if (key.startsWith('param_')) writes.push({ dpKey: `${nodeId}:cfg:${key.slice(6)}`, value: hcCtrl[key] });
    }
    return writes;
  }
  const pidCtrl = rawValue.pidControl;
  if (pidCtrl) {
    if (pidCtrl.hoaMode !== undefined) writes.push({ dpKey: `${nodeId}:cfg:pidVisuHOA`, value: pidCtrl.hoaMode });
    if (pidCtrl.manualOutput !== undefined) writes.push({ dpKey: `${nodeId}:cfg:pidManualOutput`, value: pidCtrl.manualOutput });
    for (const key of Object.keys(pidCtrl)) {
      if (key.startsWith('param_')) writes.push({ dpKey: `${nodeId}:cfg:${key.slice(6)}`, value: pidCtrl[key] });
    }
    return writes;
  }
  return writes;
}

app.post(['/visu/write-value', '/api/visu/write-value'], async (req, res) => {
  try {
    const rawValue = req.body.value;
    const srcNodeId = req.body.nodeId || (req.body.dpKey ? req.body.dpKey.split(':')[0] : null);

    console.log(`[DEBUG write-value] >>>EINGANG<<< body=${JSON.stringify(req.body)} | ip=${req.ip} | url=${req.originalUrl}`);

    if (!srcNodeId && !req.body.dpKey) {
      console.warn(`[DEBUG write-value] 400 - keine nodeId/dpKey`);
      return res.status(400).json({ error: 'nodeId oder dpKey fehlt' });
    }

    let writes = [];
    if (rawValue && typeof rawValue === 'object' && (
      rawValue.pumpControl || rawValue.aggregateControl || rawValue.valveControl ||
      rawValue.sensorControl || rawValue.heatingCurveControl || rawValue.pidControl
    )) {
      writes = expandCompositeControl(srcNodeId, null, rawValue);
      console.log(`[DEBUG write-value] composite expand -> ${JSON.stringify(writes)}`);
    } else {
      const normalized = normalizeDpWritePayload(req.body);
      writes = [normalized];
      console.log(`[DEBUG write-value] normalized -> ${JSON.stringify(normalized)}`);
    }

    let needsConfigBroadcast = false;
    const affectedNodeIds = new Set();

    for (const write of writes) {
      let { dpKey, value, mode = 'set', releaseValue = false } = write;
      const dpKeyBefore = dpKey;
      dpKey = await resolvePrimaryDpKey(dpKey);
      if (dpKey !== dpKeyBefore) console.log(`[DEBUG write-value] resolvePrimary: '${dpKeyBefore}' -> '${dpKey}'`);
      const parsed = parseDpKey(dpKey);

      console.log(`[DEBUG write-value] segment='${parsed.segment}' nodeId='${parsed.nodeId}' paramKey='${parsed.paramKey}' portId='${parsed.portId}' value=${JSON.stringify(value)}`);

      if (parsed.segment === 'cfg') {
        const updated = await writeCfgParam(parsed.nodeId, parsed.paramKey, value);
        dpStore.set(dpKey, value);
        needsConfigBroadcast = true;
        affectedNodeIds.add(parsed.nodeId);
        if (updated) {
          console.log(`[DEBUG write-value] cfg OK: dpKey='${dpKey}' value=${JSON.stringify(value)}`);
        } else {
          console.warn(`[DEBUG write-value] cfg WARNUNG: Node '${parsed.nodeId}' nicht in pages.json gefunden - dpStore trotzdem gesetzt`);
        }
      } else if (mode === 'impulse') {
        const existing = (impulseQueue.get(dpKey) || []).filter(e => e.val !== e.resetVal);
        existing.push({ val: value, resetVal: releaseValue });
        impulseQueue.set(dpKey, existing);
        dpStore.set(dpKey, value);
        affectedNodeIds.add(parsed.nodeId);
      } else {
        const persist = parsed.segment === 'primary';
        dpStore.set(dpKey, value, { persist });
        affectedNodeIds.add(parsed.nodeId);
      }
    }

    if (needsConfigBroadcast) {
      await broadcastNodeConfigs();
    }

    for (const nodeId of affectedNodeIds) {
      triggerImmediateExecution(nodeId).catch(() => {});
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Fehler in write-value:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get(['/live-values', '/api/live-values'], (req, res) => {
  const merged = {};
  for (const [, values] of lastNodeValues) {
    Object.assign(merged, values);
  }
  res.json({ values: merged });
});

app.get(['/visu-poll', '/api/visu-poll'], async (req, res) => {
  try {
    const liveValues = getLiveSnapshot();
    const nodeConfigs = await getNodeConfigSnapshot();
    let alarmData = { activeAlarms: [], alarmClasses: [], alarmConsoles: [] };
    try {
      const alarmRaw = await fs.readFile(alarmConfigFile, 'utf-8');
      const ac = JSON.parse(alarmRaw);
      alarmData = { activeAlarms: ac.activeAlarms || [], alarmClasses: ac.alarmClasses || [], alarmConsoles: ac.alarmConsoles || [] };
    } catch {}
    res.json({ liveValues, nodeConfigs, ...alarmData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const sseClients = new Set();

function broadcastSSE(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(msg); } catch {}
  }
}

function getLiveSnapshot() {
  return dpStore.getSnapshot();
}

dpStore.onBatch((changedKeys) => {
  broadcastSSE('state', { liveValues: dpStore.getDiff(changedKeys) });
});

async function getNodeConfigSnapshot() {
  try {
    const data = await fs.readFile(pagesFile, 'utf-8');
    const pages = JSON.parse(data);
    const configs = {};
    for (const page of pages) {
      for (const node of (page.nodes || [])) {
        if (node.data?.config) configs[node.id] = node.data.config;
      }
    }
    return configs;
  } catch { return {}; }
}

function setupSSEClient(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  sseClients.add(res);
  res.write(':ok\n\n');

  (async () => {
    const liveValues = getLiveSnapshot();
    const nodeConfigs = await getNodeConfigSnapshot();
    res.write(`event: state\ndata: ${JSON.stringify({ liveValues, nodeConfigs })}\n\n`);
    res.write(`event: driver-values\ndata: ${JSON.stringify({ modbus: Object.fromEntries(modbusLiveValues), ha: Object.fromEntries(haLiveValues) })}\n\n`);
    res.write(`event: modbus-device-status\ndata: ${JSON.stringify(Object.fromEntries(modbusDeviceOnlineStatus))}\n\n`);
  })();

  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch { clearInterval(heartbeat); }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
}

app.get(['/sse', '/api/sse'], (req, res) => setupSSEClient(req, res));

visuApp.get(['/sse', '/api/sse'], (req, res) => setupSSEClient(req, res));

const net = require('net');

function modbusReadRegister(host, port, unitId, address, registerType, dataType, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let connected = false;
    let responseHandled = false;

    const connectTimeout = setTimeout(() => {
      if (!connected && !responseHandled) {
        responseHandled = true;
        socket.destroy();
        reject(new Error('Connection timeout'));
      }
    }, timeout);

    socket.on('connect', () => {
      connected = true;
      clearTimeout(connectTimeout);

      let functionCode;
      switch (registerType) {
        case 'coil': functionCode = 0x01; break;
        case 'discrete': functionCode = 0x02; break;
        case 'input': functionCode = 0x04; break;
        case 'holding':
        default: functionCode = 0x03; break;
      }

      const count = (dataType === 'int32' || dataType === 'uint32' || dataType === 'float32') ? 2 : 1;

      const transactionId = Buffer.from([0x00, Math.floor(Math.random() * 255)]);
      const protocolId = Buffer.from([0x00, 0x00]);
      const length = Buffer.from([0x00, 0x06]);
      const unitIdBuf = Buffer.from([unitId]);
      const fc = Buffer.from([functionCode]);
      const startAddress = Buffer.from([(address >> 8) & 0xff, address & 0xff]);
      const quantity = Buffer.from([(count >> 8) & 0xff, count & 0xff]);

      const request = Buffer.concat([transactionId, protocolId, length, unitIdBuf, fc, startAddress, quantity]);
      socket.write(request);
    });

    socket.on('data', (data) => {
      if (responseHandled) return;
      responseHandled = true;
      socket.destroy();

      if (data.length < 9) {
        reject(new Error('Response too short'));
        return;
      }

      const responseFc = data[7];
      if (responseFc > 0x80) {
        const errorCode = data[8];
        reject(new Error(`Modbus error: ${errorCode}`));
        return;
      }

      if (registerType === 'coil' || registerType === 'discrete') {
        const byteVal = data[9];
        resolve(byteVal & 0x01 ? true : false);
        return;
      }

      let rawValue;
      if (dataType === 'int32' || dataType === 'uint32' || dataType === 'float32') {
        if (data.length < 13) {
          reject(new Error('Response too short for 32-bit value'));
          return;
        }
        rawValue = (data[9] << 24) | (data[10] << 16) | (data[11] << 8) | data[12];
      } else {
        rawValue = (data[9] << 8) | data[10];
      }

      let value;
      switch (dataType) {
        case 'bool':
          value = rawValue !== 0;
          break;
        case 'int16':
          value = rawValue > 32767 ? rawValue - 65536 : rawValue;
          break;
        case 'int32':
          value = rawValue > 2147483647 ? rawValue - 4294967296 : rawValue;
          break;
        case 'float32':
          const buf = Buffer.alloc(4);
          buf.writeUInt32BE(rawValue, 0);
          value = buf.readFloatBE(0);
          break;
        case 'uint16':
        case 'uint32':
        default:
          value = rawValue;
      }

      resolve(value);
    });

    socket.on('error', (err) => {
      if (responseHandled) return;
      responseHandled = true;
      clearTimeout(connectTimeout);
      socket.destroy();
      reject(err);
    });

    socket.on('timeout', () => {
      if (responseHandled) return;
      responseHandled = true;
      socket.destroy();
      reject(new Error('Socket timeout'));
    });

    socket.setTimeout(timeout);
    socket.connect(port, host);
  });
}

const modbusWriteQueues = new Map();

function getModbusWriteQueue(key) {
  if (!modbusWriteQueues.has(key)) {
    modbusWriteQueues.set(key, { running: false, tasks: [] });
  }
  return modbusWriteQueues.get(key);
}

function enqueueModbusWrite(key, fn) {
  const q = getModbusWriteQueue(key);
  return new Promise((resolve, reject) => {
    q.tasks.push({ fn, resolve, reject });
    if (!q.running) drainModbusWriteQueue(key);
  });
}

async function drainModbusWriteQueue(key) {
  const q = getModbusWriteQueue(key);
  if (q.running || q.tasks.length === 0) return;
  q.running = true;
  while (q.tasks.length > 0) {
    const { fn, resolve, reject } = q.tasks.shift();
    try {
      const result = await fn();
      resolve(result);
    } catch (err) {
      reject(err);
    }
  }
  q.running = false;
}

function modbusWriteRegister(host, port, unitId, address, value, registerType, dataType, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let connected = false;
    let responseHandled = false;

    const connectTimeout = setTimeout(() => {
      if (!connected && !responseHandled) {
        responseHandled = true;
        socket.destroy();
        reject(new Error('Connection timeout'));
      }
    }, timeout);

    socket.on('connect', () => {
      connected = true;
      clearTimeout(connectTimeout);

      let functionCode;
      if (registerType === 'coil') {
        functionCode = 0x05;
      } else {
        functionCode = 0x06;
      }

      const transactionId = Buffer.from([0x00, Math.floor(Math.random() * 255)]);
      const protocolId = Buffer.from([0x00, 0x00]);
      const length = Buffer.from([0x00, 0x06]);
      const unitIdBuf = Buffer.from([unitId]);
      const fc = Buffer.from([functionCode]);
      const registerAddress = Buffer.from([(address >> 8) & 0xff, address & 0xff]);

      let valueBuffer;
      if (registerType === 'coil') {
        valueBuffer = value ? Buffer.from([0xff, 0x00]) : Buffer.from([0x00, 0x00]);
      } else {
        const numVal = parseInt(value) || 0;
        valueBuffer = Buffer.from([(numVal >> 8) & 0xff, numVal & 0xff]);
      }

      const request = Buffer.concat([transactionId, protocolId, length, unitIdBuf, fc, registerAddress, valueBuffer]);
      socket.write(request);
    });

    socket.on('data', (data) => {
      if (responseHandled) return;
      responseHandled = true;
      socket.destroy();

      if (data.length < 12) {
        reject(new Error('Response too short'));
        return;
      }

      const responseFc = data[7];
      if (responseFc > 0x80) {
        const errorCode = data[8];
        reject(new Error(`Modbus error: ${errorCode}`));
        return;
      }

      resolve(true);
    });

    socket.on('error', (err) => {
      if (responseHandled) return;
      responseHandled = true;
      clearTimeout(connectTimeout);
      socket.destroy();
      reject(err);
    });

    socket.on('timeout', () => {
      if (responseHandled) return;
      responseHandled = true;
      socket.destroy();
      reject(new Error('Socket timeout'));
    });

    socket.setTimeout(timeout);
    socket.connect(port, host);
  });
}

async function modbusWriteBit(host, port, unitId, address, bitIndex, bitValue, registerType, timeout = 3000) {
  const currentValue = await modbusReadRegister(host, port, unitId, address, registerType, 'uint16', timeout);

  let newValue;
  if (bitValue) {
    newValue = currentValue | (1 << bitIndex);
  } else {
    newValue = currentValue & ~(1 << bitIndex);
  }

  console.log(`Modbus WriteBit: address=${address}, bit=${bitIndex}, currentValue=${currentValue}, bitValue=${bitValue}, newValue=${newValue}`);

  return modbusWriteRegister(host, port, unitId, address, newValue, registerType, 'uint16', timeout);
}

app.post(['/modbus/ping', '/api/modbus/ping'], async (req, res) => {
  const { host, port, unitId, timeout = 3000 } = req.body;

  if (!host) {
    return res.status(400).json({ success: false, error: 'Host fehlt' });
  }

  const socket = new net.Socket();
  let connected = false;
  let responseHandled = false;

  const connectTimeout = setTimeout(() => {
    if (!connected && !responseHandled) {
      responseHandled = true;
      socket.destroy();
      res.json({ success: false, error: 'Timeout' });
    }
  }, timeout);

  socket.on('connect', () => {
    connected = true;
    clearTimeout(connectTimeout);

    const transactionId = Buffer.from([0x00, 0x01]);
    const protocolId = Buffer.from([0x00, 0x00]);
    const length = Buffer.from([0x00, 0x06]);
    const unitIdBuf = Buffer.from([unitId || 1]);
    const functionCode = Buffer.from([0x03]);
    const startAddress = Buffer.from([0x00, 0x00]);
    const quantity = Buffer.from([0x00, 0x01]);

    const request = Buffer.concat([
      transactionId,
      protocolId,
      length,
      unitIdBuf,
      functionCode,
      startAddress,
      quantity
    ]);

    socket.write(request);
  });

  socket.on('data', (data) => {
    if (responseHandled) return;
    responseHandled = true;
    clearTimeout(connectTimeout);
    socket.destroy();
    const responseFc = data.length > 7 ? data[7] : 0;
    if (data.length >= 9 && responseFc < 0x80) {
      res.json({ success: true, responseLength: data.length });
    } else if (responseFc >= 0x80) {
      res.json({ success: false, error: `Modbus Fehler Code: ${data[8] || 'unbekannt'}` });
    } else {
      res.json({ success: false, error: 'Ungueltige Antwort' });
    }
  });

  socket.on('error', (err) => {
    if (responseHandled) return;
    responseHandled = true;
    clearTimeout(connectTimeout);
    socket.destroy();
    res.json({ success: false, error: err.message });
  });

  socket.on('timeout', () => {
    if (responseHandled) return;
    responseHandled = true;
    clearTimeout(connectTimeout);
    socket.destroy();
    res.json({ success: false, error: 'Socket timeout' });
  });

  socket.setTimeout(timeout);
  socket.connect(port || 502, host);
});

app.post(['/modbus/read', '/api/modbus/read'], async (req, res) => {
  const { host, port = 502, unitId = 1, address, registerType = 'holding', count = 1, timeout = 3000 } = req.body;

  if (!host || address === undefined) {
    return res.status(400).json({ success: false, error: 'Host oder Adresse fehlt' });
  }

  const socket = new net.Socket();
  let connected = false;

  const connectTimeout = setTimeout(() => {
    if (!connected) {
      socket.destroy();
      res.json({ success: false, error: 'Timeout' });
    }
  }, timeout);

  socket.on('connect', () => {
    connected = true;
    clearTimeout(connectTimeout);

    let functionCode;
    switch (registerType) {
      case 'coil': functionCode = 0x01; break;
      case 'discrete': functionCode = 0x02; break;
      case 'input': functionCode = 0x04; break;
      case 'holding':
      default: functionCode = 0x03; break;
    }

    const transactionId = Buffer.from([0x00, Math.floor(Math.random() * 255)]);
    const protocolId = Buffer.from([0x00, 0x00]);
    const length = Buffer.from([0x00, 0x06]);
    const unitIdBuf = Buffer.from([unitId]);
    const fc = Buffer.from([functionCode]);
    const startAddress = Buffer.from([(address >> 8) & 0xff, address & 0xff]);
    const quantity = Buffer.from([(count >> 8) & 0xff, count & 0xff]);

    const request = Buffer.concat([transactionId, protocolId, length, unitIdBuf, fc, startAddress, quantity]);
    socket.write(request);
  });

  socket.on('data', (data) => {
    socket.destroy();

    if (data.length < 9) {
      return res.json({ success: false, error: 'Antwort zu kurz' });
    }

    const responseUnitId = data[6];
    const responseFc = data[7];

    if (responseFc > 0x80) {
      const errorCode = data[8];
      return res.json({ success: false, error: `Modbus Fehler: ${errorCode}` });
    }

    const byteCount = data[8];
    const values = [];

    for (let i = 0; i < count; i++) {
      const offset = 9 + i * 2;
      if (offset + 1 < data.length) {
        const value = (data[offset] << 8) | data[offset + 1];
        values.push(value);
      }
    }

    res.json({ success: true, values });
  });

  socket.on('error', (err) => {
    clearTimeout(connectTimeout);
    socket.destroy();
    res.json({ success: false, error: err.message });
  });

  socket.setTimeout(timeout);
  socket.connect(port, host);
});

app.post(['/modbus/read-config', '/api/modbus/read-config'], async (req, res) => {
  const { host, port = 502, unitId = 1, address, registerType = 'holding', dataType = 'uint16', scale = 1, timeout = 3000 } = req.body;

  if (!host || address === undefined) {
    return res.status(400).json({ success: false, error: 'Host oder Adresse fehlt' });
  }

  try {
    let value = await modbusReadRegister(host, port, unitId, address, registerType, dataType, timeout);
    if (scale && scale !== 1) {
      value = value * scale;
    }
    res.json({ success: true, value });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.post(['/modbus/write-config', '/api/modbus/write-config'], async (req, res) => {
  const { host, port = 502, unitId = 1, address, value, registerType = 'holding', dataType = 'uint16', scale = 1, timeout = 3000 } = req.body;

  if (!host || address === undefined || value === undefined) {
    return res.status(400).json({ success: false, error: 'Host, Adresse oder Wert fehlt' });
  }

  try {
    let writeValue = value;
    if (scale && scale !== 1) {
      writeValue = value / scale;
    }
    await modbusWriteRegister(host, port, unitId, address, writeValue, registerType, dataType, timeout);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.post(['/modbus/write', '/api/modbus/write'], async (req, res) => {
  const { host, port = 502, unitId = 1, address, value, registerType = 'holding', timeout = 3000 } = req.body;

  if (!host || address === undefined || value === undefined) {
    return res.status(400).json({ success: false, error: 'Host, Adresse oder Wert fehlt' });
  }

  const socket = new net.Socket();
  let connected = false;

  const connectTimeout = setTimeout(() => {
    if (!connected) {
      socket.destroy();
      res.json({ success: false, error: 'Timeout' });
    }
  }, timeout);

  socket.on('connect', () => {
    connected = true;
    clearTimeout(connectTimeout);

    let functionCode;
    if (registerType === 'coil') {
      functionCode = 0x05;
    } else {
      functionCode = 0x06;
    }

    const transactionId = Buffer.from([0x00, Math.floor(Math.random() * 255)]);
    const protocolId = Buffer.from([0x00, 0x00]);
    const length = Buffer.from([0x00, 0x06]);
    const unitIdBuf = Buffer.from([unitId]);
    const fc = Buffer.from([functionCode]);
    const registerAddress = Buffer.from([(address >> 8) & 0xff, address & 0xff]);

    let valueBuffer;
    if (registerType === 'coil') {
      valueBuffer = value ? Buffer.from([0xff, 0x00]) : Buffer.from([0x00, 0x00]);
    } else {
      valueBuffer = Buffer.from([(value >> 8) & 0xff, value & 0xff]);
    }

    const request = Buffer.concat([transactionId, protocolId, length, unitIdBuf, fc, registerAddress, valueBuffer]);
    socket.write(request);
  });

  socket.on('data', (data) => {
    socket.destroy();

    if (data.length < 12) {
      return res.json({ success: false, error: 'Antwort zu kurz' });
    }

    const responseFc = data[7];
    if (responseFc > 0x80) {
      const errorCode = data[8];
      return res.json({ success: false, error: `Modbus Fehler: ${errorCode}` });
    }

    res.json({ success: true });
  });

  socket.on('error', (err) => {
    clearTimeout(connectTimeout);
    socket.destroy();
    res.json({ success: false, error: err.message });
  });

  socket.setTimeout(timeout);
  socket.connect(port, host);
});

async function restoreRunningPages() {
  try {
    const data = await fs.readFile(pagesFile, 'utf-8');
    const pages = JSON.parse(data);

    let restoredCount = 0;
    for (const page of pages) {
      if (page.running) {
        startPage(page.id, page.cycleMs || 250);
        restoredCount++;
      }
    }

    if (restoredCount > 0) {
      console.log(`${restoredCount} Seite(n) nach Neustart wiederhergestellt`);
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      startPage('page-1', 250);
      console.log('Neue Installation: Seite 1 automatisch gestartet');
    } else {
      console.error('Fehler beim Wiederherstellen:', err.message);
    }
  }
}

let imagesDir = '/data/wiresheet/images';

app.post('/api/images/upload', async (req, res) => {
  try {
    await fs.mkdir(imagesDir, { recursive: true });
    const contentType = req.headers['content-type'] || '';

    const mimeExtMap = {
      'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
      'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg',
      'image/bmp': 'bmp', 'image/tiff': 'tif', 'image/x-icon': 'ico',
      'image/ico': 'ico'
    };

    if (contentType.includes('multipart/form-data')) {
      const boundary = contentType.split('boundary=')[1]?.trim();
      if (!boundary) return res.status(400).json({ error: 'Kein boundary' });

      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', async () => {
        try {
          const buf = Buffer.concat(chunks);
          const boundaryBuf = Buffer.from('--' + boundary);
          const parts = [];
          let start = 0;
          while (start < buf.length) {
            const bIdx = buf.indexOf(boundaryBuf, start);
            if (bIdx === -1) break;
            const after = bIdx + boundaryBuf.length;
            if (buf[after] === 45 && buf[after + 1] === 45) break;
            const headerEnd = buf.indexOf('\r\n\r\n', after);
            if (headerEnd === -1) break;
            const headerStr = buf.slice(after + 2, headerEnd).toString();
            const endBoundary = buf.indexOf(boundaryBuf, headerEnd + 4);
            const dataEnd = endBoundary === -1 ? buf.length : endBoundary - 2;
            const data = buf.slice(headerEnd + 4, dataEnd);
            parts.push({ headers: headerStr, data });
            start = endBoundary === -1 ? buf.length : endBoundary;
          }

          if (parts.length === 0) return res.status(400).json({ error: 'Keine Datei gefunden' });
          const part = parts[0];
          const ctMatch = part.headers.match(/Content-Type:\s*([^\r\n]+)/i);
          const mime = ctMatch ? ctMatch[1].trim() : 'image/png';
          const ext = mimeExtMap[mime] || 'png';

          const nameMatch = part.headers.match(/filename="([^"]+)"/i);
          const origExt = nameMatch ? path.extname(nameMatch[1]).slice(1).toLowerCase() : null;
          const finalExt = origExt && ['png','jpg','jpeg','gif','webp','svg','bmp','tif','tiff','ico'].includes(origExt) ? origExt : ext;

          const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${finalExt}`;
          const filePath = path.join(imagesDir, filename);
          await fs.writeFile(filePath, part.data);
          res.json({ url: `/api/images/${filename}`, filename, size: part.data.length });
        } catch (err) {
          console.error('Multipart Upload Fehler:', err);
          res.status(500).json({ error: 'Upload fehlgeschlagen' });
        }
      });
      req.on('error', () => res.status(500).json({ error: 'Upload fehlgeschlagen' }));
    } else {
      const mimeType = contentType.split(';')[0].trim();
      const ext = mimeExtMap[mimeType] || 'png';
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', async () => {
        try {
          const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const filePath = path.join(imagesDir, filename);
          await fs.writeFile(filePath, Buffer.concat(chunks));
          res.json({ url: `/api/images/${filename}`, filename });
        } catch (err) {
          console.error('Raw Upload Fehler:', err);
          res.status(500).json({ error: 'Upload fehlgeschlagen' });
        }
      });
      req.on('error', () => res.status(500).json({ error: 'Upload fehlgeschlagen' }));
    }
  } catch (err) {
    console.error('Bild Upload Fehler:', err);
    res.status(500).json({ error: 'Upload fehlgeschlagen' });
  }
});

app.get('/api/images', async (req, res) => {
  try {
    await fs.mkdir(imagesDir, { recursive: true });
    const files = await fs.readdir(imagesDir);
    const imageExts = ['png','jpg','jpeg','gif','webp','svg','bmp','tif','tiff','ico'];
    const imageFiles = files.filter(f => imageExts.includes(path.extname(f).slice(1).toLowerCase()));
    const items = await Promise.all(imageFiles.map(async (filename) => {
      try {
        const stat = await fs.stat(path.join(imagesDir, filename));
        return { filename, url: `/api/images/${filename}`, size: stat.size, mtime: stat.mtime };
      } catch {
        return { filename, url: `/api/images/${filename}`, size: 0, mtime: null };
      }
    }));
    items.sort((a, b) => new Date(b.mtime || 0).getTime() - new Date(a.mtime || 0).getTime());
    res.json(items);
  } catch (err) {
    console.error('Bilder Liste Fehler:', err);
    res.status(500).json({ error: 'Liste fehlgeschlagen' });
  }
});

app.get('/api/images/:filename', async (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(imagesDir, filename);
    const data = await fs.readFile(filePath);
    const ext = path.extname(filename).slice(1).toLowerCase();
    const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };
    res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.send(data);
  } catch (err) {
    res.status(404).json({ error: 'Bild nicht gefunden' });
  }
});

app.delete('/api/images/:filename', async (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(imagesDir, filename);
    await fs.unlink(filePath);
    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});

visuApp.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

visuApp.use(express.json({ limit: '10mb' }));

const distDir = path.join(__dirname, '../dist');

async function proxyToApi(req, res, apiPath) {
  if (apiPath === '/sse' || apiPath.endsWith('/sse')) {
    return setupSSEClient(req, res);
  }
  try {
    const apiUrl = `http://localhost:${PORT}${apiPath}`;
    const response = await axios({
      method: req.method,
      url: apiUrl,
      data: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json'
      },
      timeout: 30000,
      responseType: 'arraybuffer'
    });
    const contentType = response.headers['content-type'] || '';
    res.status(response.status);
    res.set('Content-Type', contentType);
    res.send(Buffer.from(response.data));
  } catch (err) {
    if (err.response) {
      const ct = err.response.headers['content-type'] || '';
      res.status(err.response.status);
      res.set('Content-Type', ct);
      res.send(Buffer.from(err.response.data));
    } else {
      res.status(503).json({ error: err.message });
    }
  }
}

visuApp.use((req, res, next) => {
  const ingressMatch = req.path.match(/^\/api\/hassio_ingress\/[^/]+(\/api\/.*)$/);
  if (ingressMatch) {
    return proxyToApi(req, res, ingressMatch[1]);
  }
  const appMatch = req.path.match(/^\/app\/[^/]+(\/api\/.*)$/);
  if (appMatch) {
    return proxyToApi(req, res, appMatch[1]);
  }
  next();
});

visuApp.use('/api', async (req, res) => {
  const apiPath = req.path;
  if (apiPath === '/sse' || apiPath.endsWith('/sse')) {
    return setupSSEClient(req, res);
  }
  await proxyToApi(req, res, req.originalUrl);
});

visuApp.use('/assets', express.static(path.join(distDir, 'assets'), {
  maxAge: '1y',
  immutable: true
}));

visuApp.get('/', (req, res) => {
  const visuHtmlPath = path.join(distDir, 'visu.html');
  if (fsSync.existsSync(visuHtmlPath)) {
    res.sendFile(visuHtmlPath);
  } else {
    res.status(404).send('Visu nicht gefunden. Bitte erst bauen mit npm run build');
  }
});

visuApp.get('*', (req, res) => {
  const visuHtmlPath = path.join(distDir, 'visu.html');
  if (fsSync.existsSync(visuHtmlPath)) {
    res.sendFile(visuHtmlPath);
  } else {
    res.status(404).send('Visu nicht gefunden');
  }
});

async function start() {
  try {
    dataDir = await findWritableDataDir();
    pagesFile = path.join(dataDir, 'pages.json');
    blocksFile = path.join(dataDir, 'custom-blocks.json');
    visuPagesFile = path.join(dataDir, 'visu-pages.json');
    dpValuesFile = path.join(dataDir, 'dp-values.json');
    driverConfigFile = path.join(dataDir, 'driver-config.json');
    alarmConfigFile = path.join(dataDir, 'alarm-config.json');
    trendConfigFile = path.join(dataDir, 'trend-config.json');
    trendDataDir = path.join(dataDir, 'trends');
    imagesDir = path.join(dataDir, 'images');
    buildingConfigFile = path.join(dataDir, 'building-config.json');
    console.log(`=== WIRESHEET SERVER START ===`);
    console.log(`Data-Verzeichnis: ${dataDir}`);
    console.log(`Pages-Datei: ${pagesFile}`);

    await fs.mkdir(trendDataDir, { recursive: true });
    await loadPersistentDpValues();
    await loadDriverConfig();
    await loadTrendConfig();
    startTrendFlush();

    console.log(`--- Umgebungsvariablen ---`);
    console.log(`SUPERVISOR_TOKEN: ${process.env.SUPERVISOR_TOKEN ? 'ja (' + process.env.SUPERVISOR_TOKEN.substring(0,10) + '...)' : 'NEIN'}`);
    console.log(`HASSIO_TOKEN: ${process.env.HASSIO_TOKEN ? 'ja' : 'nein'}`);

    const allEnvKeys = Object.keys(process.env).filter(k =>
      k.includes('SUPER') || k.includes('HASSIO') || k.includes('HA_') || k.includes('HOME')
    );
    console.log(`Relevante Env-Vars: ${allEnvKeys.join(', ') || 'keine'}`);

    const token = getToken();
    console.log(`Token gefunden: ${token ? 'JA' : 'NEIN'}`);

    if (token) {
      try {
        const testRes = await axios.get('http://supervisor/core/api/config', {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 5000
        });
        console.log(`HA Verbindung OK - Version: ${testRes.data?.version || 'unbekannt'}`);
      } catch (err) {
        console.error(`HA Verbindungstest fehlgeschlagen: ${err.message}`);
      }
    } else {
      console.log(`WARNUNG: Ohne Token kann nicht auf Home Assistant zugegriffen werden!`);
      console.log(`Stelle sicher dass config.json "homeassistant_api": true hat`);
    }

    app.listen(PORT, async () => {
      console.log(`=== Wiresheet API Server laeuft auf Port ${PORT} ===`);
      await restoreRunningPages();
    });

    visuApp.listen(VISU_PORT, () => {
      console.log(`=== Wiresheet Visu Server laeuft auf Port ${VISU_PORT} ===`);
    });
  } catch (err) {
    console.error('Start fehlgeschlagen:', err);
    process.exit(1);
  }
}

start().catch(console.error);
