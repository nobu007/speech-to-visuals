---
title: Module root-config
genre: repository-analysis
type: entity
sources:
  - extract-skill-meta planning artifacts
related:
  - Module Index
  - Repository Risk Register
  - File Inventory
status: generated
---
# Module root-config

## Role

- Rationale: Root files describe packaging, dependencies, and project-level intent.
- Roots: .
- Languages: javascript, json, markdown, text, toml, typescript, yaml
- Files: 23
- Bytes: 654582

## Key Files

- `AGENTS.md`
- `CLAUDE.md`
- `README.md`
- `components.json`
- `postcss.config.js`
- `.env.example`
- `.gitignore`
- `STEERING.yaml`

## Risk Signals

- RISK-0127 (medium, Parser Or Heuristic) in `STEERING.yaml`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: path contains `yaml`
- RISK-0225 (medium, Parser Or Heuristic) in `codex_config.toml`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: path contains `toml`
- RISK-0226 (medium, Parser Or Heuristic) in `components.json`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: path contains `json`
- RISK-0227 (low, High Attention File) in `eslint.config.js`: The digest found several implementation signals worth manual review. Evidence: L3: import reactHooks from "eslint-plugin-react-hooks";
- RISK-0228 (high, Security Boundary) in `package-lock.json`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L53: "class-variance-authority": "^0.7.1",
- RISK-0229 (medium, Network Or IPC) in `package-lock.json`: Cross-process or network boundaries can fail through protocol, timeout, and trust assumptions. Evidence: L77: "socket.io": "^4.8.3",
- RISK-0230 (medium, Concurrency Or Timing) in `package-lock.json`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: path contains `lock`
- RISK-0231 (medium, Parser Or Heuristic) in `package-lock.json`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L147: "@csstools/css-color-parser": "^3.0.9",
- RISK-0232 (low, High Attention File) in `package-lock.json`: The digest found several implementation signals worth manual review. Evidence: L13: "@hookform/resolvers": "^5.2.2",
- RISK-0233 (high, Security Boundary) in `package.json`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L86: "class-variance-authority": "^0.7.1",
- RISK-0234 (medium, Network Or IPC) in `package.json`: Cross-process or network boundaries can fail through protocol, timeout, and trust assumptions. Evidence: L110: "socket.io": "^4.8.3",
- RISK-0235 (medium, Parser Or Heuristic) in `package.json`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: path contains `json`
- RISK-0236 (medium, Persistence Or State) in `package.json`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L38: "cache:warmup": "tsx scripts/cache-warmup.ts",
- RISK-0237 (low, High Attention File) in `package.json`: The digest found several implementation signals worth manual review. Evidence: L3: "private": true,
- RISK-0935 (medium, Parser Or Heuristic) in `test-scene-data.json`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: path contains `json`
- RISK-1245 (medium, Parser Or Heuristic) in `tsconfig.app.json`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: path contains `json`
- RISK-1246 (medium, Parser Or Heuristic) in `tsconfig.json`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: path contains `json`
- RISK-1247 (medium, Parser Or Heuristic) in `tsconfig.node.json`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: path contains `json`
- RISK-1248 (medium, Parser Or Heuristic) in `tsconfig.test.json`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: path contains `json`
- RISK-1249 (high, Process Execution) in `vite.config.ts`: Process or shell execution can cross sandbox, quoting, timeout, or injection boundaries. Evidence: L56: return ['path', 'fs', 'os', 'util', 'assert', 'module', 'child_process', 'stream', 'worker_threads', 'crypto', 'url', 'http', 'https', 'net', 'tls'].some(nodeModule =>
- RISK-1250 (medium, Network Or IPC) in `vite.config.ts`: Cross-process or network boundaries can fail through protocol, timeout, and trust assumptions. Evidence: L56: return ['path', 'fs', 'os', 'util', 'assert', 'module', 'child_process', 'stream', 'worker_threads', 'crypto', 'url', 'http', 'https', 'net', 'tls'].some(nodeModule =>
- RISK-1251 (medium, Concurrency Or Timing) in `vite.config.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L56: return ['path', 'fs', 'os', 'util', 'assert', 'module', 'child_process', 'stream', 'worker_threads', 'crypto', 'url', 'http', 'https', 'net', 'tls'].some(nodeModule =>
- RISK-1252 (low, High Attention File) in `vite.config.ts`: The digest found several implementation signals worth manual review. Evidence: L2: import react from "@vitejs/plugin-react-swc";

## Files

- `.env.example` — text, 15 lines, attention 28
- `.gitignore` — text, 332 lines, attention 100
- `AGENTS.md` — markdown, 163 lines, attention 56
- `CLAUDE.md` — markdown, 160 lines, attention 42
- `README.md` — markdown, 245 lines, attention 0
- `STEERING.yaml` — yaml, 44 lines, attention 14
- `SYSTEM_CONSTITUTION.md` — markdown, 171 lines, attention 56
- `TESTING_GUIDE.md` — markdown, 96 lines, attention 14
- `codex_config.toml` — toml, 44 lines, attention 42
- `components.json` — json, 21 lines, attention 14
- `eslint.config.js` — javascript, 27 lines, attention 70
- `jest.config.cjs` — javascript, 38 lines, attention 0
- `package-lock.json` — json, 16410 lines, attention 100
- `package.json` — json, 153 lines, attention 100
- `postcss.config.js` — javascript, 7 lines, attention 14
- `remotion.config.ts` — typescript, 20 lines, attention 0
- `tailwind.config.ts` — typescript, 93 lines, attention 14
- `test-scene-data.json` — json, 158 lines, attention 0
- `tsconfig.app.json` — json, 31 lines, attention 0
- `tsconfig.json` — json, 17 lines, attention 0
- `tsconfig.node.json` — json, 23 lines, attention 0
- `tsconfig.test.json` — json, 20 lines, attention 0
- `vite.config.ts` — typescript, 98 lines, attention 70
