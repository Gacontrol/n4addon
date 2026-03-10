# Home Assistant Addon Repository Struktur

## Wichtig: Korrekte Verzeichnisstruktur

Für GitHub muss dein Repository diese Struktur haben:

```
n4addon/                          # Dein GitHub Repository
├── README.md                     # Repository Beschreibung
├── repository.json               # Repository Konfiguration
├── LICENSE
└── wiresheet/                    # Addon-Ordner (Name = slug aus config.json)
    ├── config.json              # PFLICHT: Addon Hauptkonfiguration
    ├── build.json               # PFLICHT: Build Konfiguration
    ├── Dockerfile               # PFLICHT: Container Definition
    ├── README.md                # PFLICHT: Addon Beschreibung
    ├── DOCS.md                  # OPTIONAL: Ausführliche Dokumentation
    ├── CHANGELOG.md             # OPTIONAL: Versionshistorie
    ├── icon.png                 # OPTIONAL: Addon Icon (256x256)
    └── rootfs/                  # PFLICHT: Container Root Filesystem
        ├── run.sh               # Startup Script
        └── etc/
            └── nginx/
                └── nginx.conf

# Diese Dateien/Ordner werden beim Build kopiert:
dist/                            # Gebautes Frontend (wird in Container kopiert)
server/                          # Backend Code (wird in Container kopiert)
package.json                     # Dependencies (wird in Container kopiert)
package-lock.json               # Lock file (wird in Container kopiert)
```

## Schritt für Schritt: GitHub Repository erstellen

### 1. Lokales Repository vorbereiten

```bash
cd /tmp/cc-agent/64524280/project

# Stelle sicher, dass dist/ existiert
npm run build

# Initialisiere Git (falls noch nicht geschehen)
git init

# Füge alle Dateien hinzu
git add .
git commit -m "Initial commit: Wiresheet Flow Editor Addon"
```

### 2. GitHub Repository erstellen

1. Gehe zu https://github.com
2. Klicke auf "New repository"
3. Repository Name: `n4addon`
4. Description: "Wiresheet Flow Editor - Visual flow editor for Home Assistant"
5. Public Repository
6. NICHT "Initialize with README" ankreuzen
7. Klicke "Create repository"

### 3. Code zu GitHub pushen

```bash
# Füge Remote hinzu
git remote add origin https://github.com/Gacontrol/n4addon.git

# Push zum Repository
git branch -M main
git push -u origin main
```

### 4. In Home Assistant hinzufügen

**Variante A: Mit Button**

Öffne diese URL in deinem Browser (während du in Home Assistant eingeloggt bist):
```
https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FGacontrol%2Fn4addon
```

**Variante B: Manuell**

1. Öffne Home Assistant
2. **Einstellungen** → **Add-ons** → **ADD-ON STORE**
3. Drei Punkte (⋮) oben rechts → **Repositories**
4. Füge hinzu:
   ```
   https://github.com/Gacontrol/n4addon
   ```
5. Klicke **HINZUFÜGEN**

### 5. Addon installieren

1. Gehe zurück zum **ADD-ON STORE**
2. Scrolle nach unten zu "Wiresheet Add-ons"
3. Klicke auf "Wiresheet Flow Editor"
4. Klicke **INSTALLIEREN**
5. Warte bis Installation abgeschlossen ist
6. Klicke **STARTEN**

## Wichtige Dateien erklärt

### repository.json (im Root)
Beschreibt dein Addon-Repository:
```json
{
  "name": "Wiresheet Add-ons",
  "url": "https://github.com/Gacontrol/n4addon",
  "maintainer": "Dein Name"
}
```

### wiresheet/config.json
Hauptkonfiguration des Addons:
- `slug`: Muss mit Ordnername übereinstimmen!
- `name`: Anzeigename
- `version`: Versionsnummer
- `arch`: Unterstützte Architekturen
- `ports`: Verwendete Ports
- `ingress`: true = Integration in HA UI

### wiresheet/Dockerfile
Definiert wie der Container gebaut wird:
- Installiert Node.js, npm, nginx
- Kopiert dist/, server/, package.json
- Startet run.sh beim Container-Start

### wiresheet/rootfs/run.sh
Startup-Script das beim Container-Start ausgeführt wird:
- Liest Konfiguration
- Startet Node.js Backend
- Startet Nginx Frontend-Server

## Häufige Fehler

### "is not a valid add-on repository"

**Ursachen:**
- ❌ Kein `repository.json` im Repository-Root
- ❌ Addon-Ordner hat falschen Namen (muss = slug in config.json sein)
- ❌ Keine `config.json` im Addon-Ordner
- ❌ Repository ist privat (muss public sein)

**Lösung:**
```bash
# Prüfe Struktur
n4addon/
├── repository.json    # ← Muss hier sein!
└── wiresheet/         # ← Name muss = slug sein
    └── config.json    # ← Muss hier sein!
```

### "Addon not found after adding repository"

**Ursachen:**
- Addon-Ordner hat falschen Namen
- config.json fehlt oder ist fehlerhaft

**Lösung:**
- Prüfe dass Ordnername = slug in config.json
- Validiere config.json (JSON Syntax)

### "Build failed"

**Ursachen:**
- dist/ Ordner fehlt
- package.json fehlt
- Dockerfile fehlerhaft

**Lösung:**
```bash
# Baue Frontend neu
npm run build

# Pushe zu GitHub
git add dist/
git commit -m "Add built frontend"
git push
```

## Deployment Checklist

Vor dem Push zu GitHub:

- [ ] `npm run build` ausgeführt
- [ ] `wiresheet/` Ordner existiert mit allen Dateien
- [ ] `repository.json` im Root vorhanden
- [ ] README.md im Root vorhanden
- [ ] Icon erstellt (wiresheet/icon.png)
- [ ] Version in config.json aktualisiert
- [ ] CHANGELOG.md aktualisiert
- [ ] Git initialisiert und committed
- [ ] GitHub Repository erstellt (public)
- [ ] Code gepushed

## Nach dem Push

1. Warte 1-2 Minuten (GitHub Cache)
2. Füge Repository in Home Assistant hinzu
3. Aktualisiere Addon Store (drei Punkte → Nach Updates suchen)
4. Addon sollte erscheinen

## Updates veröffentlichen

1. Ändere Code
2. `npm run build` (falls Frontend geändert)
3. Update Version in `wiresheet/config.json`
4. Update `wiresheet/CHANGELOG.md`
5. Commit und Push:
   ```bash
   git add .
   git commit -m "Release v1.0.1"
   git tag v1.0.1
   git push --tags
   git push
   ```
6. In Home Assistant: Addon Store → Nach Updates suchen

## Weitere Ressourcen

- [Home Assistant Addon Tutorial](https://developers.home-assistant.io/docs/add-ons/tutorial)
- [Addon Configuration](https://developers.home-assistant.io/docs/add-ons/configuration)
- [Repository Format](https://developers.home-assistant.io/docs/add-ons/repository)
