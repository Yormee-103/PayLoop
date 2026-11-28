# Lighthouse CI budgets proposal (abdulrcrtw-101)

Standalone proposal for adding automated performance, accessibility, and SEO budgets to PayLoop pull requests. This file does not create a workflow or config.

## Routes

Run budgets against a production build on:

- `/`
- `/create`
- `/help`
- `/activity`

## Recommended budgets

| Category | Minimum score |
| --- | ---: |
| performance | 0.90 |
| accessibility | 0.95 |
| best-practices | 0.90 |
| seo | 0.90 |

Set assertions to `error` so violating a budget fails the PR check.

## `lighthouserc.json`

```json
{
  "ci": {
    "collect": {
      "startServerCommand": "npm run start",
      "url": [
        "http://localhost:3000/",
        "http://localhost:3000/create",
        "http://localhost:3000/help",
        "http://localhost:3000/activity"
      ],
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:best-practices": ["error", { "minScore": 0.9 }],
        "categories:seo": ["error", { "minScore": 0.9 }]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

## Workflow steps

```yaml
name: Lighthouse CI
on:
  pull_request:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: lighthouse-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22.x
          cache: npm
          cache-dependency-path: web/package-lock.json
      - run: npm ci
      - run: npm run build
      - run: npx --yes @lhci/cli@0.14.x autorun
```

## Implementation notes

- Add `@lhci/cli` as a dev dependency if the workflow should avoid fetching the CLI at runtime.
- Use `npm run start` instead of `npm run dev` so scores reflect a production build.
- Keep `permissions: contents: read`; Lighthouse CI does not need write access.
- Record budget failures in the PR check output and link to the temporary report.
- Document the budgets and the ignore policy in `CONTRIBUTING.md` when this is applied.
