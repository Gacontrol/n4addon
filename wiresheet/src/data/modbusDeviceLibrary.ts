import { ModbusDevice, ModbusDatapoint, ModbusConfigOption } from '../types/flow';

export interface ModbusDeviceTemplate {
  id: string;
  manufacturer: string;
  model: string;
  description: string;
  category: string;
  inputDatapoints?: Omit<ModbusDatapoint, 'id'>[];
  outputDatapoints?: Omit<ModbusDatapoint, 'id'>[];
  configDatapoints?: Omit<ModbusDatapoint, 'id'>[];
  datapoints: Omit<ModbusDatapoint, 'id'>[];
}

const UI_SENSOR_TYPES: ModbusConfigOption[] = [
  { value: 0, label: 'Widerstandsmessung (Spannung, Trockenk.)' },
  { value: 1, label: 'NTC 10K3A1 B=3975K (Standard)' },
  { value: 2, label: 'NTC 10K4A1 B=3695K' },
  { value: 3, label: 'NTC 10K B=3435K Carel' },
  { value: 4, label: 'NTC 20K6A1 B=4362K' },
  { value: 5, label: 'NTC 2.2K3A1 B=3970K' },
  { value: 6, label: 'NTC 3K3A1 B=3975K' },
  { value: 7, label: 'NTC 30K6A1 B=4260K' },
  { value: 8, label: 'SHE1 Temperatur' },
  { value: 9, label: 'TAC1 Temperatur' },
  { value: 10, label: 'SAT1 Temperatur' },
  { value: 16, label: 'PT1000' },
  { value: 17, label: 'NI1000' },
  { value: 18, label: 'NI1000 21C' },
  { value: 19, label: 'NI1000 LG' },
  { value: 20, label: 'NTC Type2 B=3975K (US)' },
  { value: 21, label: 'NTC Type3 B=3695K' },
  { value: 22, label: 'NTC 20K B=4262K' },
  { value: 23, label: 'NTC 3K B=3975K' },
  { value: 24, label: 'PT1000 (F)' },
  { value: 25, label: 'NI1000 23F' },
  { value: 26, label: 'NI1000 70F' },
  { value: 128, label: 'Spannungsmessung 0ff' },
];

const DI_DEBOUNCE_OPTIONS: ModbusConfigOption[] = [
  { value: 0, label: 'Kein Entprellen' },
  { value: 1, label: '10 ms' },
  { value: 2, label: '20 ms' },
  { value: 3, label: '50 ms' },
  { value: 4, label: '100 ms' },
  { value: 5, label: '200 ms' },
  { value: 6, label: '500 ms' },
  { value: 7, label: '1000 ms' },
];

const UI_FILTER_OPTIONS: ModbusConfigOption[] = [
  { value: 0, label: 'Filter deaktiviert' },
  { value: 1, label: '1 Sekunde' },
  { value: 2, label: '2 Sekunden (Standard)' },
  { value: 3, label: '3 Sekunden' },
  { value: 4, label: '4 Sekunden' },
  { value: 5, label: '5 Sekunden' },
  { value: 10, label: '10 Sekunden' },
  { value: 20, label: '20 Sekunden' },
  { value: 30, label: '30 Sekunden' },
  { value: 60, label: '60 Sekunden' },
];

const UI_RESOLUTION_OPTIONS: ModbusConfigOption[] = [
  { value: 0, label: '12 Bit Aufloesung' },
  { value: 1, label: '16 Bit Aufloesung' },
];

const AO_MODE_OPTIONS: ModbusConfigOption[] = [
  { value: 0, label: '0-10V Spannung' },
  { value: 1, label: 'PWM 1Hz' },
  { value: 2, label: 'PWM 10Hz' },
  { value: 3, label: 'PWM 100Hz' },
  { value: 4, label: 'PWM 0.1Hz' },
  { value: 5, label: 'PWM 0.01Hz' },
];

const TRIAC_MODE_OPTIONS: ModbusConfigOption[] = [
  { value: 0, label: 'Analog PWM' },
  { value: 1, label: 'Digital (On/Off)' },
];

const OPERATION_MODE_OPTIONS: ModbusConfigOption[] = [
  { value: 0, label: 'Standard' },
  { value: 1, label: 'Heizen' },
  { value: 2, label: 'Kuehlen' },
  { value: 3, label: 'Ventilator Boost' },
  { value: 4, label: 'Jalousie' },
];

function createUIDatapoints(count: number, startVoltage: number, startTemp: number) {
  const inputs: Omit<ModbusDatapoint, 'id'>[] = [];
  for (let i = 1; i <= count; i++) {
    inputs.push({ name: `UI${i}`, address: startTemp + (i - 1) * 2, registerType: 'input', dataType: 'int16', scale: 0.1, unit: '°C', writable: false });
  }
  return inputs;
}

function createUIConfigDatapoints(count: number) {
  const configs: Omit<ModbusDatapoint, 'id'>[] = [];
  for (let i = 1; i <= count; i++) {
    configs.push(
      { name: `UI${i} Sensortyp`, address: 150 + i - 1, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, configOptions: UI_SENSOR_TYPES, configDescription: `Sensortyp fuer UI${i} (Register ${40151 + i - 1})`, currentValue: 1 },
      { name: `UI${i} Filterzeit`, address: 158 + i - 1, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, configOptions: UI_FILTER_OPTIONS, configDescription: `Filterzeit fuer UI${i} in Sekunden (Register ${40159 + i - 1})`, unit: 's', currentValue: 2 },
      { name: `UI${i} Aufloesung`, address: 166, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, configOptions: UI_RESOLUTION_OPTIONS, configDescription: `Aufloesung fuer UI${i} (Register 40167, Bit ${i - 1})`, bitIndex: i - 1, currentValue: 0 }
    );
  }
  return configs;
}

function createDIDatapoints(count: number, statusRegister: number) {
  const inputs: Omit<ModbusDatapoint, 'id'>[] = [];
  for (let i = 0; i < count; i++) {
    inputs.push({ name: `DI${i + 1}`, address: statusRegister, registerType: 'input', dataType: 'bool', scale: 1, unit: '', writable: false, bitIndex: i });
  }
  return inputs;
}

function createDODatapoints(count: number, statusRegister: number) {
  const outputs: Omit<ModbusDatapoint, 'id'>[] = [];
  for (let i = 0; i < count; i++) {
    outputs.push({ name: `DO${i + 1}`, address: statusRegister, registerType: 'holding', dataType: 'bool', scale: 1, unit: '', writable: true, bitIndex: i });
  }
  return outputs;
}

function createAODatapoints(count: number, startAddress: number) {
  const outputs: Omit<ModbusDatapoint, 'id'>[] = [];
  for (let i = 1; i <= count; i++) {
    outputs.push({ name: `AO${i}`, address: startAddress + i - 1, registerType: 'holding', dataType: 'uint16', scale: 0.001, unit: 'V', writable: true });
  }
  return outputs;
}

function createAOConfigDatapoints(count: number) {
  const configs: Omit<ModbusDatapoint, 'id'>[] = [];
  for (let i = 1; i <= count; i++) {
    configs.push(
      { name: `AO${i} Modus`, address: 166 + i, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, configOptions: AO_MODE_OPTIONS, configDescription: `Betriebsmodus fuer AO${i} (Register ${40167 + i})` },
      { name: `AO${i} Default`, address: 143 + i, registerType: 'holding', dataType: 'uint16', scale: 0.01, writable: true, isConfig: true, unit: 'V', configDescription: `Standardwert bei Watchdog fuer AO${i} (Register ${40144 + i}) in mV` }
    );
  }
  configs.push({ name: 'AO Default (Digital)', address: 143, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, configDescription: 'Digital-Status aller AO bei Watchdog (Register 40144)' });
  return configs;
}

function createDOConfigDatapoints(count: number) {
  const configs: Omit<ModbusDatapoint, 'id'>[] = [];
  configs.push({ name: 'DO Default Status', address: 142, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, configDescription: 'Standardstatus bei Watchdog fuer alle DO' });
  return configs;
}

function createTriacDatapoints(count: number, startAddress: number) {
  const outputs: Omit<ModbusDatapoint, 'id'>[] = [];
  for (let i = 1; i <= count; i++) {
    outputs.push({ name: `TO${i}`, address: startAddress + i - 1, registerType: 'holding', dataType: 'uint16', scale: 0.1, unit: '%', writable: true });
  }
  return outputs;
}

function createTriacConfigDatapoints(count: number) {
  const configs: Omit<ModbusDatapoint, 'id'>[] = [];
  for (let i = 1; i <= count; i++) {
    configs.push(
      { name: `TO${i} Modus`, address: 167 + i, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, configOptions: TRIAC_MODE_OPTIONS, configDescription: `Betriebsmodus fuer TO${i}` },
      { name: `TO${i} Default`, address: 144 + i, registerType: 'holding', dataType: 'uint16', scale: 0.1, writable: true, isConfig: true, unit: '%', configDescription: `Standardwert bei Watchdog fuer TO${i}` }
    );
  }
  return configs;
}

export const modbusDeviceLibrary: ModbusDeviceTemplate[] = [
  {
    id: 'isma-mix38-ip',
    manufacturer: 'iSMA / Global Control 5',
    model: 'ISMA-B-MIX38-IP',
    description: '8 UI, 12 DI, 6 AO, 4 DO - Grosses Kombimodul TCP/IP',
    category: 'iSMA MIX Module',
    inputDatapoints: [
      ...createUIDatapoints(8, 70, 71),
      ...createDIDatapoints(12, 16),
    ],
    outputDatapoints: [
      ...createDODatapoints(4, 18),
      ...createAODatapoints(6, 120),
    ],
    configDatapoints: [
      ...createUIConfigDatapoints(8),
      ...createDOConfigDatapoints(4),
      ...createAOConfigDatapoints(6),
      { name: 'Watchdog Zeit', address: 140, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, unit: 'ms', configDescription: 'Watchdog-Timeout (0=deaktiviert)' },
    ],
    datapoints: [
      ...createUIDatapoints(8, 70, 71),
      ...createDIDatapoints(12, 16),
      ...createDODatapoints(4, 18),
      ...createAODatapoints(6, 120),
    ]
  },
  {
    id: 'isma-mix18-ip',
    manufacturer: 'iSMA / Global Control 5',
    model: 'ISMA-B-MIX18-IP',
    description: '5 UI, 5 DI, 4 AO, 4 DO - Kombimodul TCP/IP',
    category: 'iSMA MIX Module',
    inputDatapoints: [
      ...createUIDatapoints(5, 70, 71),
      ...createDIDatapoints(5, 16),
    ],
    outputDatapoints: [
      ...createDODatapoints(4, 18),
      ...createAODatapoints(4, 120),
    ],
    configDatapoints: [
      ...createUIConfigDatapoints(5),
      ...createDOConfigDatapoints(4),
      ...createAOConfigDatapoints(4),
      { name: 'Watchdog Zeit', address: 140, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, unit: 'ms', configDescription: 'Watchdog-Timeout (0=deaktiviert)' },
    ],
    datapoints: [
      ...createUIDatapoints(5, 70, 71),
      ...createDIDatapoints(5, 16),
      ...createDODatapoints(4, 18),
      ...createAODatapoints(4, 120),
    ]
  },
  {
    id: 'isma-8u-ip',
    manufacturer: 'iSMA / Global Control 5',
    model: 'ISMA-B-8U-IP',
    description: '8 Universal-Eingaenge TCP/IP',
    category: 'iSMA Eingaenge',
    inputDatapoints: createUIDatapoints(8, 70, 71),
    outputDatapoints: [],
    configDatapoints: [
      ...createUIConfigDatapoints(8),
      { name: 'Watchdog Zeit', address: 140, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, unit: 'ms', configDescription: 'Watchdog-Timeout (0=deaktiviert)' },
    ],
    datapoints: createUIDatapoints(8, 70, 71)
  },
  {
    id: 'isma-24i-ip',
    manufacturer: 'iSMA / Global Control 5',
    model: 'ISMA-B-24I-IP',
    description: '24 Digital-Eingaenge TCP/IP',
    category: 'iSMA Eingaenge',
    inputDatapoints: createDIDatapoints(24, 16),
    outputDatapoints: [],
    configDatapoints: [
      { name: 'Watchdog Zeit', address: 140, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, unit: 'ms', configDescription: 'Watchdog-Timeout (0=deaktiviert)' },
    ],
    datapoints: createDIDatapoints(24, 16)
  },
  {
    id: 'isma-4o-h-ip',
    manufacturer: 'iSMA / Global Control 5',
    model: 'ISMA-B-4O-H-IP',
    description: '4 Relais-Ausgaenge TCP/IP',
    category: 'iSMA Ausgaenge',
    inputDatapoints: [],
    outputDatapoints: createDODatapoints(4, 18),
    configDatapoints: [
      ...createDOConfigDatapoints(4),
      { name: 'Watchdog Zeit', address: 140, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, unit: 'ms', configDescription: 'Watchdog-Timeout (0=deaktiviert)' },
    ],
    datapoints: createDODatapoints(4, 18)
  },
  {
    id: 'isma-12o-h-ip',
    manufacturer: 'iSMA / Global Control 5',
    model: 'ISMA-B-12O-H-IP',
    description: '12 Relais-Ausgaenge TCP/IP',
    category: 'iSMA Ausgaenge',
    inputDatapoints: [],
    outputDatapoints: createDODatapoints(12, 18),
    configDatapoints: [
      ...createDOConfigDatapoints(12),
      { name: 'Watchdog Zeit', address: 140, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, unit: 'ms', configDescription: 'Watchdog-Timeout (0=deaktiviert)' },
    ],
    datapoints: createDODatapoints(12, 18)
  },
  {
    id: 'isma-4u4a-h-ip',
    manufacturer: 'iSMA / Global Control 5',
    model: 'ISMA-B-4U4A-H-IP',
    description: '4 UI, 4 AO - Analog I/O Modul TCP/IP',
    category: 'iSMA Kombination',
    inputDatapoints: createUIDatapoints(4, 70, 71),
    outputDatapoints: createAODatapoints(4, 120),
    configDatapoints: [
      ...createUIConfigDatapoints(4),
      ...createAOConfigDatapoints(4),
      { name: 'Watchdog Zeit', address: 140, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, unit: 'ms', configDescription: 'Watchdog-Timeout (0=deaktiviert)' },
    ],
    datapoints: [
      ...createUIDatapoints(4, 70, 71),
      ...createAODatapoints(4, 120),
    ]
  },
  {
    id: 'isma-4i4o-h-ip',
    manufacturer: 'iSMA / Global Control 5',
    model: 'ISMA-B-4I4O-H-IP',
    description: '4 DI, 4 DO - Digital I/O Modul TCP/IP',
    category: 'iSMA Kombination',
    inputDatapoints: createDIDatapoints(4, 16),
    outputDatapoints: createDODatapoints(4, 18),
    configDatapoints: [
      ...createDOConfigDatapoints(4),
      { name: 'Watchdog Zeit', address: 140, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, unit: 'ms', configDescription: 'Watchdog-Timeout (0=deaktiviert)' },
      { name: 'Betriebsmodus', address: 175, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, configOptions: OPERATION_MODE_OPTIONS, configDescription: 'Spezial-Betriebsmodus fuer Heizen/Kuehlen' },
    ],
    datapoints: [
      ...createDIDatapoints(4, 16),
      ...createDODatapoints(4, 18),
    ]
  },
  {
    id: 'isma-4u4o-h-ip',
    manufacturer: 'iSMA / Global Control 5',
    model: 'ISMA-B-4U4O-H-IP',
    description: '4 UI, 4 DO - Universal/Digital I/O TCP/IP',
    category: 'iSMA Kombination',
    inputDatapoints: createUIDatapoints(4, 70, 71),
    outputDatapoints: createDODatapoints(4, 18),
    configDatapoints: [
      ...createUIConfigDatapoints(4),
      ...createDOConfigDatapoints(4),
      { name: 'Watchdog Zeit', address: 140, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, unit: 'ms', configDescription: 'Watchdog-Timeout (0=deaktiviert)' },
      { name: 'Betriebsmodus', address: 175, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, configOptions: OPERATION_MODE_OPTIONS, configDescription: 'Spezial-Betriebsmodus fuer Heizen/Kuehlen' },
    ],
    datapoints: [
      ...createUIDatapoints(4, 70, 71),
      ...createDODatapoints(4, 18),
    ]
  },
  {
    id: 'isma-4to-h-ip',
    manufacturer: 'iSMA / Global Control 5',
    model: 'ISMA-B-4TO-H-IP',
    description: '4 Triac-Ausgaenge (PWM) TCP/IP',
    category: 'iSMA Ausgaenge',
    inputDatapoints: [],
    outputDatapoints: createTriacDatapoints(4, 120),
    configDatapoints: [
      ...createTriacConfigDatapoints(4),
      { name: 'Watchdog Zeit', address: 140, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, unit: 'ms', configDescription: 'Watchdog-Timeout (0=deaktiviert)' },
    ],
    datapoints: createTriacDatapoints(4, 120)
  },
  {
    id: 'isma-mix38',
    manufacturer: 'iSMA / Global Control 5',
    model: 'ISMA-B-MIX38',
    description: '8 UI, 12 DI, 6 AO, 4 DO - Grosses Kombimodul RTU',
    category: 'iSMA MIX Module',
    inputDatapoints: [
      ...createUIDatapoints(8, 70, 71),
      ...createDIDatapoints(12, 16),
    ],
    outputDatapoints: [
      ...createDODatapoints(4, 18),
      ...createAODatapoints(6, 120),
    ],
    configDatapoints: [
      ...createUIConfigDatapoints(8),
      ...createDOConfigDatapoints(4),
      ...createAOConfigDatapoints(6),
    ],
    datapoints: [
      ...createUIDatapoints(8, 70, 71),
      ...createDIDatapoints(12, 16),
      ...createDODatapoints(4, 18),
      ...createAODatapoints(6, 120),
    ]
  },
  {
    id: 'isma-mix18',
    manufacturer: 'iSMA / Global Control 5',
    model: 'ISMA-B-MIX18',
    description: '5 UI, 5 DI, 4 AO, 4 DO - Kombimodul RTU',
    category: 'iSMA MIX Module',
    inputDatapoints: [
      ...createUIDatapoints(5, 70, 71),
      ...createDIDatapoints(5, 16),
    ],
    outputDatapoints: [
      ...createDODatapoints(4, 18),
      ...createAODatapoints(4, 120),
    ],
    configDatapoints: [
      ...createUIConfigDatapoints(5),
      ...createDOConfigDatapoints(4),
      ...createAOConfigDatapoints(4),
    ],
    datapoints: [
      ...createUIDatapoints(5, 70, 71),
      ...createDIDatapoints(5, 16),
      ...createDODatapoints(4, 18),
      ...createAODatapoints(4, 120),
    ]
  },
  {
    id: 'isma-8u',
    manufacturer: 'iSMA / Global Control 5',
    model: 'ISMA-B-8U',
    description: '8 Universal-Eingaenge RTU',
    category: 'iSMA Eingaenge',
    inputDatapoints: createUIDatapoints(8, 70, 71),
    outputDatapoints: [],
    configDatapoints: createUIConfigDatapoints(8),
    datapoints: createUIDatapoints(8, 70, 71)
  },
  {
    id: 'isma-24i',
    manufacturer: 'iSMA / Global Control 5',
    model: 'ISMA-B-24I',
    description: '24 Digital-Eingaenge RTU',
    category: 'iSMA Eingaenge',
    inputDatapoints: createDIDatapoints(24, 16),
    outputDatapoints: [],
    configDatapoints: [],
    datapoints: createDIDatapoints(24, 16)
  },
  {
    id: 'isma-4o-h',
    manufacturer: 'iSMA / Global Control 5',
    model: 'ISMA-B-4O-H',
    description: '4 Relais-Ausgaenge RTU',
    category: 'iSMA Ausgaenge',
    inputDatapoints: [],
    outputDatapoints: createDODatapoints(4, 18),
    configDatapoints: createDOConfigDatapoints(4),
    datapoints: createDODatapoints(4, 18)
  },
  {
    id: 'isma-12o-h',
    manufacturer: 'iSMA / Global Control 5',
    model: 'ISMA-B-12O-H',
    description: '12 Relais-Ausgaenge RTU',
    category: 'iSMA Ausgaenge',
    inputDatapoints: [],
    outputDatapoints: createDODatapoints(12, 18),
    configDatapoints: createDOConfigDatapoints(12),
    datapoints: createDODatapoints(12, 18)
  },
  {
    id: 'isma-4u4a-h',
    manufacturer: 'iSMA / Global Control 5',
    model: 'ISMA-B-4U4A-H',
    description: '4 UI, 4 AO - Analog I/O Modul RTU',
    category: 'iSMA Kombination',
    inputDatapoints: createUIDatapoints(4, 70, 71),
    outputDatapoints: createAODatapoints(4, 120),
    configDatapoints: [
      ...createUIConfigDatapoints(4),
      ...createAOConfigDatapoints(4),
    ],
    datapoints: [
      ...createUIDatapoints(4, 70, 71),
      ...createAODatapoints(4, 120),
    ]
  },
  {
    id: 'isma-4i4o-h',
    manufacturer: 'iSMA / Global Control 5',
    model: 'ISMA-B-4I4O-H',
    description: '4 DI, 4 DO - Digital I/O Modul RTU',
    category: 'iSMA Kombination',
    inputDatapoints: createDIDatapoints(4, 16),
    outputDatapoints: createDODatapoints(4, 18),
    configDatapoints: [
      ...createDOConfigDatapoints(4),
      { name: 'Betriebsmodus', address: 175, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, configOptions: OPERATION_MODE_OPTIONS, configDescription: 'Spezial-Betriebsmodus fuer Heizen/Kuehlen' },
    ],
    datapoints: [
      ...createDIDatapoints(4, 16),
      ...createDODatapoints(4, 18),
    ]
  },
  {
    id: 'isma-4u4o-h',
    manufacturer: 'iSMA / Global Control 5',
    model: 'ISMA-B-4U4O-H',
    description: '4 UI, 4 DO - Universal/Digital I/O RTU',
    category: 'iSMA Kombination',
    inputDatapoints: createUIDatapoints(4, 70, 71),
    outputDatapoints: createDODatapoints(4, 18),
    configDatapoints: [
      ...createUIConfigDatapoints(4),
      ...createDOConfigDatapoints(4),
      { name: 'Betriebsmodus', address: 175, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, configOptions: OPERATION_MODE_OPTIONS, configDescription: 'Spezial-Betriebsmodus fuer Heizen/Kuehlen' },
    ],
    datapoints: [
      ...createUIDatapoints(4, 70, 71),
      ...createDODatapoints(4, 18),
    ]
  },
  {
    id: 'isma-4to-h',
    manufacturer: 'iSMA / Global Control 5',
    model: 'ISMA-B-4TO-H',
    description: '4 Triac-Ausgaenge (PWM) RTU',
    category: 'iSMA Ausgaenge',
    inputDatapoints: [],
    outputDatapoints: createTriacDatapoints(4, 120),
    configDatapoints: createTriacConfigDatapoints(4),
    datapoints: createTriacDatapoints(4, 120)
  },
  {
    id: 'generic-temperature',
    manufacturer: 'Generic',
    model: 'Temperatursensor',
    description: 'Generischer Modbus Temperatursensor',
    category: 'Sensoren',
    inputDatapoints: [
      { name: 'Temperatur', address: 0, registerType: 'input', dataType: 'int16', scale: 0.1, unit: '°C', writable: false },
      { name: 'Luftfeuchtigkeit', address: 1, registerType: 'input', dataType: 'uint16', scale: 0.1, unit: '%', writable: false },
    ],
    outputDatapoints: [],
    configDatapoints: [],
    datapoints: [
      { name: 'Temperatur', address: 0, registerType: 'input', dataType: 'int16', scale: 0.1, unit: '°C', writable: false },
      { name: 'Luftfeuchtigkeit', address: 1, registerType: 'input', dataType: 'uint16', scale: 0.1, unit: '%', writable: false },
    ]
  },
  {
    id: 'generic-energy-meter',
    manufacturer: 'Generic',
    model: 'Energiezaehler',
    description: 'Generischer Modbus Energiezaehler',
    category: 'Zaehler',
    inputDatapoints: [
      { name: 'Spannung L1', address: 0, registerType: 'input', dataType: 'float32', scale: 1, unit: 'V', writable: false },
      { name: 'Spannung L2', address: 2, registerType: 'input', dataType: 'float32', scale: 1, unit: 'V', writable: false },
      { name: 'Spannung L3', address: 4, registerType: 'input', dataType: 'float32', scale: 1, unit: 'V', writable: false },
      { name: 'Strom L1', address: 6, registerType: 'input', dataType: 'float32', scale: 1, unit: 'A', writable: false },
      { name: 'Strom L2', address: 8, registerType: 'input', dataType: 'float32', scale: 1, unit: 'A', writable: false },
      { name: 'Strom L3', address: 10, registerType: 'input', dataType: 'float32', scale: 1, unit: 'A', writable: false },
      { name: 'Wirkleistung Total', address: 12, registerType: 'input', dataType: 'float32', scale: 1, unit: 'kW', writable: false },
      { name: 'Energie Total', address: 14, registerType: 'input', dataType: 'float32', scale: 1, unit: 'kWh', writable: false },
    ],
    outputDatapoints: [],
    configDatapoints: [],
    datapoints: [
      { name: 'Spannung L1', address: 0, registerType: 'input', dataType: 'float32', scale: 1, unit: 'V', writable: false },
      { name: 'Spannung L2', address: 2, registerType: 'input', dataType: 'float32', scale: 1, unit: 'V', writable: false },
      { name: 'Spannung L3', address: 4, registerType: 'input', dataType: 'float32', scale: 1, unit: 'V', writable: false },
      { name: 'Strom L1', address: 6, registerType: 'input', dataType: 'float32', scale: 1, unit: 'A', writable: false },
      { name: 'Strom L2', address: 8, registerType: 'input', dataType: 'float32', scale: 1, unit: 'A', writable: false },
      { name: 'Strom L3', address: 10, registerType: 'input', dataType: 'float32', scale: 1, unit: 'A', writable: false },
      { name: 'Wirkleistung Total', address: 12, registerType: 'input', dataType: 'float32', scale: 1, unit: 'kW', writable: false },
      { name: 'Energie Total', address: 14, registerType: 'input', dataType: 'float32', scale: 1, unit: 'kWh', writable: false },
    ]
  }
];

export function createDeviceFromTemplate(template: ModbusDeviceTemplate, name?: string): ModbusDevice {
  return {
    id: `device-${Date.now()}`,
    name: name || template.model,
    unitId: 1,
    datapoints: template.datapoints.map((dp, index) => ({
      ...dp,
      id: `dp-${Date.now()}-${index}`
    }))
  };
}

export function getDeviceCategories(): string[] {
  const categories = new Set(modbusDeviceLibrary.map(d => d.category));
  return Array.from(categories).sort();
}

export function getDevicesByCategory(category: string): ModbusDeviceTemplate[] {
  return modbusDeviceLibrary.filter(d => d.category === category);
}
