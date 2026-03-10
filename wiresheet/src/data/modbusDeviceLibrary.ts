import { ModbusDevice, ModbusDatapoint } from '../types/flow';

export interface ModbusDeviceTemplate {
  id: string;
  manufacturer: string;
  model: string;
  description: string;
  category: string;
  inputDatapoints?: Omit<ModbusDatapoint, 'id'>[];
  outputDatapoints?: Omit<ModbusDatapoint, 'id'>[];
  datapoints: Omit<ModbusDatapoint, 'id'>[];
}

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
