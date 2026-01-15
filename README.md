# housing-algo

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

By default it reads `data/house.json` and `data/people.json`.

```bash
bun run index.ts --house data/house.json --people data/people.json
```

Optional flags:

- `--json` for machine-readable output
- `--mode ai` to send a scoring request to an external decider (set `AI_DECIDER_URL`)

This project was created using `bun init` in bun v1.2.21. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
