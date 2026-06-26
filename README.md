# Alphatron GeoSnap Mobile

Alphatron GeoSnap Mobile is een mobiele Android-applicatie gebouwd met **Capacitor** en HTML/CSS/JS (Vanilla) voor het uitvoeren van camera schouwen en het plaatsen van camera-cones op een kaart.

## Functionaliteiten
- **Locatiemodus**: Gebruikt de camera van de telefoon om referentiefoto's en parkeersituaties vast te leggen.
- **Beeldmodus**: Haalt live beelden op van een UNV (Uniview) camera op basis van IP, gebruikersnaam en wachtwoord.
- **GPS-integratie**: Slaat de exacte coördinaten (latitude, longitude, nauwkeurigheid) op bij elke gemaakte foto.
- **Kaart & Camera Cones**: Toont gemaakte foto's op een Leaflet-kaart (met ArcGIS satellietbeelden) en laat je de kijkrichting (heading), beeldhoek (fov) en bereik (range) van de camera visueel instellen via schuifregelaars.
- **IndexedDB Opslag**: Alle sessies en foto's worden lokaal opgeslagen in de browser database van het apparaat (geen server-verbinding vereist tijdens de schouw).
- **ZIP-export**: Exporteert de volledige sessie (inclusief alle beelden en metadata in een JSON/CSV structuur) als een ZIP-bestand.

## Projectstructuur
- `public/`: Bevat de web-frontend (HTML, CSS, JS).
  - `index.html`: De hoofdinterface.
  - `style.css`: De vormgeving (sleek dark mode, flexibele rasters).
  - `js/`: Bevat de modulaire JavaScript-bestanden (`app-core.js`, `app-camera.js`, `app-map.js`, etc.).
  - `vendor/`: Externe bibliotheken (Leaflet voor kaarten, JSZip voor ZIP-creatie).
- `capacitor.config.json`: De configuratie voor de Capacitor runtime.
- `package.json`: Node afhankelijkheden en scripts.

## Lokale Ontwikkeling

### 1. Afhankelijkheden installeren
Zorg ervoor dat je [Node.js](https://nodejs.org/) hebt geïnstalleerd en voer uit:
```bash
npm install
```

### 2. Live testen in de browser
Omdat het een pure webapp is, kun je de `public/index.html` direct openen in een browser (bijvoorbeeld met een VS Code Live Server extensie of een simpele HTTP server):
```bash
npx http-server public
```

### 3. Android Bouwen
Om het project weer in een Android-app (APK) te compileren met Capacitor:
```bash
# Voeg het Android-platform toe (indien nog niet aanwezig)
npx cap add android

# Synchroniseer de web-assets met de Android app
npx cap sync

# Open het project in Android Studio om een debug/release APK te genereren
npx cap open android
```
