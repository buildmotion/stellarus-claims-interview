# AI-Assisted Engineering Interview — NestJS

This is a small public-safe NestJS/TypeScript starter project for a 15-minute interview exercise. All data is fictitious.

## Candidate exercise

You may use any AI coding assistant available to you (for example Codex, GitHub Copilot, Claude, Gemini, or another tool). We are assessing how you use AI to make, review, and validate a software change.

### Task

Add a new endpoint:

`GET /claims/:claimId`

Requirements:

1. Return the matching claim when it exists.
2. Return HTTP `404` when it does not exist.
3. Use appropriate TypeScript types.
4. Add at least one automated test for the new behavior.
5. Run the tests and/or build before you finish.
6. Review the code changes and be prepared to explain what the AI generated and what you changed yourself.

Please do not add new dependencies unless you believe they are necessary.

### Existing endpoints

`GET /claims`

### Seed claims

- `CLM-1001`
- `CLM-1002`
- `CLM-1003`

## Local commands

```bash
npm install
npm run start:dev
npm test
npm run test:e2e
npm run build
```

The server listens on port `3000` by default.

## GitHub Repo
https://github.com/stellarus-interview-lab/ai-assisted-coding-interview


## Browser IDE

After this repository is published publicly to GitHub, it can be opened in StackBlitz using:

`https://stackblitz.com/github/<OWNER>/<REPOSITORY>`
