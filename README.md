# UKTaxer

UKTaxer adapts [NTaxer](https://github.com/Oshione2002/NTaxer) at commit `cc2e43c` to current UK tax scenarios. It keeps the NTaxer sidebar, 24-workspace structure, immediate results, report tabs, statement review, law reader, install flow and AI control. The design uses navy, red and white.

## Run and check

```sh
npm test
npm run build
python -m http.server 8000 -d release
```

Open `http://localhost:8000`. API routes require a Vercel server or `vercel dev`; set `GEMINI_API_KEY` server-side for the AI and statement analysis. The calculators, exports and law reader run locally without that key.

## Rules and scope

The fixed ruleset is `UK-2026.1`, reviewed 25 September 2026. Calculators cover six individual, four business, four transaction, three relief and seven specialist positions. Amounts are estimates; workspaces that need verified statutory profit, eligibility or estate facts display **Review needed** until those facts are supplied. Choose the relevant UK nation in the header for location-sensitive calculations.

The local law library stores extracted provision text and official links for 34 in-scope Acts and regulations, with retrieval dates and XML checksums in `dist/law/manifest.json`. Current rates are linked to official HMRC, Scottish and Welsh authority pages from each calculator. A future legal or rate change requires a reviewed ruleset release.

Statement files are sent to the server-side Gemini route only after the person chooses Analyse statements. The app shows extracted rows and field mappings for review before filling a calculator. AI never supplies a new tax figure in place of the deterministic engine.

## Deploy

The repository is configured as a separate Vercel static app with Node API routes. Run `npm run check`, deploy a preview, verify it, then promote the separate UKTaxer project. Configure `GEMINI_API_KEY` and optionally `GEMINI_MODEL` in Vercel environment variables; do not place keys in browser code.
