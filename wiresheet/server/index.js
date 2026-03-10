const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const axios = require('axios');
const { spawn } = require('child_process');

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
let blocksFile = path.join(dataDir, 'custom-blocks.json');

const runningPages = new Map();
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

async function executePythonCode(code, inputs) {
  return new Promise((resolve, reject) => {
    const inputJson = JSON.stringify(inputs);

    const wrappedCode = `
import json
import sys

_inputs = json.loads('''${inputJson}''')

${Object.keys(inputs).map(k => `${k} = _inputs.get('${k}')`).join('\n')}

${code}

_outputs = {}
for name in dir():
    if name.startswith('out'):
        _outputs[name] = eval(name)

print(json.dumps(_outputs))
`;

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

async function executePageLogic(nodes, connections, manualOverrides = {}) {
  const nodeValues = {};

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
          console.log(`Node ${nodeId} uebersprungen - Case ${nodeCase} nicht aktiv (aktiv: ${activeCase})`);
          continue;
        }
      }
    }

    const incomingConns = connections.filter(c => c.target === nodeId);

    const getInputValue = (conn) => {
      const sourceNode = nodes.find(n => n.id === conn.source);
      if (sourceNode && sourceNode.type === 'python-script') {
        const portKey = `${conn.source}:${conn.sourcePort}`;
        if (nodeValues[portKey] !== undefined) {
          return nodeValues[portKey];
        }
      }
      return nodeValues[conn.source];
    };

    const nodeInputs = node.data.inputs || [];
    const inputVals = nodeInputs.map((inputPort, idx) => {
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
      nodeValues[nodeId] = inputVals[0] !== undefined ? inputVals[0] : null;
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
      nodeValues[nodeId] = (parseFloat(inputVals[0]) || 0) + (parseFloat(inputVals[1]) || 0);
    } else if (node.type === 'math-sub') {
      nodeValues[nodeId] = (parseFloat(inputVals[0]) || 0) - (parseFloat(inputVals[1]) || 0);
    } else if (node.type === 'math-mul') {
      nodeValues[nodeId] = (parseFloat(inputVals[0]) || 0) * (parseFloat(inputVals[1]) || 0);
    } else if (node.type === 'math-div') {
      const divisor = parseFloat(inputVals[1]) || 0;
      nodeValues[nodeId] = divisor !== 0 ? (parseFloat(inputVals[0]) || 0) / divisor : 0;
    } else if (node.type === 'math-min') {
      nodeValues[nodeId] = Math.min(parseFloat(inputVals[0]) || 0, parseFloat(inputVals[1]) || 0);
    } else if (node.type === 'math-max') {
      nodeValues[nodeId] = Math.max(parseFloat(inputVals[0]) || 0, parseFloat(inputVals[1]) || 0);
    } else if (node.type === 'math-avg') {
      const validVals = inputVals.filter(v => v !== null && v !== undefined).map(v => parseFloat(v) || 0);
      nodeValues[nodeId] = validVals.length > 0 ? validVals.reduce((a, b) => a + b, 0) / validVals.length : 0;
    } else if (node.type === 'math-abs') {
      nodeValues[nodeId] = Math.abs(parseFloat(inputVals[0]) || 0);
    } else if (node.type === 'const-value') {
      nodeValues[nodeId] = cfg.constValue !== undefined ? cfg.constValue : 0;
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
          const firstOutput = pythonOutputs.length > 0 ? outputs[pythonOutputs[0].id] : null;
          nodeValues[nodeId] = firstOutput;
          pythonOutputs.forEach((out, idx) => {
            nodeValues[`${nodeId}:output-${idx}`] = outputs[out.id];
          });
        } catch (e) {
          console.error(`Python Script Fehler (${nodeId}):`, e.message);
          nodeValues[nodeId] = null;
          pythonOutputs.forEach((out, idx) => {
            nodeValues[`${nodeId}:output-${idx}`] = null;
          });
        }
      } else {
        console.log(`Python Script ${nodeId}: Kein Code vorhanden, ueberspringe`);
        nodeValues[nodeId] = null;
      }
    } else if (node.type === 'ha-output' && node.data.entityId) {
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
  }

  return nodeValues;
}

app.post(['/pages/:pageId/execute', '/api/pages/:pageId/execute'], async (req, res) => {
  const { nodes, connections, manualOverrides = {} } = req.body;
  try {
    const nodeValues = await executePageLogic(nodes, connections, manualOverrides);
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
      await executePageLogic(page.nodes, page.connections, manualOverrides);
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

async function start() {
  try {
    dataDir = await findWritableDataDir();
    pagesFile = path.join(dataDir, 'pages.json');
    blocksFile = path.join(dataDir, 'custom-blocks.json');
    console.log(`=== WIRESHEET SERVER START ===`);
    console.log(`Data-Verzeichnis: ${dataDir}`);
    console.log(`Pages-Datei: ${pagesFile}`);

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
  } catch (err) {
    console.error('Start fehlgeschlagen:', err);
    process.exit(1);
  }
}

start().catch(console.error);
