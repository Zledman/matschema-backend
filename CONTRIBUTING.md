# Contributing Guidelines

Tack för att du vill bidra till **Matschema Projekt**!  
Den här guiden beskriver hur vi arbetar, vilka standarder vi följer och hur du kan bidra på bästa sätt.

---

## 📂 Branch-strategi

- **main** – alltid stabil, grön CI, redo för release.
- **feature/*** – nya funktioner.  
  Exempel: `feature/add-user-auth`
- **fix/*** – bugfixar.  
  Exempel: `fix/login-redirect`
- **chore/*** – underhåll, verktyg, dokumentation.  
  Exempel: `chore/update-deps`

> Skapa alltid en ny branch från `main` och gör en Pull Request tillbaka till `main`.

---

## 📝 Commit-meddelanden

Vi följer [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <kort beskrivning>

[Valfri längre beskrivning]
[Valfria breaking changes]
[Valfria issues som stängs]
```

**Vanliga typer:**
- `feat` – ny funktion
- `fix` – bugfix
- `chore` – underhåll, verktyg, CI
- `docs` – dokumentation
- `style` – kodformat (ingen logikändring)
- `refactor` – kodomstrukturering utan ny funktion eller fix
- `test` – tester

**Exempel:**
```
feat(auth): add JWT refresh token support
fix(api): handle null values in seasonService
chore(ci): add Node 18/20 matrix to lint workflow
```

---

## 🛠 Lokalt arbetsflöde

1. **Klona repot**  
   ```bash
   git clone https://github.com/<user>/<repo>.git
   cd <repo>
   ```

2. **Installera beroenden**  
   ```bash
   npm install
   ```

3. **Kör lint**  
   ```bash
   npm run lint
   ```

4. **Kör tester**  
   ```bash
   npm test
   ```

> **Tips:** Pre‑commit‑hooken kör automatiskt lint och tester på ändrade filer via `lint-staged` och `commitlint`.

---

## ✅ Pull Request-checklista

- [ ] Koden bygger och alla tester passerar lokalt.
- [ ] Lint är grön utan varningar/fel.
- [ ] Commit‑meddelanden följer Conventional Commits.
- [ ] PR‑beskrivningen förklarar ändringen och ev. breaking changes.
- [ ] Dokumentation uppdaterad vid behov.

---

## 📜 Licens

Genom att bidra godkänner du att ditt bidrag licensieras under projektets befintliga licens.
