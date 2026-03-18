/**
 * dpStore - Single Source of Truth for all datapoint values
 *
 * Layer 1: dpStore
 *   - holds all live values keyed by dpKey
 *   - supports get / set / subscribe
 *   - triggers subscribers on every set
 *
 * dpKey format: "<nodeId>"  |  "<nodeId>:<portId>"  |  "<nodeId>:cfg:<paramKey>"
 */

const EventEmitter = require('events');

const _store = new Map();
const _persistent = new Map();
const _emitter = new EventEmitter();
_emitter.setMaxListeners(200);

let _saveTimeout = null;
let _saveFile = null;
let _fsSave = null;

function configure(dpValuesFilePath, fsPromises) {
  _saveFile = dpValuesFilePath;
  _fsSave = fsPromises;
}

async function load(dpValuesFilePath, fsPromises) {
  configure(dpValuesFilePath, fsPromises);
  try {
    const data = await fsPromises.readFile(dpValuesFilePath, 'utf-8');
    const obj = JSON.parse(data);
    _persistent.clear();
    for (const [key, value] of Object.entries(obj)) {
      _persistent.set(key, value);
      _store.set(key, value);
    }
    console.log(`dpStore: ${_persistent.size} persistente Werte geladen`);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('dpStore load error:', err.message);
    }
  }
}

function _scheduleSave() {
  if (!_saveFile || !_fsSave) return;
  if (_saveTimeout) clearTimeout(_saveTimeout);
  _saveTimeout = setTimeout(async () => {
    try {
      const obj = Object.fromEntries(_persistent);
      await _fsSave.writeFile(_saveFile, JSON.stringify(obj, null, 2));
    } catch (err) {
      console.error('dpStore save error:', err.message);
    }
    _saveTimeout = null;
  }, 500);
}

function get(dpKey) {
  return _store.get(dpKey);
}

function set(dpKey, value, options = {}) {
  const { persist = false, silent = false } = options;
  _store.set(dpKey, value);
  if (persist) {
    const nodeId = dpKey.includes(':') ? dpKey.split(':')[0] : dpKey;
    _persistent.set(nodeId, value);
    _scheduleSave();
  }
  if (!silent) {
    _emitter.emit('change', dpKey, value);
    _emitter.emit(`change:${dpKey}`, value);
  }
}

function setMany(entries, options = {}) {
  const changed = [];
  for (const [dpKey, value] of Object.entries(entries)) {
    const prev = _store.get(dpKey);
    if (prev !== value) {
      _store.set(dpKey, value);
      changed.push(dpKey);
    }
  }
  if (!options.silent && changed.length > 0) {
    for (const dpKey of changed) {
      _emitter.emit(`change:${dpKey}`, _store.get(dpKey));
    }
    _emitter.emit('change:batch', changed);
  }
}

function subscribe(dpKey, callback) {
  _emitter.on(`change:${dpKey}`, callback);
  return () => _emitter.off(`change:${dpKey}`, callback);
}

function onBatch(callback) {
  _emitter.on('change:batch', callback);
  return () => _emitter.off('change:batch', callback);
}

function onChange(callback) {
  _emitter.on('change', callback);
  return () => _emitter.off('change', callback);
}

function getSnapshot() {
  return Object.fromEntries(_store);
}

function setFromLogicOutput(nodeValues) {
  const changed = [];
  for (const [dpKey, value] of Object.entries(nodeValues)) {
    if (dpKey.includes(':cfg:')) continue;
    if (dpKey.includes(':input-')) continue;
    if (!dpKey.includes(':')) continue;
    const prev = _store.get(dpKey);
    if (prev !== value) {
      _store.set(dpKey, value);
      changed.push(dpKey);
    }
  }
  if (changed.length > 0) {
    _emitter.emit('change:batch', changed);
  }
}

function updatePaths(dpValuesFilePath, fsPromises) {
  _saveFile = dpValuesFilePath;
  _fsSave = fsPromises;
}

module.exports = { load, get, set, setMany, setFromLogicOutput, subscribe, onBatch, onChange, getSnapshot, updatePaths, configure };
