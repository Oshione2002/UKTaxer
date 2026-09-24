# UKTaxer

UKTaxer is a source-linked, browser-side UK tax estimator for the 2026–27 tax year. It covers defined salary, sole trader, dividend, capital gains, VAT, corporation, residential property and simple inheritance scenarios across the four UK nations. Complex facts return **review needed**.

## Run

```sh
npm install
npm run dev
npm run check
```

The checked-in `public/law` corpus contains the complete provision text for each in-scope document, searchable indexes and a manifest with retrieval dates and SHA-256 hashes of the official XML. `npm run law:sync` refreshes it from legislation.gov.uk. Raw XML is retained only in the ignored local `.law-cache` directory. **Do not run law:sync as an automatic release step:** review the official changes, register, calculations and tests before publishing a new ruleset.

## Sources and release control

`rules/ruleset-2026.1.json` records jurisdiction, effective dates, rates and official source links. Calculator outputs contain assumptions and source links. The legal library is an offline reference copy; legislation.gov.uk may have outstanding changes, so the official page should be checked for current effect. Public sector text is licensed under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).

The Gemini endpoint is a Vercel serverless function. Set `GEMINI_API_KEY` as a Vercel server-side environment variable to activate the helper. The key must not be placed in Vite variables or committed. The app's deterministic estimates do not depend on Gemini.

## Scope

Estimates are illustrative and tied to the assumptions displayed in each result. The calculators are not filing software and do not cover every relief, election, tax code, special rate, treaty, ownership structure or historical period. Reference-only topics remain discoverable through the law library. A new tax year or legal change requires a reviewed ruleset release.
