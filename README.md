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
- `--mode gemini` to send Gemini-compatible payloads to the decider (set `AI_DECIDER_URL`)
- `--gemini-model <name>` to pass a Gemini model identifier
- `--gemini-data <path>` to attach data files (repeatable)
- `--gemini-webpage <url>` to attach webpage URLs (repeatable)
- `--gemini-image <path>` to attach image files (repeatable)

Generate a house config from a Rightmove listing (requires `GEMINI_API_KEY`):

```bash
bun run rightmove.ts --url "https://www.rightmove.co.uk/properties/..." --out data/house.json
```

Optional Rightmove flags:

- `--model <name>` to override the Gemini model (defaults to `GEMINI_MODEL` or `gemini-1.5-flash`)
- `--max-images <count>` to limit inline listing photos
- `--max-floorplans <count>` to limit inline floorplan images

```bash
bun run rightmove.ts --url "https://www.rightmove.co.uk/properties/170939012/" --model "gemini-3-flash-preview" --out data/house-ai-test.json
```

Generate residents interactively:

```bash
bun run residents.ts --out data/people.json
```

Optional residents flags:

- `--defaults <path>` to load defaults from a people/defaults JSON file
- `--count <number>` to pre-set the number of residents
