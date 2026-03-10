# Wiresheet Flow Editor - Home Assistant Addon

Ein visueller Flow-Editor für Home Assistant, inspiriert von Niagara Wiresheet. Programmiere deine Smart Home Automatisierungen mit Drag & Drop Bausteinen.

## Features

- **Visueller Editor**: Drag & Drop Interface zum Erstellen von Automatisierungen
- **Bausteine**: Sensoren, Aktoren, Logik-Bausteine, Trigger und mehr
- **Verbindungen**: Verbinde Bausteine visuell miteinander
- **Home Assistant Integration**: Direkter Zugriff auf alle HA Entities und Services
- **Persistenz**: Flows werden automatisch gespeichert
- **Export/Import**: Sichere und teile deine Flows

## Installation

1. Füge das Repository zu deinen Home Assistant Addon-Repositories hinzu
2. Suche nach "Wiresheet Flow Editor"
3. Klicke auf "Installieren"
4. Starte das Addon
5. Öffne das Web UI

## Verwendung

### Bausteine hinzufügen
- Ziehe Bausteine aus der linken Palette auf das Canvas
- Positioniere sie per Drag & Drop

### Verbindungen erstellen
- Klicke auf einen Ausgang (grüner Punkt rechts)
- Klicke auf einen Eingang (blauer Punkt links)
- Die Verbindung wird automatisch erstellt

### Flow ausführen
- Klicke auf "Ausführen" in der oberen Toolbar
- Der Flow wird verarbeitet und die Aktionen werden ausgeführt

### Speichern & Laden
- Flows werden automatisch gespeichert
- Nutze Export/Import für Backups oder zum Teilen

## Verfügbare Bausteine

### Sensoren
- Temperatur Sensor
- Bewegungsmelder

### Aktoren
- Licht Schalter
- Generischer Schalter

### Logik
- UND Gatter
- ODER Gatter
- Vergleich
- Verzögerung

### Trigger
- Zeit Trigger
- Status Trigger

## Konfiguration

### Log Level
Setze das Log Level für Debugging:
- `info` (Standard)
- `debug`
- `warning`
- `error`

### SSL
Aktiviere SSL für sichere Verbindungen (optional)

## Support

Bei Problemen oder Fragen erstelle ein Issue auf GitHub.

## Lizenz

MIT License
