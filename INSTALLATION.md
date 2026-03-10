# Wiresheet Flow Editor - Installation

## Voraussetzungen

- Home Assistant OS, Supervised oder Container Installation
- Supervisor muss verfügbar sein
- Mindestens 512 MB freier RAM

## Installations-Methoden

### Methode 1: Über das Home Assistant Add-on Store (Empfohlen)

**Schritt 1: Repository hinzufügen**

1. Öffne Home Assistant
2. Navigiere zu **Einstellungen** → **Add-ons** → **ADD-ON STORE**
3. Klicke auf die drei Punkte (⋮) oben rechts
4. Wähle **Repositories**
5. Füge diese URL hinzu:
   ```
   https://github.com/DEIN-USERNAME/wiresheet-addon
   ```
6. Klicke auf **HINZUFÜGEN**

**Schritt 2: Addon installieren**

1. Aktualisiere die Add-on Liste
2. Suche nach "Wiresheet Flow Editor"
3. Klicke auf das Addon
4. Klicke auf **INSTALLIEREN**
5. Warte bis die Installation abgeschlossen ist

**Schritt 3: Addon starten**

1. Nach der Installation klicke auf **STARTEN**
2. Warte bis das Addon gestartet ist (grüner Status)
3. Optional: Aktiviere **Im Seitenleisten anzeigen**
4. Optional: Aktiviere **Beim Start von Home Assistant starten**

**Schritt 4: Addon öffnen**

1. Klicke auf **WEB UI ÖFFNEN** oder
2. Nutze die Sidebar falls aktiviert

### Methode 2: Lokale Installation für Entwicklung

**Schritt 1: Repository klonen**

```bash
cd /addons
git clone https://github.com/DEIN-USERNAME/wiresheet-addon
```

**Schritt 2: Addon in Home Assistant hinzufügen**

1. Öffne Home Assistant
2. Navigiere zu **Einstellungen** → **Add-ons**
3. Klicke auf **ADD-ON STORE** → drei Punkte → **Nach Updates suchen**
4. Das Wiresheet Addon sollte jetzt unter "Lokale Add-ons" erscheinen

**Schritt 3: Installieren und Starten**

Folge den Schritten aus Methode 1, ab Schritt 2

## Konfiguration

### Basis-Konfiguration

Das Addon funktioniert out-of-the-box ohne zusätzliche Konfiguration.

### Erweiterte Optionen

Navigiere zu **Einstellungen** → **Add-ons** → **Wiresheet Flow Editor** → **Konfiguration**

**Log Level**
```yaml
log_level: info
```
Optionen: `trace`, `debug`, `info`, `warning`, `error`, `fatal`

**SSL (Optional)**
```yaml
ssl: true
certfile: fullchain.pem
keyfile: privkey.pem
```

### Netzwerk

Das Addon nutzt standardmäßig Port 8099. Dieser kann in der Netzwerk-Konfiguration geändert werden:

1. Navigiere zu **Konfiguration** Tab
2. Bearbeite den Port unter **Netzwerk**
3. Speichere die Änderungen
4. Starte das Addon neu

## Post-Installation

### Ingress verwenden (Empfohlen)

Ingress ermöglicht den Zugriff auf Wiresheet über die Home Assistant UI ohne zusätzliche Ports:

1. Das Addon nutzt automatisch Ingress
2. Klicke einfach auf **WEB UI ÖFFNEN**
3. Oder nutze die Sidebar

### Direkter Zugriff

Falls du direkten Zugriff bevorzugst:

```
http://HOMEASSISTANT-IP:8099
```

Ersetze `HOMEASSISTANT-IP` mit der IP deines Home Assistant Systems.

## Erste Schritte

1. Öffne das Wiresheet Web UI
2. Ziehe einen Baustein aus der linken Palette auf das Canvas
3. Verbinde Bausteine durch Klicken auf Ausgänge und Eingänge
4. Klicke auf "Ausführen" um deinen Flow zu testen
5. Flows werden automatisch gespeichert

## Upgrade

1. Navigiere zu **Einstellungen** → **Add-ons** → **Wiresheet Flow Editor**
2. Klicke auf den **Update** Button (falls verfügbar)
3. Warte bis das Update abgeschlossen ist
4. Starte das Addon neu

Deine Flows bleiben beim Update erhalten.

## Deinstallation

**ACHTUNG: Dies löscht alle gespeicherten Flows!**

1. Exportiere deine Flows über den Export-Button
2. Navigiere zu **Einstellungen** → **Add-ons** → **Wiresheet Flow Editor**
3. Stoppe das Addon
4. Klicke auf **DEINSTALLIEREN**
5. Bestätige die Deinstallation

## Troubleshooting

### Addon startet nicht

**Problem**: Addon Status zeigt Fehler

**Lösung**:
1. Prüfe die Logs: **Log** Tab im Addon
2. Stelle sicher, dass Port 8099 frei ist
3. Prüfe ob genug RAM verfügbar ist
4. Starte das Addon neu

### Kein Zugriff auf Web UI

**Problem**: Web UI lädt nicht

**Lösung**:
1. Prüfe ob das Addon läuft (Status: grün)
2. Versuche den direkten Zugriff über IP:Port
3. Prüfe die Browser-Konsole auf Fehler
4. Leere den Browser-Cache

### Flows werden nicht gespeichert

**Problem**: Änderungen gehen verloren

**Lösung**:
1. Prüfe die Logs auf Fehler
2. Stelle sicher, dass `/data` beschreibbar ist
3. Prüfe die Addon-Berechtigungen

### Keine Verbindung zu Home Assistant

**Problem**: Home Assistant Entities nicht verfügbar

**Lösung**:
1. Prüfe ob `homeassistant_api: true` in config.json
2. Schaue in die Logs nach API-Fehlern
3. Starte das Addon neu

## Support

Bei weiteren Problemen:

- **GitHub Issues**: https://github.com/DEIN-USERNAME/wiresheet-addon/issues
- **Home Assistant Forum**: Community-Thread
- **Dokumentation**: Siehe DOCS.md

## Systemanforderungen

| Komponente | Minimum | Empfohlen |
|------------|---------|-----------|
| RAM | 256 MB | 512 MB |
| Storage | 100 MB | 200 MB |
| CPU | 1 Core | 2+ Cores |

## Unterstützte Architekturen

- aarch64 (Raspberry Pi 3/4, 64-bit)
- amd64 (Intel/AMD 64-bit)
- armhf (Raspberry Pi 2/3, 32-bit)
- armv7 (Raspberry Pi 3/4, 32-bit)
- i386 (Intel/AMD 32-bit)

## Sicherheit

- Das Addon nutzt Home Assistant's Authentifizierung
- Ingress ist standardmäßig aktiviert
- API Calls nutzen den Supervisor Token
- Keine Ports müssen extern geöffnet werden
