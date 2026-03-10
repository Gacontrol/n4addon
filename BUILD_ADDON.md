# Wiresheet Addon - Build Anleitung

## Projektstruktur

```
wiresheet-addon/
├── addon/                      # Home Assistant Addon Konfiguration
│   ├── config.json            # Addon Hauptkonfiguration
│   ├── build.json             # Docker Build Konfiguration
│   ├── Dockerfile             # Docker Container Definition
│   ├── README.md              # Addon Beschreibung für HA Store
│   ├── DOCS.md                # Ausführliche Dokumentation
│   ├── CHANGELOG.md           # Versionshistorie
│   ├── icon.png               # Addon Icon (256x256)
│   └── rootfs/                # Container Filesystem
│       ├── run.sh             # Startup Script
│       └── etc/nginx/         # Nginx Konfiguration
│           └── nginx.conf
├── server/                     # Backend API Server
│   └── index.js               # Express Server
├── src/                        # Frontend React App
│   ├── App.tsx
│   ├── components/
│   ├── hooks/
│   ├── types/
│   └── data/
├── dist/                       # Gebautes Frontend (nach npm run build)
└── package.json
```

## Schritt 1: Frontend bauen

```bash
npm install
npm run build
```

Dies erstellt das Frontend im `dist/` Verzeichnis.

## Schritt 2: Addon für lokale Tests vorbereiten

### Option A: Lokales Addon Repository

1. Kopiere den gesamten Projekt-Ordner nach `/addons/wiresheet/`
2. In Home Assistant: **Einstellungen** → **Add-ons** → **ADD-ON STORE**
3. Drei Punkte → **Nach Updates suchen**
4. Das Addon erscheint unter "Lokale Add-ons"

### Option B: Git Repository

1. Erstelle ein GitHub Repository
2. Pushe den Code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/DEIN-USERNAME/wiresheet-addon.git
   git push -u origin main
   ```
3. Füge das Repository in Home Assistant hinzu

## Schritt 3: Addon-Struktur für Home Assistant

Dein Repository sollte diese Struktur haben:

```
repository-root/
└── wiresheet/              # Addon Slug aus config.json
    ├── config.json
    ├── build.json
    ├── Dockerfile
    ├── README.md
    ├── DOCS.md
    ├── CHANGELOG.md
    ├── icon.png
    └── rootfs/
        └── run.sh
```

**WICHTIG**: Der Ordnername muss dem `slug` in `config.json` entsprechen!

## Schritt 4: Docker Image bauen (lokal)

Falls du das Docker Image lokal bauen möchtest:

```bash
cd addon/
docker build \
  --build-arg BUILD_FROM="ghcr.io/home-assistant/amd64-base:3.18" \
  -t wiresheet-addon:latest \
  -f Dockerfile \
  ..
```

## Schritt 5: Icon erstellen

Das Addon benötigt ein Icon (256x256 PNG):

```bash
# Erstelle oder platziere dein Icon
cp your-icon.png addon/icon.png
```

Das Icon sollte:
- 256x256 Pixel sein
- PNG Format
- Transparent oder weißer Hintergrund
- Das Wiresheet Konzept repräsentieren

## Schritt 6: Repository veröffentlichen

### GitHub Repository Setup

1. Erstelle `repository.json` im Repository-Root:

```json
{
  "name": "Wiresheet Add-ons",
  "url": "https://github.com/DEIN-USERNAME/wiresheet-addon",
  "maintainer": "Dein Name"
}
```

2. Erstelle eine README.md im Root:

```markdown
# Wiresheet Add-ons für Home Assistant

## Installation

Füge dieses Repository zu Home Assistant hinzu:

https://github.com/DEIN-USERNAME/wiresheet-addon
```

3. Pushe alles:

```bash
git add .
git commit -m "Add repository config"
git push
```

## Schritt 7: In Home Assistant testen

1. Öffne Home Assistant
2. **Einstellungen** → **Add-ons** → **ADD-ON STORE**
3. Drei Punkte → **Repositories**
4. Füge deine Repository-URL hinzu
5. Suche nach "Wiresheet Flow Editor"
6. Installiere und starte das Addon

## Debugging

### Logs anzeigen

In Home Assistant:
- Navigiere zum Addon
- Tab **Log**
- Setze Log Level auf `debug` in der Konfiguration

### Server Logs

```bash
docker logs addon_<hash>_wiresheet
```

### Frontend neu bauen

Nach Änderungen am Frontend:

```bash
npm run build
# Dann Addon neu starten in Home Assistant
```

### Backend Änderungen

Nach Änderungen am Server:
- Änderungen in `server/index.js` speichern
- Addon in Home Assistant neu starten

## Multi-Architektur Build

Für die Veröffentlichung solltest du Multi-Arch Images bauen:

```bash
docker buildx create --use
docker buildx build \
  --platform linux/amd64,linux/arm64,linux/arm/v7 \
  --build-arg BUILD_FROM="ghcr.io/home-assistant/amd64-base:3.18" \
  -t ghcr.io/DEIN-USERNAME/wiresheet-addon:latest \
  --push \
  .
```

## Veröffentlichung

### Version Update

1. Aktualisiere Version in `addon/config.json`:
```json
{
  "version": "1.0.1"
}
```

2. Update `addon/CHANGELOG.md`

3. Commit und Push:
```bash
git commit -am "Release v1.0.1"
git tag v1.0.1
git push --tags
```

### GitHub Release

1. Gehe zu GitHub Releases
2. Klicke "Create new release"
3. Tag: `v1.0.1`
4. Release notes aus CHANGELOG.md kopieren
5. Veröffentlichen

## Entwicklungs-Workflow

### Frontend Entwicklung

```bash
npm run dev
# Öffne http://localhost:5173
```

### Backend Entwicklung

```bash
cd server
node index.js
# Server läuft auf http://localhost:8100
```

### Full Stack Testing

1. Frontend bauen: `npm run build`
2. Addon in HA neu starten
3. Logs prüfen

## Checkliste vor Release

- [ ] Frontend gebaut (`npm run build`)
- [ ] Version in `config.json` aktualisiert
- [ ] CHANGELOG.md aktualisiert
- [ ] README.md vollständig
- [ ] DOCS.md vollständig
- [ ] Icon vorhanden (256x256)
- [ ] Addon lokal getestet
- [ ] Alle Features funktionieren
- [ ] API Endpoints testen
- [ ] Home Assistant Integration testen
- [ ] Dokumentation aktualisiert

## Häufige Probleme

### "Addon not found"
- Prüfe Ordnername = slug in config.json
- Repository URL korrekt?

### "Build failed"
- Prüfe Dockerfile Syntax
- Sind alle Dependencies in package.json?
- Ist dist/ Ordner vorhanden?

### "Port already in use"
- Ändere Port in config.json
- Prüfe ob Port 8099 frei ist

### "Permission denied"
- run.sh ausführbar machen: `chmod +x addon/rootfs/run.sh`

## Weiterführende Links

- [Home Assistant Addon Development](https://developers.home-assistant.io/docs/add-ons)
- [Addon Configuration](https://developers.home-assistant.io/docs/add-ons/configuration)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
