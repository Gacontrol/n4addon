# GA-Control - Dokumentation

**keep it simple - by Dr. Muff**

## Übersicht

GA-Control ist ein visueller Flow-Editor für Home Assistant, der es dir ermöglicht, Smart Home Automatisierungen mit grafischen Bausteinen zu erstellen - ähnlich wie Niagara Wiresheet oder Node-RED.

## Erste Schritte

### Installation

1. Öffne Home Assistant
2. Navigiere zu **Einstellungen** > **Add-ons**
3. Klicke auf **ADD-ON STORE** (unten rechts)
4. Füge das Repository hinzu (falls noch nicht geschehen)
5. Suche nach "GA-Control"
6. Klicke auf **INSTALLIEREN**
7. Nach der Installation klicke auf **STARTEN**
8. Aktiviere **Im Seitenleisten anzeigen** für schnellen Zugriff

### Erstes Flow erstellen

1. Öffne GA-Control über die Sidebar
2. Ziehe einen **Bewegungsmelder** aus der Palette auf das Canvas
3. Ziehe einen **Licht Schalter** auf das Canvas
4. Klicke auf den Ausgang des Bewegungsmelders
5. Klicke auf den Eingang des Licht Schalters
6. Verbindung ist erstellt!

## Bausteine im Detail

### Sensoren

Sensoren lesen Daten aus Home Assistant:

- **Temperatur Sensor**: Liefert Temperaturwerte
  - Ausgänge: Wert, Status

- **Bewegungsmelder**: Erkennt Bewegungen
  - Ausgänge: Bewegung (Boolean)

### Aktoren

Aktoren steuern Geräte in Home Assistant:

- **Licht Schalter**: Steuert Lichter
  - Eingänge: Ein/Aus, Helligkeit
  - Ausgänge: Status

- **Schalter**: Generischer Schalter
  - Eingänge: Signal
  - Ausgänge: Status

### Logik-Bausteine

Logik-Bausteine verarbeiten Signale:

- **UND Gatter**: Ausgang ist nur aktiv, wenn beide Eingänge aktiv sind
  - Eingänge: A, B
  - Ausgänge: Ergebnis

- **ODER Gatter**: Ausgang ist aktiv, wenn mindestens ein Eingang aktiv ist
  - Eingänge: A, B
  - Ausgänge: Ergebnis

- **Vergleich**: Vergleicht zwei Werte
  - Eingänge: Wert A, Wert B
  - Ausgänge: Größer, Gleich, Kleiner

- **Verzögerung**: Verzögert ein Signal
  - Eingänge: Signal
  - Ausgänge: Verzögert

### Trigger

Trigger starten Flows:

- **Zeit Trigger**: Startet zu bestimmten Zeiten
  - Ausgänge: Trigger Signal

- **Status Trigger**: Startet bei Statusänderungen
  - Eingänge: Zu überwachender Status
  - Ausgänge: Änderungs-Signal

## Beispiel-Flows

### Licht bei Bewegung

```
Bewegungsmelder → Licht Schalter
```

Wenn Bewegung erkannt wird, schaltet sich das Licht ein.

### Licht nur bei Dunkelheit

```
Bewegungsmelder ──┐
                  ├─→ UND Gatter → Licht Schalter
Helligkeitssensor ┘
```

Licht schaltet nur ein, wenn Bewegung erkannt UND es dunkel ist.

### Zeitverzögerte Abschaltung

```
Bewegungsmelder → Verzögerung → Licht Schalter
```

Licht geht nach einer Verzögerung automatisch aus.

## API Endpoints

Das Addon bietet folgende API Endpoints:

### Flows verwalten

- `GET /api/flows` - Lade gespeicherte Flows
- `POST /api/flows` - Speichere Flows

### Home Assistant Integration

- `GET /api/ha/states` - Alle Entity States
- `GET /api/ha/services` - Verfügbare Services
- `POST /api/ha/services/:domain/:service` - Service aufrufen

### Flow Ausführung

- `POST /api/flows/execute` - Flow ausführen

## Tipps & Tricks

### Canvas Navigation
- **Zoom**: Mausrad oder Pinch-Geste
- **Pan**: Mittlere Maustaste oder Leertaste + Drag
- **Auswahl**: Linksklick auf Node
- **Löschen**: Node auswählen und DELETE drücken

### Verbindungen
- Klicke auf Ausgang (rechte Seite, grün)
- Klicke auf Eingang (linke Seite, blau)
- ESC zum Abbrechen einer Verbindung

### Speichern
- Flows werden automatisch gespeichert
- Nutze Export für manuelle Backups
- Import funktioniert mit JSON-Dateien

## Fehlerbehebung

### Addon startet nicht
- Prüfe die Logs im Addon
- Stelle sicher, dass Port 8099 frei ist

### Keine Verbindung zu Home Assistant
- Prüfe, ob das Addon die richtigen Berechtigungen hat
- Schaue in die Addon-Logs

### Flows werden nicht ausgeführt
- Prüfe die Verbindungen zwischen Bausteinen
- Schaue in die Logs für Fehler

## Erweiterte Konfiguration

### Log Level

Setze das Log Level in den Addon-Optionen:

```yaml
log_level: debug
```

Optionen: `trace`, `debug`, `info`, `warning`, `error`, `fatal`

### SSL

Aktiviere SSL für sichere Verbindungen:

```yaml
ssl: true
certfile: fullchain.pem
keyfile: privkey.pem
```

## Roadmap

Geplante Features:

- [ ] Mehr Bausteine (Klima, Medien, Benachrichtigungen)
- [ ] Subflows und Gruppen
- [ ] Debugging-Modus mit Step-by-Step Ausführung
- [ ] Vorlagen-Bibliothek
- [ ] Flow-Sharing Community
- [ ] Mobile-optimiertes Interface

## Support

Bei Fragen oder Problemen:
- Erstelle ein Issue auf GitHub
- Besuche das Home Assistant Forum
- Schau dir die Community-Flows an
