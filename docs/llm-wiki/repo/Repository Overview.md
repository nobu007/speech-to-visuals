---
title: Repository Overview
genre: repository-analysis
type: synthesis
sources:
  - extract-skill-meta planning artifacts
related:
  - Repository Wiki Index
  - Module Index
  - Repository Risk Register
  - Processing Progress
status: generated
---
# Repository Overview

## Scope

- Repository: `speech-to-visuals`
- Repository root: `/home/jinno/speech-to-visuals`
- Requested focus path: `/home/jinno/speech-to-visuals`
- Matched source files: 1472
- Matched source bytes: 13492922
- Wiki context logical chunks: 112
- Wiki context agent bundles: 90

## Selection Rules

- Include globs:
  - `**/*.py`
  - `**/*.ts`
  - `**/*.tsx`
  - `**/*.js`
  - `**/*.jsx`
  - `**/*.mjs`
  - `**/*.cjs`
  - `**/*.go`
  - `**/*.rs`
  - `**/*.java`
  - `**/*.kt`
  - `**/*.swift`
  - `**/*.c`
  - `**/*.cc`
  - `**/*.cpp`
  - `**/*.h`
  - `**/*.hpp`
  - `**/*.cs`
  - `**/*.rb`
  - `**/*.php`
  - `**/*.scala`
  - `**/*.lua`
  - `**/*.sh`
  - `**/*.bash`
  - `**/*.zsh`
  - `**/*.ps1`
  - `**/*.sql`
  - `**/*.toml`
  - `**/*.yaml`
  - `**/*.yml`
  - `**/*.json`
- Ignore globs:
  - `**/.git/**`
  - `**/.extract_skill_meta/**`
  - `**/.extract_skill_meta_*/**`
  - `**/node_modules/**`
  - `**/.venv/**`
  - `**/venv/**`
  - `**/__pycache__/**`
  - `**/dist/**`
  - `**/build/**`
  - `**/coverage/**`
  - `**/.next/**`
  - `**/.turbo/**`
  - `**/target/**`
  - `**/*.lock`

## Language Mix

- example: 1
- javascript: 4
- json: 19
- markdown: 741
- python: 50
- shell: 7
- sql: 6
- text: 2
- toml: 2
- tsx: 69
- txt: 7
- typescript: 502
- yaml: 62

## Logical Module Map

| Module | Files | Bytes | Languages | Risk Links |
| --- | ---: | ---: | --- | --- |
| [[Module root-config]] | 23 | 654560 | javascript, json, markdown, text, toml, typescript, yaml | [[Repository Risk Register]] |
| [[Module support-scripts]] | 27 | 293256 | typescript | [[Repository Risk Register]] |
| [[Module audit]] | 1 | 3164 | yaml | [[Repository Risk Register]] |
| [[Module bmad]] | 426 | 2936645 | javascript, json, markdown, yaml | [[Repository Risk Register]] |
| [[Module claude]] | 192 | 1161081 | json, markdown, python, shell, text | [[Repository Risk Register]] |
| [[Module docs]] | 58 | 963109 | markdown | [[Repository Risk Register]] |
| [[Module github]] | 2 | 2274 | yaml | [[Repository Risk Register]] |
| [[Module public]] | 4 | 1714 | json, text | [[Repository Risk Register]] |
| [[Module scripts-operations]] | 13 | 147703 | markdown, python, shell, text, yaml | [[Repository Risk Register]] |
| [[Module specs]] | 179 | 1919621 | markdown, text, typescript, yaml | [[Repository Risk Register]] |
| [[Module src]] | 3 | 2076 | tsx, typescript | [[Repository Risk Register]] |
| [[Module src-analysis]] | 39 | 474115 | typescript | [[Repository Risk Register]] |
| [[Module src-api]] | 25 | 146944 | typescript | [[Repository Risk Register]] |
| [[Module src-components]] | 52 | 409157 | tsx, typescript | [[Repository Risk Register]] |
| [[Module src-config]] | 9 | 50045 | typescript | [[Repository Risk Register]] |
| [[Module src-export]] | 7 | 112670 | tsx, typescript | [[Repository Risk Register]] |
| [[Module src-framework]] | 6 | 118069 | typescript | [[Repository Risk Register]] |
| [[Module src-hooks]] | 2 | 14761 | typescript | [[Repository Risk Register]] |
| [[Module src-integrations]] | 5 | 20621 | typescript | [[Repository Risk Register]] |
| [[Module src-lib]] | 3 | 13743 | typescript | [[Repository Risk Register]] |
| [[Module src-monitoring]] | 6 | 107721 | typescript | [[Repository Risk Register]] |
| [[Module src-optimization]] | 8 | 65262 | typescript | [[Repository Risk Register]] |
| [[Module src-pages]] | 4 | 11952 | tsx | [[Repository Risk Register]] |
| [[Module src-performance]] | 4 | 108714 | typescript | [[Repository Risk Register]] |
| [[Module src-pipeline]] | 27 | 331285 | typescript | [[Repository Risk Register]] |
| [[Module src-quality]] | 16 | 327777 | typescript | [[Repository Risk Register]] |
| [[Module src-remotion]] | 22 | 161099 | tsx, typescript | [[Repository Risk Register]] |
| [[Module src-test]] | 16 | 89029 | typescript | [[Repository Risk Register]] |
| [[Module src-transcription]] | 15 | 230655 | typescript | [[Repository Risk Register]] |
| [[Module src-types]] | 15 | 34237 | typescript | [[Repository Risk Register]] |
| [[Module src-utils]] | 8 | 24296 | typescript | [[Repository Risk Register]] |
| [[Module src-visualization]] | 47 | 460125 | typescript | [[Repository Risk Register]] |
| [[Module src-workers]] | 14 | 74252 | typescript | [[Repository Risk Register]] |
| [[Module supabase]] | 11 | 38949 | text, toml, typescript | [[Repository Risk Register]] |
| [[Module tests]] | 182 | 1982192 | tsx, typescript | [[Repository Risk Register]] |
| [[Module tmp]] | 1 | 49 | markdown | [[Repository Risk Register]] |

## Directory Structure Snapshot

```text
_bmad/
  _config/
    agents/
      bmb-agent-builder.customize.yaml
      bmb-module-builder.customize.yaml
      bmb-workflow-builder.customize.yaml
      bmm-analyst.customize.yaml
      bmm-architect.customize.yaml
      bmm-dev.customize.yaml
      bmm-pm.customize.yaml
      bmm-quick-flow-solo-dev.customize.yaml
      bmm-sm.customize.yaml
      bmm-tea.customize.yaml
      bmm-tech-writer.customize.yaml
      bmm-ux-designer.customize.yaml
      core-bmad-master.customize.yaml
    ides/
      claude-code.yaml
    agent-manifest.csv
    files-manifest.csv
    manifest.yaml
    task-manifest.csv
    tool-manifest.csv
    workflow-manifest.csv
  bmb/
    agents/
      agent-builder.md
      module-builder.md
      workflow-builder.md
    docs/
      workflows/
        templates/
          step-01-init-continuable-template.md
          step-1b-template.md
          step-file.md
          step-template.md
          workflow-template.md
          workflow.md
        architecture.md
        common-workflow-tools.csv
        csv-data-file-standards.md
        intent-vs-prescriptive-spectrum.md
        step-file-rules.md
        terms.md
    reference/
      agents/
        simple-examples/
          README.md
      workflows/
        meal-prep-nutrition/
          data/
            dietary-restrictions.csv
            macro-calculator.csv
            recipe-database.csv
          steps/
            step-01-init.md
            step-01b-continue.md
            step-02-profile.md
            step-03-assessment.md
            step-04-strategy.md
            step-05-shopping.md
            step-06-prep-schedule.md
          templates/
            assessment-section.md
            prep-schedule-section.md
            profile-section.md
            shopping-section.md
            strategy-section.md
          workflow.md
      readme.md
    workflows/
      agent/
        data/
          reference/
            module-examples/
              architect.md
          agent-compilation.md
          agent-menu-patterns.md
          agent-metadata.md
          brainstorm-context.md
          communication-presets.csv
          critical-actions.md
          expert-agent-architecture.md
          expert-agent-validation.md
          module-agent-validation.md
          persona-properties.md
          principles-crafting.md
          simple-agent-architecture.md
          simple-agent-validation.md
          understanding-agent-types.md
        steps-c/
          step-01-brainstorm.md
          step-02-discovery.md
          step-03-type-metadata.md
          step-04-persona.md
          step-05-commands-menu.md
          step-06-activation.md
          step-07a-build-simple.md
          step-07b-build-expert.md
          step-07c-build-module.md
          step-08b-metadata-validation.md
          step-08c-persona-validation.md
          step-08d-menu-validation.md
          step-08e-structure-validation.md
          step-08f-sidecar-validation.md
          step-09-celebrate.md
        steps-e/
          e-01-load-existing.md
          e-02-discover-edits.md
          e-03a-validate-metadata.md
          e-03b-validate-persona.md
          e-03c-validate-menu.md
          e-03d-validate-structure.md
          e-03e-validate-sidecar.md
          e-03f-validation-summary.md
          e-04-type-metadata.md
          e-05-persona.md
          e-06-commands-menu.md
          e-07-activation.md
          e-08a-edit-simple.md
          e-08b-edit-expert.md
          e-08c-edit-module.md
          e-09a-validate-metadata.md
          e-09b-validate-persona.md
          e-09c-validate-menu.md
          e-09d-validate-structure.md
          e-09e-validate-sidecar.md
          e-09f-validation-summary.md
          e-10-celebrate.md
        steps-v/
          v-01-load-review.md
          v-02a-validate-metadata.md
          v-02b-validate-persona.md
          v-02c-validate-menu.md
          v-02d-validate-structure.md
          v-02e-validate-sidecar.md
          v-03-summary.md
        templates/
          expert-agent-template/
            expert-agent.template.md
          simple-agent.template.md
        workflow.md
      create-module/
        steps/
          step-01-init.md
          step-01b-continue.md
          step-02-concept.md
          step-03-components.md
          step-04-structure.md
          step-05-config.md
          step-06-agents.md
          step-07-workflows.md
          step-08-installer.md
          step-09-documentation.md
          step-10-roadmap.md
          step-11-validate.md
        templates/
          agent.template.md
          installer.template.js
          module.template.yaml
        validation.md
        workflow.md
      create-workflow/
        data/
          examples/
            meal-prep-nutrition/
              data/
                dietary-restrictions.csv
                macro-calculator.csv
                recipe-database.csv
              steps/
                step-01-init.md
                step-01b-continue.md
                step-02-profile.md
                step-03-assessment.md
                step-04-strategy.md
                step-05-shopping.md
                step-06-prep-schedule.md
              templates/
                assessment-section.md
... [directory structure truncated in wiki]
```
