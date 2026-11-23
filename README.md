# HaqSetu AI

**Making government-assistance discovery easier to understand and organize.**

HaqSetu AI is a multilingual web application prototype that helps users describe their circumstances, explore **illustrative** assistance-scheme matches, review document checklists, and track application progress in one place.

> **Important:** The schemes in the current demo dataset are **fictional examples**, not verified government programs. Eligibility suggestions, documents, and benefits shown in the prototype are for demonstration only. Do not use this demo to make real-world application or financial decisions.

## The problem

People seeking assistance may struggle to understand eligibility criteria, compare options, identify required documents, and remember the status of multiple applications. Language barriers can make these steps even harder.

## Our approach

HaqSetu AI brings the discovery and organization workflow into a single, approachable interface:

1. **Describe your situation:** Enter profile details or a short personal description.
2. **Explore suggested matches:** Review potential matches against the prototype's sample dataset.
3. **Prepare documents:** See an example checklist for each scheme.
4. **Track progress:** Save items and update their application status.
5. **Return later:** Locally stored data can restore a previous session, with an indication when results may be outdated.

## Features

- Profile and free-text story input
- Rule-based eligibility matching against demo schemes
- Scheme result cards and example document checklists
- Application tracker with statuses and progress indicators
- Local browser persistence for profile, results, and tracking information
- Outdated-results notice and demo-data erase option
- Multilingual interface: **English, Kannada, Hindi, Tamil, Telugu, Malayalam, and Marathi**
- Responsive layouts for desktop and mobile
- Progressive Web App (PWA) support

**Translation note:** Interface language coverage may differ from the language used for individual scheme titles and document labels in the demo dataset.

## Technology

- **Frontend:** HTML, CSS, JavaScript
- **Backend/local server:** Node.js
- **Data:** JSON-based demo schemes and UI translations
- **Browser storage:** `localStorage`
- **Development environment:** CodeBenders

## Getting started

### Requirements

- Node.js and npm
- A modern web browser

### Run locally

```bash
npm install
npm start
```

Open the local URL printed by the server. If the project version you are using does not define an `npm start` script, check `package.json` for the available run command.

### Run tests

```bash
npm test
```

To check JavaScript syntax:

```bash
node --check app.js
```

## Project structure

```text
haqsetu-ai/
├── app.js                 # Client-side application logic
├── server.js              # Local Node.js server
├── package.json           # Scripts and dependencies
└── data/
    ├── schemes.json       # Fictional demo scheme dataset
    └── ui-languages.json  # Interface translations
```

Other UI, asset, and PWA files may also be present in the repository.

## Demo walkthrough

1. Open HaqSetu AI and review the home screen.
2. Enter a sample profile or describe a fictional applicant's situation.
3. Generate and review illustrative scheme matches.
4. Open a result to inspect the example document checklist.
5. Add an item to the tracker and update its status.
6. Switch the interface language.
7. Refresh the page to demonstrate saved local data; optionally erase the demo data.

**Demo video:** [Add video link here]

**Live application:** [Add deployed URL here]

## Data and privacy

The prototype stores certain profile, result, and tracking data in the browser's local storage. This is convenient for demonstration, but it is **not** a substitute for a secure account system or production-grade protection of sensitive personal information. Avoid entering real identity numbers, confidential documents, or other sensitive personal data.

## Current limitations

- Scheme information is fictional and must be replaced with authoritative, regularly updated sources before real-world use.
- Eligibility matching is a prototype, not an official eligibility determination.
- Translation of scheme-specific content may be incomplete.
- Browser-local storage is device/browser-specific and can be cleared.
- This is not an official government service or application portal.

## Future improvements

- Integrate verified government-scheme sources and update monitoring
- Add source citations and last-verified dates for every scheme
- Expand complete translation coverage and accessibility testing
- Strengthen privacy, security, and data handling for production use
- Add official application links where available

## Hackathon development note

HaqSetu AI was developed as a hackathon prototype using CodeBenders, with additional ChatGPT assistance during development. Any hackathon submission should disclose tool usage accurately and follow the organizer's eligibility and deployment requirements.

## License

No license has been specified yet. Add a license only if you intend to grant reuse rights.
