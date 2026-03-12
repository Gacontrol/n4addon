const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const axios = require('axios');
const { spawn } = require('child_process');

const app = express();
const visuApp = express();
const PORT = 8100;
const VISU_PORT = 8098;

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

const runningPages = new Map();
const pageNodeStates = new Map();
const lastNodeValues = new Map();
const clientVisuOverrides = new Map();
const persistentDpValues = new Map();
const visuControlledDps = new Map();
let dpValuesSaveTimeout = null;

async function loadPersistentDpValues() {
  try {
    const data = await fs.readFile(dpValuesFile, 'utf-8');
    const obj = JSON.parse(data);
    persistentDpValues.clear();
    for (const [key, value] of Object.entries(obj)) {
      persistentDpValues.set(key, value);
    }
    console.log(`Persistente DP-Werte geladen: ${persistentDpValues.size} Eintraege`);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Fehler beim Laden der DP-Werte:', err.message);
    }
  }
}

function savePersistentDpValues() {
  if (dpValuesSaveTimeout) {
    clearTimeout(dpValuesSaveTimeout);
  }
  dpValuesSaveTimeout = setTimeout(async () => {
    try {
      const obj = Object.fromEntries(persistentDpValues);
      await fs.writeFile(dpValuesFile, JSON.stringify(obj, null, 2));
      console.log(`Persistente DP-Werte gespeichert: ${persistentDpValues.size} Eintraege`);
    } catch (err) {
      console.error('Fehler beim Speichern der DP-Werte:', err.message);
    }
    dpValuesSaveTimeout = null;
  }, 500);
}

function setPersistentDpValue(nodeId, value) {
  persistentDpValues.set(nodeId, value);
  savePersistentDpValues();
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
    case 'scaling':
    case 'smoothing':
    case 'pid-controller':
    case 'counter':
    case 'const-value':
    case 'timer':
      return 0;
    case 'dp-enum':
      return 0;
    case 'threshold':
      return 'below';
    case 'delay':
    case 'select':
    case 'sr-flipflop':
    case 'python-script':
    case 'ha-input':
    case 'ha-output':
    case 'modbus-device-input':
    case 'modbus-device-output':
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
    case 'pid-controller':
      defaults['output-0'] = 0;
      break;
    case 'threshold':
      defaults['output-0'] = 'below';
      defaults['output-1'] = null;
      break;
    case 'timer':
      defaults['output-0'] = false;
      break;
    case 'counter':
      defaults['output-0'] = 0;
      break;
    case 'sr-flipflop':
      defaults['output-0'] = false;
      break;
    case 'rising-edge':
    case 'falling-edge':
      defaults['output-0'] = false;
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

async function executePageLogic(nodes, connections, manualOverrides = {}, visuOverrides = {}, pageId = null) {
  console.log(`[EXEC DEBUG] executePageLogic gestartet fuer pageId=${pageId}`);
  console.log(`[EXEC DEBUG] visuOverrides empfangen:`, JSON.stringify(visuOverrides));
  console.log(`[EXEC DEBUG] visuControlledDps aktuell:`, JSON.stringify([...visuControlledDps.entries()]));
  const nodeValues = {};

  const modbusDriverNode = nodes.find(n => n.type === 'modbus-driver');
  const modbusDevices = modbusDriverNode?.data?.config?.modbusDevices || [];
  const modbusDeviceMap = new Map();
  for (const device of modbusDevices) {
    modbusDeviceMap.set(device.id, device);
  }

  const statePromises = nodes
    .filter(n => (n.type === 'ha-input') && n.data.entityId)
    .map(async (n) => {
      try {
        const state = await haGet(`/states/${n.data.entityId}`);
        const rawState = state.state;
        const numVal = parseFloat(rawState);
        if (!isNaN(numVal)) {
          nodeValues[n.id] = numVal;
        } else {
          nodeValues[n.id] = rawState;
        }
      } catch {
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

  await Promise.all([...statePromises, ...modbusInputPromises]);

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
      const sourceNode = nodes.find(n => n.id === conn.source);
      if (sourceNode && (sourceNode.type === 'python-script' || sourceNode.type === 'modbus-device-input')) {
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
      if (visuOverrides[portKey] !== undefined) {
        return visuOverrides[portKey];
      }
      const conn = incomingConns.find(c => c.targetPort === inputPort.id || c.targetPort === `input-${idx}`);
      if (conn) {
        return getInputValue(conn);
      }
      return undefined;
    });

    const cfg = node.data.config || {};

    if (manualOverrides[nodeId] !== undefined) {
      nodeValues[nodeId] = manualOverrides[nodeId];
    } else if (node.type === 'ha-input') {
    } else if (node.type === 'dp-boolean' || node.type === 'dp-numeric' || node.type === 'dp-enum') {
      const visuKey = node.data.inputs?.[0]?.id ? `${nodeId}:${node.data.inputs[0].id}` : nodeId;
      const visuVal = visuOverrides[visuKey] !== undefined ? visuOverrides[visuKey] : visuOverrides[nodeId];
      const visuControlledVal = visuControlledDps.get(nodeId);

      console.log(`[DP-EVAL DEBUG] Node: ${nodeId} (${node.type})`);
      console.log(`[DP-EVAL DEBUG]   visuKey=${visuKey}`);
      console.log(`[DP-EVAL DEBUG]   visuOverrides[visuKey]=${visuOverrides[visuKey]}, visuOverrides[nodeId]=${visuOverrides[nodeId]}`);
      console.log(`[DP-EVAL DEBUG]   visuVal=${visuVal} (type: ${typeof visuVal})`);
      console.log(`[DP-EVAL DEBUG]   visuControlledVal=${visuControlledVal} (type: ${typeof visuControlledVal})`);
      console.log(`[DP-EVAL DEBUG]   inputVals[0]=${inputVals[0]}`);
      console.log(`[DP-EVAL DEBUG]   visuControlledDps size=${visuControlledDps.size}`);

      if (visuVal !== undefined) {
        console.log(`[DP-EVAL DEBUG]   -> NEUER VISU-WERT: ${visuVal}`);
        visuControlledDps.set(nodeId, visuVal);
        nodeValues[nodeId] = visuVal;
        setPersistentDpValue(nodeId, visuVal);
        delete visuOverrides[visuKey];
        delete visuOverrides[nodeId];
        for (const key of Object.keys(visuOverrides)) {
          if (key.startsWith(`${nodeId}:`)) {
            delete visuOverrides[key];
          }
        }
      } else if (visuControlledVal !== undefined) {
        console.log(`[DP-EVAL DEBUG]   -> VISU-KONTROLLE AKTIV: ${visuControlledVal}`);
        nodeValues[nodeId] = visuControlledVal;
      } else if (inputVals[0] !== undefined) {
        console.log(`[DP-EVAL DEBUG]   -> INPUT-WERT: ${inputVals[0]}`);
        nodeValues[nodeId] = inputVals[0];
        setPersistentDpValue(nodeId, inputVals[0]);
      } else {
        const persistentVal = persistentDpValues.get(nodeId);
        if (persistentVal !== undefined) {
          console.log(`[DP-EVAL DEBUG]   -> PERSISTENTER WERT: ${persistentVal}`);
          visuControlledDps.set(nodeId, persistentVal);
          nodeValues[nodeId] = persistentVal;
        } else {
          console.log(`[DP-EVAL DEBUG]   -> DEFAULT-WERT`);
          nodeValues[nodeId] = node.type === 'dp-boolean' ? false : 0;
        }
      }
      console.log(`[DP-EVAL DEBUG]   ERGEBNIS nodeValues[${nodeId}]=${nodeValues[nodeId]}`);
    } else if (visuOverrides[nodeId] !== undefined && inputVals.every(v => v === undefined)) {
      nodeValues[nodeId] = visuOverrides[nodeId];
      delete visuOverrides[nodeId];
    } else if (node.type === 'and-gate') {
      if (inputVals.length === 0) {
        nodeValues[nodeId] = false;
      } else {
        nodeValues[nodeId] = inputVals.every(v => toBool(v));
      }
    } else if (node.type === 'or-gate') {
      nodeValues[nodeId] = inputVals.some(v => toBool(v));
    } else if (node.type === 'xor-gate') {
      const trueCount = inputVals.filter(v => toBool(v)).length;
      nodeValues[nodeId] = trueCount % 2 === 1;
    } else if (node.type === 'not-gate') {
      nodeValues[nodeId] = !toBool(inputVals[0]);
    } else if (node.type === 'switch') {
      const val = inputVals[0];
      const sw = toBool(inputVals[1]);
      nodeValues[nodeId] = sw ? val : null;
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
      const validVals = inputVals.filter(v => v !== null && v !== undefined).map(v => toNumber(v));
      nodeValues[nodeId] = validVals.length > 0 ? validVals.reduce((a, b) => a + b, 0) / validVals.length : 0;
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
      nodeValues[nodeId] = val > thr ? 'above' : 'below';
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
    } else if (node.type === 'pid-controller') {
      const actual = toNumber(inputVals[0]);
      const setpoint = toNumber(inputVals[1]);
      const enableRaw = inputVals[2];
      const enabled = enableRaw === null || enableRaw === undefined ? true : toBool(enableRaw);
      const kp = cfg.kp !== undefined ? parseFloat(cfg.kp) : 1.0;
      const ki = cfg.ki !== undefined ? parseFloat(cfg.ki) : 0.1;
      const kd = cfg.kd !== undefined ? parseFloat(cfg.kd) : 0.05;
      const outMin = cfg.outputMin !== undefined ? parseFloat(cfg.outputMin) : 0;
      const outMax = cfg.outputMax !== undefined ? parseFloat(cfg.outputMax) : 100;
      const antiWindup = cfg.antiWindup !== false;
      const sampleTimeMs = cfg.sampleTimeMs !== undefined ? cfg.sampleTimeMs : 100;
      const now = Date.now();
      const st = pageId ? getNodeState(pageId, nodeId) : node.__pidState || (node.__pidState = {});
      if (st.integral === undefined) st.integral = 0;
      if (st.prevError === undefined) st.prevError = 0;
      if (st.lastTs === undefined) st.lastTs = now;
      let output = null;
      let error = null;
      if (enabled && !isNaN(actual) && !isNaN(setpoint)) {
        error = setpoint - actual;
        const dtMs = now - st.lastTs;
        const dt = Math.max(dtMs, sampleTimeMs) / 1000.0;
        st.integral += error * dt;
        const derivative = (error - st.prevError) / dt;
        let rawOutput = kp * error + ki * st.integral + kd * derivative;
        if (antiWindup) {
          if (rawOutput > outMax) {
            rawOutput = outMax;
            if (error > 0) st.integral -= error * dt;
          } else if (rawOutput < outMin) {
            rawOutput = outMin;
            if (error < 0) st.integral -= error * dt;
          }
        }
        output = Math.max(outMin, Math.min(outMax, rawOutput));
        st.prevError = error;
        st.lastTs = now;
      } else if (!enabled) {
        st.integral = 0;
        st.prevError = 0;
        st.lastTs = now;
        output = outMin;
        error = 0;
      }
      nodeValues[nodeId] = output;
      nodeValues[`${nodeId}:output-0`] = output;
      nodeValues[`${nodeId}:output-1`] = error;
    } else if (node.type === 'pump-control') {
      const startCmd = toBool(inputVals[0]);
      const pumpFeedback = toBool(inputVals[1]);
      const faultInput = toBool(inputVals[2]);
      const revisionSwitch = toBool(inputVals[3]);
      const hoaModeInput = inputVals[4];
      const handStartInput = inputVals[5];
      const speedSetpoint = toNumber(inputVals[6]);
      const resetInputWire = toBool(inputVals[7]);

      const visuHOA = cfg.pumpVisuHOA;
      const visuHandStart = cfg.pumpVisuHandStart;
      const visuReset = cfg.pumpVisuReset;

      const hoaMode = visuHOA !== undefined ? toNumber(visuHOA) : (hoaModeInput !== null && hoaModeInput !== undefined ? toNumber(hoaModeInput) : 2);
      const handStart = visuHandStart !== undefined ? toBool(visuHandStart) : toBool(handStartInput);
      const resetInput = visuReset === true ? true : resetInputWire;

      const startDelayMs = cfg.pumpStartDelayMs || 0;
      const stopDelayMs = cfg.pumpStopDelayMs || 0;
      const feedbackTimeoutMs = cfg.pumpFeedbackTimeoutMs || 10000;
      const enableFeedback = cfg.pumpEnableFeedback !== false;
      const speedMin = cfg.pumpSpeedMin || 0;
      const speedMax = cfg.pumpSpeedMax || 100;
      const antiSeizeIntervalMs = cfg.pumpAntiSeizeIntervalMs || 604800000;
      const antiSeizeRunMs = cfg.pumpAntiSeizeRunMs || 60000;
      const antiSeizeSpeed = cfg.pumpAntiSeizeSpeed || 30;

      const now = Date.now();
      const st = pageId ? getNodeState(pageId, nodeId) : node.__pumpState || (node.__pumpState = {});

      if (st.operatingHoursMs === undefined) st.operatingHoursMs = (cfg.pumpOperatingHours || 0) * 3600000;
      if (st.startCount === undefined) st.startCount = cfg.pumpStartCount || 0;
      if (st.pumpCmd === undefined) st.pumpCmd = false;
      if (st.fault === undefined) st.fault = false;
      if (st.faultLatch === undefined) st.faultLatch = false;
      if (st.feedbackFault === undefined) st.feedbackFault = false;
      if (st.lastRunTs === undefined) st.lastRunTs = now;
      if (st.antiSeizeActive === undefined) st.antiSeizeActive = false;
      if (st.antiSeizeStartTs === undefined) st.antiSeizeStartTs = null;
      if (st.startDelayTs === undefined) st.startDelayTs = null;
      if (st.stopDelayTs === undefined) st.stopDelayTs = null;
      if (st.startTs === undefined) st.startTs = null;
      if (st.prevPumpCmd === undefined) st.prevPumpCmd = false;
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

      if (targetCmd && !st.pumpCmd) {
        if (startDelayMs > 0) {
          if (st.startDelayTs === null) st.startDelayTs = now;
          if (now - st.startDelayTs >= startDelayMs) {
            st.pumpCmd = true;
            st.startDelayTs = null;
          }
        } else {
          st.pumpCmd = true;
        }
      } else if (!targetCmd && st.pumpCmd) {
        if (stopDelayMs > 0) {
          if (st.stopDelayTs === null) st.stopDelayTs = now;
          if (now - st.stopDelayTs >= stopDelayMs) {
            st.pumpCmd = false;
            st.stopDelayTs = null;
          }
        } else {
          st.pumpCmd = false;
        }
      } else {
        st.startDelayTs = null;
        st.stopDelayTs = null;
      }

      if (st.pumpCmd && !st.prevPumpCmd) {
        st.startCount++;
        st.startTs = now;
      }
      st.prevPumpCmd = st.pumpCmd;

      if (enableFeedback && st.pumpCmd && st.startTs !== null) {
        if (!pumpFeedback && (now - st.startTs > feedbackTimeoutMs)) {
          st.feedbackFault = true;
        }
      }

      const running = pumpFeedback;
      if (running) {
        const deltaMs = now - st.lastTickTs;
        st.operatingHoursMs += deltaMs;
        st.lastRunTs = now;
      }
      st.lastTickTs = now;

      let speedOutput = 0;
      if (st.pumpCmd) {
        let sp = st.antiSeizeActive ? antiSeizeSpeed : speedSetpoint;
        sp = Math.max(speedMin, Math.min(speedMax, sp || 0));
        speedOutput = sp;
      }

      const alarm = hasFault;
      const operatingHours = st.operatingHoursMs / 3600000;

      nodeValues[nodeId] = st.pumpCmd;
      nodeValues[`${nodeId}:output-0`] = st.pumpCmd;
      nodeValues[`${nodeId}:output-1`] = speedOutput;
      nodeValues[`${nodeId}:output-2`] = running;
      nodeValues[`${nodeId}:output-3`] = hasFault;
      nodeValues[`${nodeId}:output-4`] = ready;
      nodeValues[`${nodeId}:output-5`] = alarm;
      nodeValues[`${nodeId}:output-6`] = operatingHours;
      nodeValues[`${nodeId}:output-7`] = st.startCount;
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
          const boolVal = toBool(val);
          try {
            if (domain === 'light') {
              await haPost(`/services/light/${boolVal ? 'turn_on' : 'turn_off'}`, { entity_id: entityId });
            } else if (domain === 'switch') {
              await haPost(`/services/switch/${boolVal ? 'turn_on' : 'turn_off'}`, { entity_id: entityId });
            } else if (domain === 'input_boolean') {
              await haPost(`/services/input_boolean/${boolVal ? 'turn_on' : 'turn_off'}`, { entity_id: entityId });
            } else if (domain === 'input_number') {
              const numVal = parseFloat(val);
              if (!isNaN(numVal)) {
                await haPost('/services/input_number/set_value', { entity_id: entityId, value: numVal });
              }
            }
            nodeValues[nodeId] = boolVal;
          } catch (e) {
            console.error(`HA Output Fehler fuer ${entityId}:`, e.message);
            nodeValues[nodeId] = null;
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

      if (allowWrite) {
        const deviceId = cfg.modbusDeviceId;
        const datapoints = cfg.modbusDatapoints || [];
        const device = modbusDeviceMap.get(deviceId);

        if (!device) {
          console.log(`Modbus Output ${nodeId}: Geraet ${deviceId} nicht gefunden`);
          nodeValues[nodeId] = null;
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

  return nodeValues;
}

app.post(['/pages/:pageId/execute', '/api/pages/:pageId/execute'], async (req, res) => {
  const { pageId } = req.params;
  const { nodes, connections, manualOverrides = {}, visuOverrides = {} } = req.body;
  try {
    const nodeValues = await executePageLogic(nodes, connections, manualOverrides, visuOverrides, pageId);
    res.json({ success: true, nodeValues });
  } catch (err) {
    console.error('Execute error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

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

      const allOverrides = { ...(clientVisuOverrides.get('global') || {}) };
      clientVisuOverrides.set('global', {});
      console.log(`[CYCLE DEBUG] Page ${pageId} - clientVisuOverrides.get('global'):`, JSON.stringify(allOverrides));
      console.log(`[CYCLE DEBUG] Page ${pageId} - visuControlledDps:`, JSON.stringify([...visuControlledDps.entries()]));
      const nodeValues = await executePageLogic(page.nodes, page.connections, manualOverrides, allOverrides, pageId);
      lastNodeValues.set(pageId, nodeValues);
      broadcastSSE('state', { liveValues: getLiveSnapshot() });
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
    cycleMs: Math.max(20, cycleMs || 1000),
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

    const actualCycleMs = cycleMs || page.cycleMs || 1000;
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

app.post(['/visu/write-value', '/api/visu/write-value'], async (req, res) => {
  const { nodeId, portId, paramKey, value, clientId } = req.body;
  if (!nodeId) {
    return res.status(400).json({ error: 'nodeId fehlt' });
  }

  if (value && typeof value === 'object' && value.pumpControl) {
    const pumpCtrl = value.pumpControl;
    try {
      const data = await fs.readFile(pagesFile, 'utf-8');
      const pages = JSON.parse(data);
      let updated = false;
      for (const page of pages) {
        const node = page.nodes.find(n => n.id === nodeId && n.type === 'pump-control');
        if (node) {
          if (!node.data.config) node.data.config = {};
          if (pumpCtrl.hoaMode !== undefined) {
            node.data.config.pumpVisuHOA = pumpCtrl.hoaMode;
          }
          if (pumpCtrl.handStart !== undefined) {
            node.data.config.pumpVisuHandStart = pumpCtrl.handStart;
          }
          if (pumpCtrl.reset !== undefined && pumpCtrl.reset === true) {
            node.data.config.pumpVisuReset = true;
          } else if (pumpCtrl.reset === false) {
            node.data.config.pumpVisuReset = false;
          }
          for (const key of Object.keys(pumpCtrl)) {
            if (key.startsWith('param_')) {
              const paramName = key.slice(6);
              node.data.config[paramName] = pumpCtrl[key];
            }
          }
          console.log(`Pump Control geschrieben: ${nodeId}`, JSON.stringify(pumpCtrl));
          updated = true;
          break;
        }
      }
      if (updated) {
        await fs.writeFile(pagesFile, JSON.stringify(pages, null, 2));
        const nodeConfigs = {};
        for (const page of pages) {
          for (const node of (page.nodes || [])) {
            if (node.data?.config) nodeConfigs[node.id] = node.data.config;
          }
        }
        broadcastSSE('state', { liveValues: getLiveSnapshot(), nodeConfigs });
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Pump-Control Node nicht gefunden' });
      }
    } catch (err) {
      console.error('Fehler beim Schreiben des Pump-Control Parameters:', err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  if (paramKey) {
    try {
      const data = await fs.readFile(pagesFile, 'utf-8');
      const pages = JSON.parse(data);
      let updated = false;
      for (const page of pages) {
        const node = page.nodes.find(n => n.id === nodeId);
        if (node) {
          if (!node.data.config) node.data.config = {};
          node.data.config[paramKey] = value;
          console.log(`Visu-Parameter geschrieben: ${nodeId}.${paramKey} = ${value}`);
          updated = true;
          break;
        }
      }
      if (updated) {
        await fs.writeFile(pagesFile, JSON.stringify(pages, null, 2));
        const nodeConfigs = {};
        for (const page of pages) {
          for (const node of (page.nodes || [])) {
            if (node.data?.config) nodeConfigs[node.id] = node.data.config;
          }
        }
        broadcastSSE('state', { liveValues: getLiveSnapshot(), nodeConfigs });
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Node nicht gefunden' });
      }
    } catch (err) {
      console.error('Fehler beim Schreiben des Visu-Parameters:', err);
      res.status(500).json({ error: err.message });
    }
  } else {
    const overrideKey = portId ? `${nodeId}:${portId}` : nodeId;

    console.log(`[WRITE-VALUE DEBUG] Empfangen: nodeId=${nodeId}, portId=${portId}, value=${value}, type=${typeof value}`);
    console.log(`[WRITE-VALUE DEBUG] overrideKey=${overrideKey}`);

    if (!clientVisuOverrides.has('global')) {
      clientVisuOverrides.set('global', {});
    }
    const overrides = clientVisuOverrides.get('global');

    console.log(`[WRITE-VALUE DEBUG] Overrides VORHER:`, JSON.stringify(overrides));

    for (const key of Object.keys(overrides)) {
      if (key === nodeId || key.startsWith(`${nodeId}:`)) {
        delete overrides[key];
      }
    }

    overrides[overrideKey] = value;
    overrides[nodeId] = value;

    console.log(`[WRITE-VALUE DEBUG] Overrides NACHHER:`, JSON.stringify(overrides));

    visuControlledDps.set(nodeId, value);
    console.log(`[WRITE-VALUE DEBUG] visuControlledDps gesetzt: ${nodeId} = ${value}`);
    console.log(`[WRITE-VALUE DEBUG] visuControlledDps Map:`, JSON.stringify([...visuControlledDps.entries()]));

    setPersistentDpValue(nodeId, value);

    for (const [pageId, nodeValues] of lastNodeValues) {
      if (nodeId in nodeValues) {
        const updated = { ...nodeValues, [nodeId]: value };
        if (overrideKey !== nodeId) updated[overrideKey] = value;
        lastNodeValues.set(pageId, updated);
      }
    }

    broadcastSSE('state', { liveValues: getLiveSnapshot() });
    res.json({ success: true });
  }
});

app.get(['/live-values', '/api/live-values'], (req, res) => {
  const merged = {};
  for (const [, values] of lastNodeValues) {
    Object.assign(merged, values);
  }
  res.json({ values: merged });
});

const sseClients = new Set();

function broadcastSSE(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(msg); } catch {}
  }
}

function getLiveSnapshot() {
  const merged = {};
  for (const [, values] of lastNodeValues) {
    Object.assign(merged, values);
  }
  return merged;
}

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

app.get(['/sse', '/api/sse'], (req, res) => {
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
  })();

  req.on('close', () => sseClients.delete(res));
});

visuApp.get(['/sse', '/api/sse'], (req, res) => {
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
  })();

  req.on('close', () => sseClients.delete(res));
});

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
        startPage(page.id, page.cycleMs || 1000);
        restoredCount++;
      }
    }

    if (restoredCount > 0) {
      console.log(`${restoredCount} Seite(n) nach Neustart wiederhergestellt`);
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
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
    imagesDir = path.join(dataDir, 'images');
    console.log(`=== WIRESHEET SERVER START ===`);
    console.log(`Data-Verzeichnis: ${dataDir}`);
    console.log(`Pages-Datei: ${pagesFile}`);

    await loadPersistentDpValues();

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
