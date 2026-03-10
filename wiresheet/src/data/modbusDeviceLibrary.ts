import { ModbusDevice, ModbusDatapoint } from '../types/flow';

export interface ModbusDeviceTemplate {
  id: string;
  manufacturer: string;
  model: string;
  description: string;
  category: string;
  datapoints: Omit<ModbusDatapoint, 'id'>[];
}

export const modbusDeviceLibrary: ModbusDeviceTemplate[] = [
  {
    id: 'isma-mix18-ip',
    manufacturer: 'iSMA / Global Control 5',
    model: 'ISMA-B-MIX18-IP',
    description: 'Modbus TCP/IP I/O Modul mit 5 UI, 5 DI, 4 AO, 4 DO',
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
      { name: 'UI1 Konfiguration', address: 150, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: true },
      { name: 'UI2 Konfiguration', address: 151, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: true },
      { name: 'UI3 Konfiguration', address: 152, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: true },
      { name: 'UI4 Konfiguration', address: 153, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: true },
      { name: 'UI5 Konfiguration', address: 154, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: true },
      { name: 'UI1 Filter Zeit', address: 158, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: 'ms', writable: true },
      { name: 'UI2 Filter Zeit', address: 159, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: 'ms', writable: true },
      { name: 'UI3 Filter Zeit', address: 160, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: 'ms', writable: true },
      { name: 'UI4 Filter Zeit', address: 161, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: 'ms', writable: true },
      { name: 'UI5 Filter Zeit', address: 162, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: 'ms', writable: true },
      { name: 'AO1 Konfiguration', address: 167, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: true },
      { name: 'AO2 Konfiguration', address: 168, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: true },
      { name: 'AO3 Konfiguration', address: 169, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: true },
      { name: 'AO4 Konfiguration', address: 170, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: true },
      { name: 'DI1 Betriebsmodus', address: 175, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: true },
      { name: 'DI1 Zeitwert', address: 176, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: 's', writable: true },
      { name: 'DI2 Betriebsmodus', address: 179, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: true },
      { name: 'DI2 Zeitwert', address: 180, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: 's', writable: true },
      { name: 'DI3 Betriebsmodus', address: 183, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: true },
      { name: 'DI3 Zeitwert', address: 184, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: 's', writable: true },
      { name: 'DI4 Betriebsmodus', address: 187, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: true },
      { name: 'DI4 Zeitwert', address: 188, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: 's', writable: true },
      { name: 'Counter 1', address: 22, registerType: 'holding', dataType: 'uint32', scale: 1, offset: 0, unit: '', writable: true },
      { name: 'Counter 2', address: 24, registerType: 'holding', dataType: 'uint32', scale: 1, offset: 0, unit: '', writable: true },
      { name: 'Counter 3', address: 26, registerType: 'holding', dataType: 'uint32', scale: 1, offset: 0, unit: '', writable: true },
      { name: 'Counter 4', address: 28, registerType: 'holding', dataType: 'uint32', scale: 1, offset: 0, unit: '', writable: true },
      { name: 'DO Default Status', address: 142, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: true },
      { name: 'AO Default Status', address: 143, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: true },
      { name: 'AO1 Default Wert', address: 144, registerType: 'holding', dataType: 'uint16', scale: 0.1, offset: 0, unit: '%', writable: true },
      { name: 'AO2 Default Wert', address: 145, registerType: 'holding', dataType: 'uint16', scale: 0.1, offset: 0, unit: '%', writable: true },
      { name: 'AO3 Default Wert', address: 146, registerType: 'holding', dataType: 'uint16', scale: 0.1, offset: 0, unit: '%', writable: true },
      { name: 'AO4 Default Wert', address: 147, registerType: 'holding', dataType: 'uint16', scale: 0.1, offset: 0, unit: '%', writable: true },
      { name: 'Watchdog Zeit', address: 140, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: 's', writable: true },
      { name: 'Command Register', address: 19, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: true },
      { name: 'Block Inputs', address: 20, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: true },
      { name: 'Counter Reset', address: 21, registerType: 'holding', dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: true },
      { name: 'Firmware Version', address: 0, registerType: 'input', dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: false },
      { name: 'Modul Adresse', address: 1, registerType: 'input', dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: false },
      { name: 'Baudrate/Protokoll', address: 2, registerType: 'input', dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: false },
      { name: 'Empfangene Frames', address: 3, registerType: 'input', dataType: 'uint32', scale: 1, offset: 0, unit: '', writable: false },
      { name: 'Fehler Frames', address: 5, registerType: 'input', dataType: 'uint32', scale: 1, offset: 0, unit: '', writable: false },
      { name: 'Gesendete Frames', address: 7, registerType: 'input', dataType: 'uint32', scale: 1, offset: 0, unit: '', writable: false },
      { name: 'Uptime', address: 11, registerType: 'input', dataType: 'uint32', scale: 1, offset: 0, unit: 's', writable: false },
      { name: 'Manual Status', address: 14, registerType: 'input', dataType: 'uint16', scale: 1, offset: 0, unit: '', writable: false },
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
