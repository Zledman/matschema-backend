# Matschema Backend

[Läs våra riktlinjer för att bidra](CONTRIBUTING.md)

[![CI](https://github.com/SimonDev/matschema-projekt/actions/workflows/ci.yml/badge.svg)](https://github.com/SimonDev/matschema-projekt/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/SimonDev/matschema-projekt/branch/main/graph/badge.svg)](https://codecov.io/gh/SimonDev/matschema-projekt)
[![Lint & Build](https://github.com/SimonDev/matschema-projekt/actions/workflows/lint-build.yml/badge.svg)](https://github.com/SimonDev/matschema-projekt/actions/workflows/lint-build.yml)
![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![Node Versions](https://img.shields.io/badge/node-18.x%20|%2020.x-brightgreen)

## 🚀 Översikt

Detta är backend för Matschema-projektet byggt med Express (CommonJS), Mongoose och ett modulärt lager (controllers, services, models, middleware).

## 📦 API Response Format

Alla svar formas enligt ett standardiserat format via global middleware (`responseWrapper`).

### Struktur

- `success`: boolean
- `data`: objekt eller värde vid lyckad förfrågan
- `errors`: lista av felobjekt `{ message, path? }` vid misslyckad förfrågan

Endast ETT av `data` eller `errors` förekommer i ett svar. Manuella svar kan använda helpers i `utils/response.js` (`sendSuccess`, `sendError`, `sendMessage`), men även direkta `res.json({...})` passerar genom wrappern och normaliseras.

### Exempel

#### Lyckad login

````json
{
  ### Manuellt städa revoked tokens

  ## 🧹 Cleanup-kommandot (pino)

  Cleanup-scriptet (`backend/scripts/cleanup.js`) använder **pino** för strukturerad loggning.

  **Funktioner:**
  - Loggfil: `backend/logs/cleanup.log` (JSONL, en rad per körning)
  - Rotation vid > **5 MB** (rotation sker innan pino-destination initieras)
  - Misslyckad rotation loggas som `warn` och stoppar inte körningen
  - `--json` skriver exakt EN JSON-rad till stdout (fil-loggning sker ändå)
  - `--dry-run` inkluderar fältet `tokens` med detaljer

  ### Kommandon
  ```bash
  # Standard (8 dagar)
Svar (user):

  # Anpassat intervall
  npm run cleanup -- --days=5

  # Dry-run (ingen radering)


  # JSON-läge (ren maskinläsbar output)
```json

  # Kombinerat
  npm run cleanup -- --days=5 --dry-run --json
````

### JSON-läge (`--json`)

En enda rad JSON med fält:
`ts`, `mode` (`live`|`dry-run`), `daysOlder`, `removedCount`, `tokens[]` (endast vid dry-run & om data finns).

Exempel (dry-run + json):

```json
{
  "ts": "2025-09-21T12:34:56.789Z",
  "mode": "dry-run",
  "daysOlder": 5,
  "removedCount": 2,
  "tokens": [
    { "id": "abc", "type": "access", "revokedAt": "2025-09-15T10:11:12.000Z" },
    { "id": "def", "type": "refresh", "revokedAt": "2025-09-14T08:09:10.000Z" }
  ]
}
```

Live-läge saknar `tokens`.

### Loggfilsexempel

```json
{
  "ts": "2025-09-21T12:34:56.789Z",
  "mode": "live",
  "daysOlder": 8,
  "removedCount": 3
}
```

### Rotation

När storlek >5MB:

1. `cleanup.log` försöker döpas om till `cleanup-<timestamp>.log`
2. Ny `cleanup.log` skapas
3. Fel vid `renameSync` => `logger.warn({ err }, "Cleanup log rotation rename failed")`

### Testning

```bash
cd backend
npm run test:cleanup      # JSON + rotation + felhantering
npm run test:coverage     # alla tester
```

Tester täcker:

- JSON-utdata (1 rad)
- Rotation i både live & json/dry-run
- Fel på `renameSync` och `mkdirSync` utan avbrott
  { "success": false, "errors": [{ "message": "Forbidden: insufficient role" }] }

````

### Roll i access token

Access token payload innehåller: `{ id, role, iat, exp }` vilket gör att roll kan läsas utan extra DB-anrop för enklare auktorisering.

### Tokenrevokering vid rollnedgradering

När en `admin` nedgraderas till `user` blir alla tidigare utfärdade access OCH refresh tokens ogiltiga.

**Mekanism (Access & Refresh):**

1. Access token JTI lagras i `user.activeTokenJtis`. Refresh token JTI lagras i `user.activeRefreshTokenJtis`.
2. Vid nedgradering (`PATCH /api/users/:id/role` från admin -> user) flyttas samtliga JTI från båda listorna till `RevokedToken` med fältet `tokenType` (`access` eller `refresh`).
3. `authMiddleware` kontrollerar access JTIs (`tokenType=access`). Refresh endpoint (`/api/auth/refresh`) använder `verifyToken(..., 'refresh')` och kontrollerar både `RevokedToken` och att JTI fortfarande finns kvar i `user.activeRefreshTokenJtis`.
4. Vid logout revokeras den aktuella refresh token JTI:n och tas bort från användarens lista.
5. Försök att använda en revokerad access eller refresh token returnerar `401` med `Token revoked`.

Detta säkerställer att en tidigare admin varken kan uppdatera access tokens via refresh eller fortsätta använda gamla access tokens.

### Rekommenderade framtida förbättringar

- TTL-index på `RevokedToken` för automatisk städning efter token-expiry.
- Audit-logg av rolländringar.
- Finkornigare permissions-lager (policy-baserat).

### RevokedToken städning

Ett TTL-index (`revokedAt` -> 8 dagar) tar automatiskt bort gamla poster. Som fallback finns en util:

```js
const { cleanupRevokedTokens } = require("./utils/cleanupRevokedTokens");
await cleanupRevokedTokens(); // tar bort poster äldre än 8 dagar
````

En scheduler (`cron/cleanup.js`) kör daglig städning efter en initial fördröjning (5 min) när servern startar.

## 🧪 Testscript

Se `backend/test/test-auth.ps1` för automatiserat flöde (register → login → profil → valideringsfel → ogiltig token → refresh → logout).

## ▶️ Körning

```bash
cd backend
npm install
npm run dev
```

### Manuellt städa revoked tokens

Engångskörning (fallback till TTL-index):

```bash
cd backend
npm run cleanup
```

Med parameter för annat intervall (t.ex. 10 dagar):

```bash
npm run cleanup -- --days=10
```

Exempel output:

```
[Cleanup] Connected to database
[Cleanup] Removed 3 revoked tokens older than 8 days
```

Dry-run (visar vad som skulle tas bort utan att radera):

```bash
npm run cleanup -- --days=5 --dry-run
```

Strukturerat JSON-utdata (maskinvänligt) med `--json` (endast en rad JSON till stdout):

```bash
npm run cleanup -- --json
```

Kombinera med `--dry-run` för att få lista över vilka token-poster som skulle raderas:

```bash
npm run cleanup -- --days=5 --dry-run --json
```

Exempel på JSON-utdata (`--dry-run --json`):

```json
{
  "ts": "2025-09-20T13:45:12.123Z",
  "mode": "dry-run",
  "daysOlder": 5,
  "removedCount": 2,
  "tokens": [
    {
      "id": "abc123",
      "type": "access",
      "revokedAt": "2025-09-10T11:22:33.444Z"
    },
    {
      "id": "def456",
      "type": "refresh",
      "revokedAt": "2025-09-09T09:10:11.222Z"
    }
  ]
}
```

I live-läge (`--json` utan `--dry-run`) saknas fältet `tokens`.

Loggfil skrivs till `backend/logs/cleanup.log` i JSONL-format (en rad per körning) med fält:

```json
{
  "ts": "2025-09-20T12:34:56.789Z",
  "mode": "dry-run",
  "daysOlder": 5,
  "removedCount": 2,
  "tokens": [{ "id": "...", "type": "access" }]
}
```

### Loggrotation

När `cleanup.log` överstiger 5 MB roteras den automatiskt genom att filen döps om till `cleanup-YYYY-MM-DDTHH-MM-SS-sssZ.log` (ISO-tidsstämpel med kolon och punkt ersatta) innan en ny `cleanup.log` skapas/appenderas. Detta sker oavsett om `--json` används eller inte.

Servern startar på port `4000` (eller `PORT` i `.env`).

## 🧪 Utvecklartester (Cleanup-scriptet)

Det finns dedikerade Jest-tester för städscriptet (`scripts/cleanup.js`).

### Test: JSON-utdata & loggrotation

Fil: `backend/test/cleanup-json-rotation.test.js`

Verifierar att:

- `--json` ger exakt en rad giltig JSON utan extra brus.
- `--dry-run --json` inkluderar `tokens`-array med `id`, `type`, `revokedAt`.
- Loggrotation (>5MB) skapar `cleanup-<timestamp>.log` och skriver ny `cleanup.log`.
- Rotation fungerar både i normalt läge och JSON-läge.

Kör så här:

```bash
cd backend
npx jest --runInBand test/cleanup-json-rotation.test.js
```

Isolerad körning: testet använder miljövariabler (`CLEANUP_SKIP_DB=1`, `CLEANUP_LOG_DIR=test/logs-test`) och mockar resultatet via `MOCK_CLEANUP_RET` – ingen riktig DB-anslutning sker och loggar hamnar i en temporär katalog.

### (Kommande) Felhanteringstest

Felhantering för loggrotation finns implementerat i:

`backend/test/cleanup-rotation-error.test.js`

Det testar två scenarier:

1. Misslyckad filrotation (`renameSync` kastar fel) – scriptet faller tillbaka utan att krascha.
2. Misslyckad katalogskapning (`mkdirSync` kastar fel) – scriptet hanterar felet tyst.

Kör båda cleanup-relaterade testerna tillsammans:

```bash
cd backend
npm run test:cleanup
```

## 🗂 Struktur (förenklad)

```
backend/
  config/
  controllers/
  middleware/
  models/
  routes/
  services/
  utils/
```

## 📌 Nästa steg (förslag)

- Rollbaserad åtkomst
- Rate limit per IP på fler endpoints
- Central loggning (pino/winston)
- Integrationstester (Jest) mot auth-flödet
- Dockerfile + CI

---

_Lycka till med vidareutvecklingen!_

## 🛠 Utvecklarworkflow

Detta projekt använder:
- **Husky** för pre-commit hooks
- **lint-staged** för att bara lint:a ändrade filer
- **commitlint** för att säkerställa Conventional Commits
- **ESLint** med strikt konfiguration
- **Jest** för tester med coverage

### Lokalt flöde
1. Skapa en ny branch från `main` (`feat/*`, `fix/*`, `chore/*`).
2. Kör `npm install` i `backend/` vid behov.
3. Kör `npm run lint` för att säkerställa stil och regler.
4. Kör `npm test` (`jest --coverage`).
5. Gör dina commits – hookarna kör automatiskt lint-staged + commitlint.
6. Skicka Pull Request → CI måste vara grön innan merge.

### Commit-format (sammanfattning)
`<type>(<scope>): <beskrivning>` – ex: `feat(auth): add refresh token rotation`.

### Vanliga script
```bash
cd backend
npm run lint
npm test
npm run cleanup -- --dry-run --json
```

### Kodstil & kvalitet
- Zero warnings policy (`--max-warnings=0`).
- Alla tokens revokeras korrekt vid rollnedgradering (testtäckning finns).
- Cleanup-script testas för JSON, rotation och felhantering.

### Rek. innan PR
- Uppdatera dokumentation vid nya endpoints.
- Lägg till tester för ny logik.
- Håll commits små och fokuserade.
