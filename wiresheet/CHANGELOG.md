# Changelog

## [1.0.6] - 2026-03-15

### Geaendert
- 3D-Ansicht auf Three.js / React Three Fiber umgestellt (echte WebGL-Schatten, PBR-Materialien)
- Dockerfile: NODE_OPTIONS fuer stabile Builds auf ARM-Geraeten mit wenig RAM

## [1.0.5] - 2026-03-14

### Geaendert
- Bugfixes und Verbesserungen

## [1.0.4] - 2026-03-12

### Geaendert
- Umbenennung zu GA-Control

## [1.0.0] - 2026-03-10

### Hinzugefügt
- Visueller Flow-Editor mit Drag & Drop Interface
- 10 verschiedene Bausteine (Sensoren, Aktoren, Logik, Trigger)
- Verbindungssystem zum Verknüpfen von Bausteinen
- Home Assistant API Integration
- Persistente Speicherung von Flows
- Export/Import Funktionalität
- Web UI mit modernem Design
- Automatische Speicherung
- Properties Panel für Bausteine
- Footer mit Statistiken
- Deutsche Lokalisierung

### Features
- Sensoren: Temperatur, Bewegung
- Aktoren: Licht, Schalter
- Logik: UND, ODER, Vergleich, Verzögerung
- Trigger: Zeit, Status
- Ingress Support für nahtlose HA Integration
- Panel Icon und Titel
- Responsive Design

### Technisch
- Node.js Backend mit Express
- React Frontend mit TypeScript
- Nginx als Reverse Proxy
- Docker Container
- Multi-Architektur Support (aarch64, amd64, armhf, armv7, i386)
