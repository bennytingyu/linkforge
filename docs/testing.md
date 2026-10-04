# Testing LinkForge

## Automated checks

After `npm install`, run `npm test` and `npm run build` from the repository root. The backend suite uses Node's built-in test runner with real HTTP requests against fresh Express servers on temporary localhost ports. It covers health, link creation and listing, URL and alias validation, alias conflicts, redirect destinations and click counts, deletion, missing routes, and malformed JSON. Each test closes its server; links never survive between tests.

The black-box integration test is skipped by default. Start the API in a separate terminal with `npm start`, then run:

```bash
npm run test:integration
```

For a different running API:

```bash
RUN_INTEGRATION=1 API_BASE_URL=http://localhost:4000 \
  node --test tests/integration/*.test.js
```

Use a development or test instance: this test creates, visits, and deletes one uniquely named link. It does not delete existing links. It verifies API behavior through HTTP only and does not launch a browser.

## Manual dashboard checks

1. Run `npm run dev` and open `http://localhost:5173`.
2. Create a valid destination with and without a custom alias. Confirm the new link appears and displays its short URL.
3. Try an invalid URL and a duplicate alias. Confirm a useful error appears and existing links remain available.
4. Copy a short URL, open it, and confirm the destination loads. Refresh the dashboard and verify the click count increased.
5. Delete a link. Confirm it disappears and the old short URL returns 404.
6. Check narrow mobile and desktop widths, keyboard navigation, field labels, loading indicators, and empty states.
7. Run `npm run build`, stop development servers, and run `npm start`. Repeat creation and redirect checks at `http://localhost:3000` to verify frontend serving and API routing together.

No coverage percentage is enforced. Add HTTP regression tests for behavior changes. Browser interactions are currently checked manually; a passing API suite alone does not establish frontend behavior.
