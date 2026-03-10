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
  { value: 0, label: 'Kein Sensor (deaktiviert)' },
  { value: 1, label: 'NTC 10k (Siemens QAC)' },
  { value: 2, label: 'NTC 10k (Type 2)' },
  { value: 3, label: 'NTC 10k (Type 3)' },
  { value: 4, label: 'NTC 20k' },
  { value: 5, label: 'PT100' },
  { value: 6, label: 'PT500' },
  { value: 7, label: 'PT1000' },
  { value: 8, label: 'NI1000' },
  { value: 9, label: 'NI1000 LG' },
  { value: 10, label: '0-10V Analog' },
  { value: 11, label: '0-5V Analog' },
  { value: 12, label: '2-10V Analog' },
  { value: 13, label: '0-20mA Analog' },
  { value: 14, label: '4-20mA Analog' },
  { value: 15, label: 'Digital (Kontakt)' },
  { value: 16, label: 'Zaehler (Counter)' },
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
  { value: 0, label: 'Kein Filter' },
  { value: 1, label: '1 Sekunde' },
  { value: 2, label: '2 Sekunden' },
  { value: 3, label: '5 Sekunden' },
  { value: 5, label: '10 Sekunden' },
  { value: 10, label: '30 Sekunden' },
  { value: 20, label: '60 Sekunden' },
];

export const modbusDeviceLibrary: ModbusDeviceTemplate[] = [
  {
    id: 'isma-mix18-ip',
    manufacturer: 'iSMA / Global Control 5',
    model: 'ISMA-B-MIX18-IP',
    description: 'Modbus TCP/IP I/O Modul mit 5 UI, 5 DI, 4 AO, 4 DO',
    category: 'I/O Module',
    inputDatapoints: [
      { name: 'UI1', address: 71, registerType: 'input', dataType: 'int16', scale: 0.1, offset: 0, unit: '°C', writable: false },
      { name: 'UI2', address: 73, registerType: 'input', dataType: 'int16', scale: 0.1, offset: 0, unit: '°C', writable: false },
      { name: 'UI3', address: 75, registerType: 'input', dataType: 'int16', scale: 0.1, offset: 0, unit: '°C', writable: false },
      { name: 'UI4', address: 77, registerType: 'input', dataType: 'int16', scale: 0.1, offset: 0, unit: '°C', writable: false },
      { name: 'UI5', address: 79, registerType: 'input', dataType: 'int16', scale: 0.1, offset: 0, unit: '°C', writable: false },
      { name: 'DI1', address: 15, registerType: 'input', dataType: 'bool', scale: 1, offset: 0, unit: '', writable: false, bitIndex: 0 },
      { name: 'DI2', address: 15, registerType: 'input', dataType: 'bool', scale: 1, offset: 0, unit: '', writable: false, bitIndex: 1 },
      { name: 'DI3', address: 15, registerType: 'input', dataType: 'bool', scale: 1, offset: 0, unit: '', writable: false, bitIndex: 2 },
      { name: 'DI4', address: 15, registerType: 'input', dataType: 'bool', scale: 1, offset: 0, unit: '', writable: false, bitIndex: 3 },
      { name: 'DI5', address: 15, registerType: 'input', dataType: 'bool', scale: 1, offset: 0, unit: '', writable: false, bitIndex: 4 },
    ],
    outputDatapoints: [
      { name: 'DO1', address: 17, registerType: 'holding', dataType: 'bool', scale: 1, offset: 0, unit: '', writable: true, bitIndex: 0 },
      { name: 'DO2', address: 17, registerType: 'holding', dataType: 'bool', scale: 1, offset: 0, unit: '', writable: true, bitIndex: 1 },
      { name: 'DO3', address: 17, registerType: 'holding', dataType: 'bool', scale: 1, offset: 0, unit: '', writable: true, bitIndex: 2 },
      { name: 'DO4', address: 17, registerType: 'holding', dataType: 'bool', scale: 1, offset: 0, unit: '', writable: true, bitIndex: 3 },
      { name: 'AO1', address: 120, registerType: 'holding', dataType: 'uint16', scale: 0.1, offset: 0, unit: '%', writable: true },
      { name: 'AO2', address: 121, registerType: 'holding', dataType: 'uint16', scale: 0.1, offset: 0, unit: '%', writable: true },
      { name: 'AO3', address: 122, registerType: 'holding', dataType: 'uint16', scale: 0.1, offset: 0, unit: '%', writable: true },
      { name: 'AO4', address: 123, registerType: 'holding', dataType: 'uint16', scale: 0.1, offset: 0, unit: '%', writable: true },
    ],
    configDatapoints: [
      { name: 'UI1 Sensortyp', address: 150, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, configOptions: UI_SENSOR_TYPES, configDescription: 'Waehle den Sensortyp fuer UI1' },
      { name: 'UI1 Filterzeit', address: 160, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, configOptions: UI_FILTER_OPTIONS, configDescription: 'Filterzeit zur Glaettung des Eingangssignals' },
      { name: 'UI1 Offset', address: 170, registerType: 'holding', dataType: 'int16', scale: 0.1, writable: true, isConfig: true, unit: '°C', configDescription: 'Offset-Korrektur fuer Kalibrierung' },
      { name: 'UI2 Sensortyp', address: 151, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, configOptions: UI_SENSOR_TYPES, configDescription: 'Waehle den Sensortyp fuer UI2' },
      { name: 'UI2 Filterzeit', address: 161, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, configOptions: UI_FILTER_OPTIONS, configDescription: 'Filterzeit zur Glaettung des Eingangssignals' },
      { name: 'UI2 Offset', address: 171, registerType: 'holding', dataType: 'int16', scale: 0.1, writable: true, isConfig: true, unit: '°C', configDescription: 'Offset-Korrektur fuer Kalibrierung' },
      { name: 'UI3 Sensortyp', address: 152, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, configOptions: UI_SENSOR_TYPES, configDescription: 'Waehle den Sensortyp fuer UI3' },
      { name: 'UI3 Filterzeit', address: 162, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, configOptions: UI_FILTER_OPTIONS, configDescription: 'Filterzeit zur Glaettung des Eingangssignals' },
      { name: 'UI3 Offset', address: 172, registerType: 'holding', dataType: 'int16', scale: 0.1, writable: true, isConfig: true, unit: '°C', configDescription: 'Offset-Korrektur fuer Kalibrierung' },
      { name: 'UI4 Sensortyp', address: 153, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, configOptions: UI_SENSOR_TYPES, configDescription: 'Waehle den Sensortyp fuer UI4' },
      { name: 'UI4 Filterzeit', address: 163, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, configOptions: UI_FILTER_OPTIONS, configDescription: 'Filterzeit zur Glaettung des Eingangssignals' },
      { name: 'UI4 Offset', address: 173, registerType: 'holding', dataType: 'int16', scale: 0.1, writable: true, isConfig: true, unit: '°C', configDescription: 'Offset-Korrektur fuer Kalibrierung' },
      { name: 'UI5 Sensortyp', address: 154, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, configOptions: UI_SENSOR_TYPES, configDescription: 'Waehle den Sensortyp fuer UI5' },
      { name: 'UI5 Filterzeit', address: 164, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, configOptions: UI_FILTER_OPTIONS, configDescription: 'Filterzeit zur Glaettung des Eingangssignals' },
      { name: 'UI5 Offset', address: 174, registerType: 'holding', dataType: 'int16', scale: 0.1, writable: true, isConfig: true, unit: '°C', configDescription: 'Offset-Korrektur fuer Kalibrierung' },
      { name: 'DI1 Entprellzeit', address: 180, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, configOptions: DI_DEBOUNCE_OPTIONS, configDescription: 'Entprellzeit fuer DI1' },
      { name: 'DI2 Entprellzeit', address: 181, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, configOptions: DI_DEBOUNCE_OPTIONS, configDescription: 'Entprellzeit fuer DI2' },
      { name: 'DI3 Entprellzeit', address: 182, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, configOptions: DI_DEBOUNCE_OPTIONS, configDescription: 'Entprellzeit fuer DI3' },
      { name: 'DI4 Entprellzeit', address: 183, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, configOptions: DI_DEBOUNCE_OPTIONS, configDescription: 'Entprellzeit fuer DI4' },
      { name: 'DI5 Entprellzeit', address: 184, registerType: 'holding', dataType: 'uint16', writable: true, isConfig: true, configOptions: DI_DEBOUNCE_OPTIONS, configDescription: 'Entprellzeit fuer DI5' },
      { name: 'AO1 Minimum', address: 200, registerType: 'holding', dataType: 'uint16', scale: 0.1, writable: true, isConfig: true, unit: '%', configDescription: 'Minimaler Ausgangswert' },
      { name: 'AO1 Maximum', address: 201, registerType: 'holding', dataType: 'uint16', scale: 0.1, writable: true, isConfig: true, unit: '%', configDescription: 'Maximaler Ausgangswert' },
      { name: 'AO2 Minimum', address: 202, registerType: 'holding', dataType: 'uint16', scale: 0.1, writable: true, isConfig: true, unit: '%', configDescription: 'Minimaler Ausgangswert' },
      { name: 'AO2 Maximum', address: 203, registerType: 'holding', dataType: 'uint16', scale: 0.1, writable: true, isConfig: true, unit: '%', configDescription: 'Maximaler Ausgangswert' },
      { name: 'AO3 Minimum', address: 204, registerType: 'holding', dataType: 'uint16', scale: 0.1, writable: true, isConfig: true, unit: '%', configDescription: 'Minimaler Ausgangswert' },
      { name: 'AO3 Maximum', address: 205, registerType: 'holding', dataType: 'uint16', scale: 0.1, writable: true, isConfig: true, unit: '%', configDescription: 'Maximaler Ausgangswert' },
      { name: 'AO4 Minimum', address: 206, registerType: 'holding', dataType: 'uint16', scale: 0.1, writable: true, isConfig: true, unit: '%', configDescription: 'Minimaler Ausgangswert' },
      { name: 'AO4 Maximum', address: 207, registerType: 'holding', dataType: 'uint16', scale: 0.1, writable: true, isConfig: true, unit: '%', configDescription: 'Maximaler Ausgangswert' },
    ],
    datapoints: [
      { name: 'UI1', address: 71, registerType: 'input', dataType: 'int16', scale: 0.1, offset: 0, unit: '°C', writable: false },
      { name: 'UI2', address: 73, registerType: 'input', dataType: 'int16', scale: 0.1, offset: 0, unit: '°C', writable: false },
      { name: 'UI3', address: 75, registerType: 'input', dataType: 'int16', scale: 0.1, offset: 0, unit: '°C', writable: false },
      { name: 'UI4', address: 77, registerType: 'input', dataType: 'int16', scale: 0.1, offset: 0, unit: '°C', writable: false },
      { name: 'UI5', address: 79, registerType: 'input', dataType: 'int16', scale: 0.1, offset: 0, unit: '°C', writable: false },
      { name: 'DI1', address: 15, registerType: 'input', dataType: 'bool', scale: 1, offset: 0, unit: '', writable: false, bitIndex: 0 },
      { name: 'DI2', address: 15, registerType: 'input', dataType: 'bool', scale: 1, offset: 0, unit: '', writable: false, bitIndex: 1 },
      { name: 'DI3', address: 15, registerType: 'input', dataType: 'bool', scale: 1, offset: 0, unit: '', writable: false, bitIndex: 2 },
      { name: 'DI4', address: 15, registerType: 'input', dataType: 'bool', scale: 1, offset: 0, unit: '', writable: false, bitIndex: 3 },
      { name: 'DI5', address: 15, registerType: 'input', dataType: 'bool', scale: 1, offset: 0, unit: '', writable: false, bitIndex: 4 },
      { name: 'DO1', address: 17, registerType: 'holding', dataType: 'bool', scale: 1, offset: 0, unit: '', writable: true, bitIndex: 0 },
      { name: 'DO2', address: 17, registerType: 'holding', dataType: 'bool', scale: 1, offset: 0, unit: '', writable: true, bitIndex: 1 },
      { name: 'DO3', address: 17, registerType: 'holding', dataType: 'bool', scale: 1, offset: 0, unit: '', writable: true, bitIndex: 2 },
      { name: 'DO4', address: 17, registerType: 'holding', dataType: 'bool', scale: 1, offset: 0, unit: '', writable: true, bitIndex: 3 },
      { name: 'AO1', address: 120, registerType: 'holding', dataType: 'uint16', scale: 0.1, offset: 0, unit: '%', writable: true },
      { name: 'AO2', address: 121, registerType: 'holding', dataType: 'uint16', scale: 0.1, offset: 0, unit: '%', writable: true },
      { name: 'AO3', address: 122, registerType: 'holding', dataType: 'uint16', scale: 0.1, offset: 0, unit: '%', writable: true },
      { name: 'AO4', address: 123, registerType: 'holding', dataType: 'uint16', scale: 0.1, offset: 0, unit: '%', writable: true },
    ]
  },
  {
    id: 'isma-mix18',
    manufacturer: 'iSMA / Global Control 5',
    model: 'ISMA-B-MIX18',
    description: 'Modbus RTU I/O Modul mit 5 UI, 5 DI, 4 AO, 4 DO',
    category: 'I/O Module',
    datapoints: [
      { name: 'UI1 Spannung', address: 70, registerType: 'input', dataType: 'uint16', scale: 0.1, offset: 0, unit: 'mV', writable: false },
      { name: 'UI1 Temperatur', address: 71, registerType: 'input', dataType: 'int16', scale: 0.1, offset: 0, unit: '°C', writable: false },
      { name: 'UI2 Spannung', address: 72, registerType: 'input', dataType: 'uint16', scale: 0.1, offset: 0, unit: 'mV', writable: false },
      { name: 'UI2 Temperatur', address: 73, registerType: 'input', dataType: 'int16', scale: 0.1, offset: 0, unit: '°C', writable: false },
      { name: 'UI3 Spannung', address: 74, registerType: 'input', dataType: 'uint16', scale: 0.1, offset: 0, unit: 'mV', writable: false },
      { name: 'UI3 Temperatur', address: 75, registerType: 'input', dataType: 'int16', scale: 0.1, offset: 0, unit: '°C', writable: false },
      { name: 'UI4 Spannung', address: 76, registerType: 'input', dataType: 'uint16', scale: 0.1, offset: 0, unit: 'mV', writable: false },
      { name: 'UI4 Temperatur', address: 77, registerType: 'input', dataType: 'int16', scale: 0.1, offset: 0, unit: '°C', writable: false },
      { name: 'UI5 Spannung', address: 78, registerType: 'input', dataType: 'uint16', scale: 0.1, offset: 0, unit: 'mV', writable: false },
      { name: 'UI5 Temperatur', address: 79, registerType: 'input', dataType: 'int16', scale: 0.1, offset: 0, unit: '°C', writable: false },
      { name: 'DI Status (alle)', address: 15, registerType: 'input', dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: false },
      { name: 'UI als DI Status', address: 16, registerType: 'input', dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: false },
      { name: 'DO Status (alle)', address: 17, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: true },
      { name: 'AO als DO Status', address: 18, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: true },
      { name: 'AO1 Wert', address: 120, registerType: 'holding', dataType: 'uint16', scale: 0.1, offset: 0, unit: '%', writable: true },
      { name: 'AO2 Wert', address: 121, registerType: 'holding', dataType: 'uint16', scale: 0.1, offset: 0, unit: '%', writable: true },
      { name: 'AO3 Wert', address: 122, registerType: 'holding', dataType: 'uint16', scale: 0.1, offset: 0, unit: '%', writable: true },
      { name: 'AO4 Wert', address: 123, registerType: 'holding', dataType: 'uint16', scale: 0.1, offset: 0, unit: '%', writable: true },
    ]
  },
  {
    id: 'isma-4u4o-h-ip',
    manufacturer: 'iSMA / Global Control 5',
    model: 'ISMA-B-4U4O-H-IP',
    description: 'Modbus TCP/IP I/O Modul mit 4 UI und 4 Relais-Ausgaengen',
    category: 'I/O Module',
    datapoints: [
      { name: 'UI1 Spannung', address: 70, registerType: 'input', dataType: 'uint16', scale: 0.1, offset: 0, unit: 'mV', writable: false },
      { name: 'UI1 Temperatur', address: 71, registerType: 'input', dataType: 'int16', scale: 0.1, offset: 0, unit: '°C', writable: false },
      { name: 'UI2 Spannung', address: 72, registerType: 'input', dataType: 'uint16', scale: 0.1, offset: 0, unit: 'mV', writable: false },
      { name: 'UI2 Temperatur', address: 73, registerType: 'input', dataType: 'int16', scale: 0.1, offset: 0, unit: '°C', writable: false },
      { name: 'UI3 Spannung', address: 74, registerType: 'input', dataType: 'uint16', scale: 0.1, offset: 0, unit: 'mV', writable: false },
      { name: 'UI3 Temperatur', address: 75, registerType: 'input', dataType: 'int16', scale: 0.1, offset: 0, unit: '°C', writable: false },
      { name: 'UI4 Spannung', address: 76, registerType: 'input', dataType: 'uint16', scale: 0.1, offset: 0, unit: 'mV', writable: false },
      { name: 'UI4 Temperatur', address: 77, registerType: 'input', dataType: 'int16', scale: 0.1, offset: 0, unit: '°C', writable: false },
      { name: 'UI als DI Status', address: 16, registerType: 'input', dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: false },
      { name: 'DO Status (alle)', address: 17, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: true },
      { name: 'UI1 Konfiguration', address: 150, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: true },
      { name: 'UI2 Konfiguration', address: 151, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: true },
      { name: 'UI3 Konfiguration', address: 152, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: true },
      { name: 'UI4 Konfiguration', address: 153, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: true },
    ]
  },
  {
    id: 'isma-8u-ip',
    manufacturer: 'iSMA / Global Control 5',
    model: 'ISMA-B-8U-IP',
    description: 'Modbus TCP/IP I/O Modul mit 8 Universal-Eingaengen',
    category: 'I/O Module',
    datapoints: [
      { name: 'UI1 Spannung', address: 70, registerType: 'input', dataType: 'uint16', scale: 0.1, offset: 0, unit: 'mV', writable: false },
      { name: 'UI1 Temperatur', address: 71, registerType: 'input', dataType: 'int16', scale: 0.1, offset: 0, unit: '°C', writable: false },
      { name: 'UI2 Spannung', address: 72, registerType: 'input', dataType: 'uint16', scale: 0.1, offset: 0, unit: 'mV', writable: false },
      { name: 'UI2 Temperatur', address: 73, registerType: 'input', dataType: 'int16', scale: 0.1, offset: 0, unit: '°C', writable: false },
      { name: 'UI3 Spannung', address: 74, registerType: 'input', dataType: 'uint16', scale: 0.1, offset: 0, unit: 'mV', writable: false },
      { name: 'UI3 Temperatur', address: 75, registerType: 'input', dataType: 'int16', scale: 0.1, offset: 0, unit: '°C', writable: false },
      { name: 'UI4 Spannung', address: 76, registerType: 'input', dataType: 'uint16', scale: 0.1, offset: 0, unit: 'mV', writable: false },
      { name: 'UI4 Temperatur', address: 77, registerType: 'input', dataType: 'int16', scale: 0.1, offset: 0, unit: '°C', writable: false },
      { name: 'UI5 Spannung', address: 78, registerType: 'input', dataType: 'uint16', scale: 0.1, offset: 0, unit: 'mV', writable: false },
      { name: 'UI5 Temperatur', address: 79, registerType: 'input', dataType: 'int16', scale: 0.1, offset: 0, unit: '°C', writable: false },
      { name: 'UI6 Spannung', address: 80, registerType: 'input', dataType: 'uint16', scale: 0.1, offset: 0, unit: 'mV', writable: false },
      { name: 'UI6 Temperatur', address: 81, registerType: 'input', dataType: 'int16', scale: 0.1, offset: 0, unit: '°C', writable: false },
      { name: 'UI7 Spannung', address: 82, registerType: 'input', dataType: 'uint16', scale: 0.1, offset: 0, unit: 'mV', writable: false },
      { name: 'UI7 Temperatur', address: 83, registerType: 'input', dataType: 'int16', scale: 0.1, offset: 0, unit: '°C', writable: false },
      { name: 'UI8 Spannung', address: 84, registerType: 'input', dataType: 'uint16', scale: 0.1, offset: 0, unit: 'mV', writable: false },
      { name: 'UI8 Temperatur', address: 85, registerType: 'input', dataType: 'int16', scale: 0.1, offset: 0, unit: '°C', writable: false },
      { name: 'UI als DI Status', address: 16, registerType: 'input', dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: false },
    ]
  },
  {
    id: 'generic-temperature',
    manufacturer: 'Generic',
    model: 'Temperatursensor',
    description: 'Generischer Modbus Temperatursensor',
    category: 'Sensoren',
    datapoints: [
      { name: 'Temperatur', address: 0, registerType: 'input', dataType: 'int16', scale: 0.1, offset: 0, unit: '°C', writable: false },
      { name: 'Luftfeuchtigkeit', address: 1, registerType: 'input', dataType: 'uint16', scale: 0.1, offset: 0, unit: '%', writable: false },
    ]
  },
  {
    id: 'generic-energy-meter',
    manufacturer: 'Generic',
    model: 'Energiezaehler',
    description: 'Generischer Modbus Energiezaehler',
    category: 'Zaehler',
    datapoints: [
      { name: 'Spannung L1', address: 0, registerType: 'input', dataType: 'float32', scale: 1, offset: 0, unit: 'V', writable: false },
      { name: 'Spannung L2', address: 2, registerType: 'input', dataType: 'float32', scale: 1, offset: 0, unit: 'V', writable: false },
      { name: 'Spannung L3', address: 4, registerType: 'input', dataType: 'float32', scale: 1, offset: 0, unit: 'V', writable: false },
      { name: 'Strom L1', address: 6, registerType: 'input', dataType: 'float32', scale: 1, offset: 0, unit: 'A', writable: false },
      { name: 'Strom L2', address: 8, registerType: 'input', dataType: 'float32', scale: 1, offset: 0, unit: 'A', writable: false },
      { name: 'Strom L3', address: 10, registerType: 'input', dataType: 'float32', scale: 1, offset: 0, unit: 'A', writable: false },
      { name: 'Wirkleistung Total', address: 12, registerType: 'input', dataType: 'float32', scale: 1, offset: 0, unit: 'kW', writable: false },
      { name: 'Energie Total', address: 14, registerType: 'input', dataType: 'float32', scale: 1, offset: 0, unit: 'kWh', writable: false },
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
