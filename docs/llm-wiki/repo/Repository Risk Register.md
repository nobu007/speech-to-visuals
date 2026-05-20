---
title: Repository Risk Register
genre: repository-analysis
type: synthesis
sources:
  - extract-skill-meta planning artifacts
related:
  - Repository Overview
  - Module Index
  - File Inventory
created: 2026-05-20
updated: 2026-05-20
status: generated
---
# Repository Risk Register

## Summary

- Total findings: 1173
- High: 170
- Medium: 662
- Low: 341

## Findings

| ID | Severity | Category | File | Signal | Evidence |
| --- | --- | --- | --- | --- | --- |
| RISK-0001 | high | Security Boundary | `.audit/purpose_driven_plan.yml` | `auth` | L45: title: "Enforce JWT authentication on pipeline routes in production" |
| RISK-0002 | high | Destructive Mutation | `.audit/purpose_driven_plan.yml` | `force` | L45: title: "Enforce JWT authentication on pipeline routes in production" |
| RISK-0003 | medium | Network Or IPC | `.audit/purpose_driven_plan.yml` | `socket` | L13: title: "Add UUID validation to WebSocket join:job/leave:job handlers" |
| RISK-0004 | medium | Parser Or Heuristic | `.audit/purpose_driven_plan.yml` | `parse` | L11: note: "Replaced manual type assertions with Zod safeParse." |
| RISK-0005 | low | High Attention File | `.audit/purpose_driven_plan.yml` | `attention_score=84` | L11: note: "Replaced manual type assertions with Zod safeParse." |
| RISK-0006 | medium | Parser Or Heuristic | `.claude/settings.example.json` | `json` | path contains `json` |
| RISK-0007 | medium | Parser Or Heuristic | `.claude/settings.json` | `json` | path contains `json` |
| RISK-0008 | low | High Attention File | `.claude/settings.json` | `attention_score=100` | L2: "hooks": { |
| RISK-0009 | high | Security Boundary | `.claude/skills/agent-creator/scripts/agent_workflows.py` | `auth` | L27: - Review authentication and authorization |
| RISK-0010 | medium | Parser Or Heuristic | `.claude/skills/agent-creator/scripts/generate_agent.py` | `parse` | L9: import argparse |
| RISK-0011 | low | High Attention File | `.claude/skills/agent-creator/scripts/generate_agent.py` | `attention_score=100` | L9: import argparse |
| RISK-0012 | medium | Parser Or Heuristic | `.claude/skills/agent-creator/scripts/init_agent.py` | `parse` | L171: import argparse |
| RISK-0013 | low | High Attention File | `.claude/skills/agent-creator/scripts/init_agent.py` | `attention_score=98` | L171: import argparse |
| RISK-0014 | medium | Parser Or Heuristic | `.claude/skills/agent-creator/scripts/validate_agent.py` | `parse` | L8: import argparse |
| RISK-0015 | low | High Attention File | `.claude/skills/agent-creator/scripts/validate_agent.py` | `attention_score=100` | L8: import argparse |
| RISK-0016 | high | Security Boundary | `.claude/skills/code-review/scripts/review.py` | `token` | L136: max_tokens=4000, |
| RISK-0017 | medium | Parser Or Heuristic | `.claude/skills/code-review/scripts/review.py` | `parse` | L4: import argparse |
| RISK-0018 | low | High Attention File | `.claude/skills/code-review/scripts/review.py` | `attention_score=100` | L4: import argparse |
| RISK-0019 | high | Process Execution | `.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.py` | `subprocess` | L26: import subprocess |
| RISK-0020 | medium | Concurrency Or Timing | `.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.py` | `timeout` | L49: ["jscpd", "--version"], capture_output=True, text=True, timeout=10 |
| RISK-0021 | medium | Parser Or Heuristic | `.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.py` | `parse` | L18: import argparse |
| RISK-0022 | low | High Attention File | `.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer.py` | `attention_score=100` | L18: import argparse |
| RISK-0023 | medium | Parser Or Heuristic | `.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer_refactored.py` | `parse` | L9: import argparse |
| RISK-0024 | low | High Attention File | `.claude/skills/codebase-improvement-advisor/scripts/codebase_analyzer_refactored.py` | `attention_score=100` | L9: import argparse |
| RISK-0025 | medium | Parser Or Heuristic | `.claude/skills/codebase-improvement-advisor/scripts/modules/advanced_analyzer.py` | `parse` | L67: tree = ast.parse(source_code) |
| RISK-0026 | medium | Persistence Or State | `.claude/skills/codebase-improvement-advisor/scripts/modules/advanced_analyzer.py` | `cache` | L25: self.ignore_dirs = {"node_modules", ".git", "__pycache__", ".pytest_cache"} |
| RISK-0027 | high | Process Execution | `.claude/skills/codebase-improvement-advisor/scripts/modules/jscpd_analyzer.py` | `subprocess` | L4: import subprocess |
| RISK-0028 | medium | Concurrency Or Timing | `.claude/skills/codebase-improvement-advisor/scripts/modules/jscpd_analyzer.py` | `timeout` | L12: ["jscpd", "--version"], capture_output=True, text=True, timeout=10 |
| RISK-0029 | medium | Parser Or Heuristic | `.claude/skills/codebase-improvement-advisor/scripts/modules/jscpd_analyzer.py` | `parse` | L81: return self._parse_results(jscpd_result) |
| RISK-0030 | low | High Attention File | `.claude/skills/codebase-improvement-advisor/scripts/modules/jscpd_analyzer.py` | `attention_score=100` | L4: import subprocess |
| RISK-0031 | medium | Concurrency Or Timing | `.claude/skills/codebase-improvement-advisor/scripts/refactoring_helper.py` | `timeout` | L119: for exclusion in ["port", "timeout", "limit", "max", "min"] |
| RISK-0032 | medium | Parser Or Heuristic | `.claude/skills/codebase-improvement-advisor/scripts/refactoring_helper.py` | `parse` | L16: import argparse |
| RISK-0033 | low | High Attention File | `.claude/skills/codebase-improvement-advisor/scripts/refactoring_helper.py` | `attention_score=100` | L16: import argparse |
| RISK-0034 | medium | Parser Or Heuristic | `.claude/skills/commit-prep-helper/assets/review_config.json` | `json` | path contains `json` |
| RISK-0035 | high | Process Execution | `.claude/skills/commit-prep-helper/scripts/check_staged_files.py` | `subprocess` | L10: import subprocess |
| RISK-0036 | medium | Parser Or Heuristic | `.claude/skills/commit-prep-helper/scripts/check_staged_files.py` | `parse` | L42: # Parse numstat output: format: "added\tremoved\tfilename" |
| RISK-0037 | medium | Persistence Or State | `.claude/skills/commit-prep-helper/scripts/check_staged_files.py` | `cache` | L18: ["git", "diff", "--cached", "--name-only"], |
| RISK-0038 | low | High Attention File | `.claude/skills/commit-prep-helper/scripts/check_staged_files.py` | `attention_score=100` | L10: import subprocess |
| RISK-0039 | high | Security Boundary | `.claude/skills/commit-prep-helper/scripts/code_review.py` | `token` | L62: "pattern": r'(?:secret\|token)\s*[:=]\s*["\'][^"\']{8,}["\']', |
| RISK-0040 | high | Process Execution | `.claude/skills/commit-prep-helper/scripts/code_review.py` | `subprocess` | L11: import subprocess |
| RISK-0041 | medium | Parser Or Heuristic | `.claude/skills/commit-prep-helper/scripts/code_review.py` | `json` | L8: import json |
| RISK-0042 | medium | Persistence Or State | `.claude/skills/commit-prep-helper/scripts/code_review.py` | `cache` | L19: ["git", "diff", "--cached", "--name-only"], |
| RISK-0043 | low | High Attention File | `.claude/skills/commit-prep-helper/scripts/code_review.py` | `attention_score=100` | L11: import subprocess |
| RISK-0044 | high | Process Execution | `.claude/skills/commit-prep-helper/scripts/create_commit.py` | `subprocess` | L10: import subprocess |
| RISK-0045 | medium | Parser Or Heuristic | `.claude/skills/commit-prep-helper/scripts/create_commit.py` | `json` | L8: import json |
| RISK-0046 | medium | Persistence Or State | `.claude/skills/commit-prep-helper/scripts/create_commit.py` | `cache` | L19: ["git", "diff", "--cached", "--name-only"], |
| RISK-0047 | low | High Attention File | `.claude/skills/commit-prep-helper/scripts/create_commit.py` | `attention_score=100` | L10: import subprocess |
| RISK-0048 | high | Process Execution | `.claude/skills/commit-prep-helper/scripts/run_linting.py` | `subprocess` | L10: import subprocess |
| RISK-0049 | medium | Concurrency Or Timing | `.claude/skills/commit-prep-helper/scripts/run_linting.py` | `timeout` | L34: timeout=30, # 30 second timeout |
| RISK-0050 | medium | Parser Or Heuristic | `.claude/skills/commit-prep-helper/scripts/run_linting.py` | `parse` | L42: # Try to parse as individual JSON objects (ESLint sometimes outputs this way) |
| RISK-0051 | low | High Attention File | `.claude/skills/commit-prep-helper/scripts/run_linting.py` | `attention_score=100` | L10: import subprocess |
| RISK-0052 | high | Process Execution | `.claude/skills/commit-prep-helper/scripts/run_tests.py` | `subprocess` | L11: import subprocess |
| RISK-0053 | medium | Concurrency Or Timing | `.claude/skills/commit-prep-helper/scripts/run_tests.py` | `timeout` | L49: timeout=300, # 5分タイムアウト |
| RISK-0054 | medium | Parser Or Heuristic | `.claude/skills/commit-prep-helper/scripts/run_tests.py` | `parse` | L52: # Parse Jest output |
| RISK-0055 | low | High Attention File | `.claude/skills/commit-prep-helper/scripts/run_tests.py` | `attention_score=100` | L11: import subprocess |
| RISK-0056 | high | Security Boundary | `.claude/skills/feature-implementer/scripts/implement_feature.py` | `auth` | L37: # Check API Key presence to avoid hanging on auth prompt |
| RISK-0057 | high | Process Execution | `.claude/skills/feature-implementer/scripts/implement_feature.py` | `subprocess` | L7: import subprocess |
| RISK-0058 | medium | Concurrency Or Timing | `.claude/skills/feature-implementer/scripts/implement_feature.py` | `timeout` | L69: timeout=600, # Longer timeout for features |
| RISK-0059 | medium | Parser Or Heuristic | `.claude/skills/feature-implementer/scripts/implement_feature.py` | `parse` | L4: import argparse |
| RISK-0060 | low | High Attention File | `.claude/skills/feature-implementer/scripts/implement_feature.py` | `attention_score=100` | L4: import argparse |
| RISK-0061 | medium | Parser Or Heuristic | `.claude/skills/github-issue-improver/improvements_example.json` | `json` | path contains `json` |
| RISK-0062 | high | Security Boundary | `.claude/skills/github-issue-improver/scripts/apply_improvements.py` | `token` | L50: repo: str, improvements_file: str, token: str \| None = None, dry_run: bool = False |
| RISK-0063 | medium | Parser Or Heuristic | `.claude/skills/github-issue-improver/scripts/apply_improvements.py` | `parse` | L4: import argparse |
| RISK-0064 | low | High Attention File | `.claude/skills/github-issue-improver/scripts/apply_improvements.py` | `attention_score=100` | L4: import argparse |
| RISK-0065 | high | Security Boundary | `.claude/skills/github-issue-improver/scripts/github_client.py` | `auth` | L102: self.headers["Authorization"] = f"token {self.token}" |
| RISK-0066 | medium | Parser Or Heuristic | `.claude/skills/github-issue-improver/scripts/github_client.py` | `fallback` | L56: # Fallback to python-dotenv |
| RISK-0067 | low | High Attention File | `.claude/skills/github-issue-improver/scripts/github_client.py` | `attention_score=100` | L56: # Fallback to python-dotenv |
| RISK-0068 | high | Security Boundary | `.claude/skills/github-issue-improver/scripts/issue_analyzer.py` | `auth` | L77: except anthropic.AuthenticationError as e: |
| RISK-0069 | medium | Parser Or Heuristic | `.claude/skills/github-issue-improver/scripts/issue_analyzer.py` | `parse` | L383: def _parse_issue_type(self, type_str: str) -> IssueType: |
| RISK-0070 | low | High Attention File | `.claude/skills/github-issue-improver/scripts/issue_analyzer.py` | `attention_score=100` | L54: def __init__(self, fallback_to_keywords: bool = True): |
| RISK-0071 | high | Security Boundary | `.claude/skills/github-issue-improver/scripts/issue_improver.py` | `token` | L104: def __init__(self, token: str \| None = None, allow_read_only: bool = True): |
| RISK-0072 | medium | Parser Or Heuristic | `.claude/skills/github-issue-improver/scripts/issue_improver.py` | `parse` | L7: import argparse |
| RISK-0073 | low | High Attention File | `.claude/skills/github-issue-improver/scripts/issue_improver.py` | `attention_score=100` | L7: import argparse |
| RISK-0074 | high | Security Boundary | `.claude/skills/github-issue-improver/test_common_lib_integration.py` | `token` | L18: GITHUB_TOKEN=ghp_TEST_PLACEHOLDER_TOKEN_12345 |
| RISK-0075 | medium | Parser Or Heuristic | `.claude/skills/github-issue-improver/test_common_lib_integration.py` | `parse` | L38: from env_utils import parse_env_file_manual |
| RISK-0076 | low | High Attention File | `.claude/skills/github-issue-improver/test_common_lib_integration.py` | `attention_score=100` | L18: GITHUB_TOKEN=ghp_TEST_PLACEHOLDER_TOKEN_12345 |
| RISK-0077 | high | Security Boundary | `.claude/skills/github-issue-improver/test_token_loading.py` | `token` | path contains `token` |
| RISK-0078 | low | High Attention File | `.claude/skills/github-issue-improver/test_token_loading.py` | `attention_score=100` | L3: Test script to verify token loading functionality |
| RISK-0079 | high | Security Boundary | `.claude/skills/github-issue-quality-checker/scripts/main.py` | `auth` | L82: "Authorization": f"token {self.token}", |
| RISK-0080 | medium | Parser Or Heuristic | `.claude/skills/github-issue-quality-checker/scripts/main.py` | `parse` | L9: import argparse |
| RISK-0081 | low | High Attention File | `.claude/skills/github-issue-quality-checker/scripts/main.py` | `attention_score=100` | L9: import argparse |
| RISK-0082 | medium | Parser Or Heuristic | `.claude/skills/issue-creator/scripts/create_issue.py` | `json` | L40: import json |
| RISK-0083 | high | Security Boundary | `.claude/skills/issue-creator/scripts/issue_creator.py` | `auth` | L64: print(" GitHub CLIの認証が必要です: gh auth login") |
| RISK-0084 | high | Process Execution | `.claude/skills/issue-creator/scripts/issue_creator.py` | `subprocess` | L5: import subprocess |
| RISK-0085 | medium | Parser Or Heuristic | `.claude/skills/issue-creator/scripts/issue_creator.py` | `yaml` | L11: import yaml |
| RISK-0086 | low | High Attention File | `.claude/skills/issue-creator/scripts/issue_creator.py` | `attention_score=100` | L5: import subprocess |
| RISK-0087 | high | Security Boundary | `.claude/skills/md-doc-improver/scripts/document_validator.py` | `auth` | L272: security_keywords = ['security', 'authentication', 'authorization', 'token', 'credential'] |
| RISK-0088 | medium | Parser Or Heuristic | `.claude/skills/md-doc-improver/scripts/document_validator.py` | `parse` | L11: import argparse |
| RISK-0089 | low | High Attention File | `.claude/skills/md-doc-improver/scripts/document_validator.py` | `attention_score=100` | L11: import argparse |
| RISK-0090 | high | Security Boundary | `.claude/skills/md-doc-improver/scripts/improve_document.py` | `auth` | L230: 'security': ['security', 'authentication', 'authorization', 'token'], |
| RISK-0091 | medium | Parser Or Heuristic | `.claude/skills/md-doc-improver/scripts/improve_document.py` | `parse` | L11: import argparse |
| RISK-0092 | medium | Persistence Or State | `.claude/skills/md-doc-improver/scripts/improve_document.py` | `migration` | L232: 'versioning': ['version', 'compatibility', 'migration', 'upgrade'] |
| RISK-0093 | low | High Attention File | `.claude/skills/md-doc-improver/scripts/improve_document.py` | `attention_score=100` | L11: import argparse |
| RISK-0094 | high | Security Boundary | `.claude/skills/skill-creator-auto/scripts/init_skill.py` | `auth` | L201: - Authentication |
| RISK-0095 | medium | Concurrency Or Timing | `.claude/skills/skill-creator-auto/scripts/init_skill.py` | `rate limit` | L204: - Rate limits |
| RISK-0096 | low | High Attention File | `.claude/skills/skill-creator-auto/scripts/init_skill.py` | `attention_score=70` | L10: init_skill.py my-api-helper --path skills/private |
| RISK-0097 | medium | Parser Or Heuristic | `.claude/skills/skill-creator-auto/scripts/quick_validate.py` | `parse` | L84: # Parse YAML frontmatter |
| RISK-0098 | medium | Parser Or Heuristic | `.claude/skills/spec-flow-auto/scripts/create_tasks_from_spec.py` | `parse` | L9: import argparse |
| RISK-0099 | low | High Attention File | `.claude/skills/spec-flow-auto/scripts/create_tasks_from_spec.py` | `attention_score=100` | L9: import argparse |
| RISK-0100 | high | Process Execution | `.claude/skills/spec-flow-auto/scripts/enhanced_sdd_pipeline.py` | `subprocess` | L13: import subprocess |
| RISK-0101 | medium | Network Or IPC | `.claude/skills/spec-flow-auto/scripts/enhanced_sdd_pipeline.py` | `mcp` | L5: SpecWorkflowMcpとAI連携による高品質な仕様駆動開発パイプライン |
| RISK-0102 | medium | Parser Or Heuristic | `.claude/skills/spec-flow-auto/scripts/enhanced_sdd_pipeline.py` | `parse` | L9: import argparse |
| RISK-0103 | low | High Attention File | `.claude/skills/spec-flow-auto/scripts/enhanced_sdd_pipeline.py` | `attention_score=100` | L5: SpecWorkflowMcpとAI連携による高品質な仕様駆動開発パイプライン |
| RISK-0104 | high | Security Boundary | `.claude/skills/spec-flow-auto/scripts/generate_spec_from_prd.py` | `auth` | L129: - **AuthModule**: 認証関連機能 |
| RISK-0105 | medium | Network Or IPC | `.claude/skills/spec-flow-auto/scripts/generate_spec_from_prd.py` | `mcp` | L5: README.mdやPRDドキュメントから、SpecWorkflowMcp準拠の |
| RISK-0106 | medium | Parser Or Heuristic | `.claude/skills/spec-flow-auto/scripts/generate_spec_from_prd.py` | `parse` | L9: import argparse |
| RISK-0107 | low | High Attention File | `.claude/skills/spec-flow-auto/scripts/generate_spec_from_prd.py` | `attention_score=100` | L5: README.mdやPRDドキュメントから、SpecWorkflowMcp準拠の |
| RISK-0108 | high | Process Execution | `.claude/skills/spec-flow-auto/scripts/run_sdd_pipeline.py` | `subprocess` | L11: import subprocess |
| RISK-0109 | medium | Parser Or Heuristic | `.claude/skills/spec-flow-auto/scripts/run_sdd_pipeline.py` | `parse` | L9: import argparse |
| RISK-0110 | low | High Attention File | `.claude/skills/spec-flow-auto/scripts/run_sdd_pipeline.py` | `attention_score=100` | L9: import argparse |
| RISK-0111 | medium | Network Or IPC | `.claude/skills/spec-flow-auto/scripts/setup_spec_workspace.py` | `http` | L128: For more information, see the [SpecWorkflowMcp documentation](https://github.com/Pimzino/spec-workflow-mcp). |
| RISK-0112 | medium | Parser Or Heuristic | `.claude/skills/spec-flow-auto/scripts/setup_spec_workspace.py` | `parse` | L8: import argparse |
| RISK-0113 | low | High Attention File | `.claude/skills/spec-flow-auto/scripts/setup_spec_workspace.py` | `attention_score=84` | L5: SpecWorkflowMcpで必要なディレクトリ構造と設定ファイルを自動生成 |
| RISK-0114 | medium | Parser Or Heuristic | `.claude/skills/spec-flow-auto/scripts/validate_prd_spec_sync.py` | `parse` | L9: import argparse |
| RISK-0115 | low | High Attention File | `.claude/skills/spec-flow-auto/scripts/validate_prd_spec_sync.py` | `attention_score=100` | L9: import argparse |
| RISK-0116 | medium | Parser Or Heuristic | `.claude/skills/stepwise-executor/assets/goal_patterns/data_analysis.json` | `json` | path contains `json` |
| RISK-0117 | medium | Parser Or Heuristic | `.claude/skills/stepwise-executor/assets/goal_patterns/documentation.json` | `json` | path contains `json` |
| RISK-0118 | medium | Parser Or Heuristic | `.claude/skills/stepwise-executor/assets/goal_patterns/software_development.json` | `json` | path contains `json` |
| RISK-0119 | medium | Parser Or Heuristic | `.claude/skills/stepwise-executor/assets/progress_template.json` | `json` | path contains `json` |
| RISK-0120 | medium | Concurrency Or Timing | `.claude/skills/stepwise-executor/scripts/execute_steps.py` | `retry` | L230: retry = input("\nステップを再試行しますか? (y/n): ").lower() |
| RISK-0121 | medium | Parser Or Heuristic | `.claude/skills/stepwise-executor/scripts/execute_steps.py` | `parse` | L9: import argparse |
| RISK-0122 | low | High Attention File | `.claude/skills/stepwise-executor/scripts/execute_steps.py` | `attention_score=100` | L9: import argparse |
| RISK-0123 | medium | Parser Or Heuristic | `.claude/skills/stepwise-executor/scripts/track_progress.py` | `parse` | L9: import argparse |
| RISK-0124 | low | High Attention File | `.claude/skills/stepwise-executor/scripts/track_progress.py` | `attention_score=98` | L9: import argparse |
| RISK-0125 | medium | Persistence Or State | `.github/workflows/ci.yml` | `cache` | L17: cache: npm |
| RISK-0126 | low | High Attention File | `.github/workflows/ci.yml` | `attention_score=70` | L17: cache: npm |
| RISK-0127 | medium | Parser Or Heuristic | `STEERING.yaml` | `yaml` | path contains `yaml` |
| RISK-0128 | medium | Parser Or Heuristic | `_bmad/_config/agents/bmb-agent-builder.customize.yaml` | `yaml` | path contains `yaml` |
| RISK-0129 | medium | Parser Or Heuristic | `_bmad/_config/agents/bmb-module-builder.customize.yaml` | `yaml` | path contains `yaml` |
| RISK-0130 | medium | Parser Or Heuristic | `_bmad/_config/agents/bmb-workflow-builder.customize.yaml` | `yaml` | path contains `yaml` |
| RISK-0131 | medium | Parser Or Heuristic | `_bmad/_config/agents/bmm-analyst.customize.yaml` | `yaml` | path contains `yaml` |
| RISK-0132 | medium | Parser Or Heuristic | `_bmad/_config/agents/bmm-architect.customize.yaml` | `yaml` | path contains `yaml` |
| RISK-0133 | medium | Parser Or Heuristic | `_bmad/_config/agents/bmm-dev.customize.yaml` | `yaml` | path contains `yaml` |
| RISK-0134 | medium | Parser Or Heuristic | `_bmad/_config/agents/bmm-pm.customize.yaml` | `yaml` | path contains `yaml` |
| RISK-0135 | medium | Parser Or Heuristic | `_bmad/_config/agents/bmm-quick-flow-solo-dev.customize.yaml` | `yaml` | path contains `yaml` |
| RISK-0136 | medium | Parser Or Heuristic | `_bmad/_config/agents/bmm-sm.customize.yaml` | `yaml` | path contains `yaml` |
| RISK-0137 | medium | Parser Or Heuristic | `_bmad/_config/agents/bmm-tea.customize.yaml` | `yaml` | path contains `yaml` |
| RISK-0138 | medium | Parser Or Heuristic | `_bmad/_config/agents/bmm-tech-writer.customize.yaml` | `yaml` | path contains `yaml` |
| RISK-0139 | medium | Parser Or Heuristic | `_bmad/_config/agents/bmm-ux-designer.customize.yaml` | `yaml` | path contains `yaml` |
| RISK-0140 | medium | Parser Or Heuristic | `_bmad/_config/agents/core-bmad-master.customize.yaml` | `yaml` | path contains `yaml` |
| RISK-0141 | medium | Parser Or Heuristic | `_bmad/_config/ides/claude-code.yaml` | `yaml` | path contains `yaml` |
| RISK-0142 | medium | Parser Or Heuristic | `_bmad/_config/manifest.yaml` | `yaml` | path contains `yaml` |
| RISK-0143 | medium | Parser Or Heuristic | `_bmad/bmb/config.yaml` | `yaml` | path contains `yaml` |
| RISK-0144 | high | Security Boundary | `_bmad/bmb/workflows-legacy/edit-module/workflow.yaml` | `auth` | L4: author: "BMad" |
| RISK-0145 | medium | Parser Or Heuristic | `_bmad/bmb/workflows-legacy/edit-module/workflow.yaml` | `yaml` | path contains `yaml` |
| RISK-0146 | high | Security Boundary | `_bmad/bmb/workflows-legacy/module-brief/workflow.yaml` | `auth` | L4: author: "BMad Builder" |
| RISK-0147 | medium | Parser Or Heuristic | `_bmad/bmb/workflows-legacy/module-brief/workflow.yaml` | `yaml` | path contains `yaml` |
| RISK-0148 | medium | Parser Or Heuristic | `_bmad/bmb/workflows/create-module/templates/module.template.yaml` | `yaml` | path contains `yaml` |
| RISK-0149 | medium | Network Or IPC | `_bmad/bmm/config.yaml` | `mcp` | L11: tea_use_mcp_enhancements: false |
| RISK-0150 | medium | Parser Or Heuristic | `_bmad/bmm/config.yaml` | `yaml` | path contains `yaml` |
| RISK-0151 | medium | Parser Or Heuristic | `_bmad/bmm/teams/team-fullstack.yaml` | `yaml` | path contains `yaml` |
| RISK-0152 | high | Security Boundary | `_bmad/bmm/workflows/4-implementation/code-review/workflow.yaml` | `auth` | L4: author: "BMad" |
| RISK-0153 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/4-implementation/code-review/workflow.yaml` | `yaml` | path contains `yaml` |
| RISK-0154 | high | Security Boundary | `_bmad/bmm/workflows/4-implementation/correct-course/workflow.yaml` | `auth` | L4: author: "BMad Method" |
| RISK-0155 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/4-implementation/correct-course/workflow.yaml` | `yaml` | path contains `yaml` |
| RISK-0156 | high | Security Boundary | `_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml` | `auth` | L3: author: "BMad" |
| RISK-0157 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml` | `yaml` | path contains `yaml` |
| RISK-0158 | low | High Attention File | `_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml` | `attention_score=98` | L3: author: "BMad" |
| RISK-0159 | high | Security Boundary | `_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml` | `auth` | L3: author: "BMad" |
| RISK-0160 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml` | `yaml` | path contains `yaml` |
| RISK-0161 | high | Security Boundary | `_bmad/bmm/workflows/4-implementation/retrospective/workflow.yaml` | `auth` | L4: author: "BMad" |
| RISK-0162 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/4-implementation/retrospective/workflow.yaml` | `yaml` | path contains `yaml` |
| RISK-0163 | high | Security Boundary | `_bmad/bmm/workflows/4-implementation/sprint-planning/sprint-status-template.yaml` | `auth` | L45: 1-1-user-authentication: done |
| RISK-0164 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/4-implementation/sprint-planning/sprint-status-template.yaml` | `yaml` | path contains `yaml` |
| RISK-0165 | high | Security Boundary | `_bmad/bmm/workflows/4-implementation/sprint-planning/workflow.yaml` | `auth` | L3: author: "BMad" |
| RISK-0166 | medium | Network Or IPC | `_bmad/bmm/workflows/4-implementation/sprint-planning/workflow.yaml` | `mcp` | L28: tracking_system: "file-system" # Options: file-system, Future will support other options from config of mcp such as jira, linear, trello |
| RISK-0167 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/4-implementation/sprint-planning/workflow.yaml` | `yaml` | path contains `yaml` |
| RISK-0168 | high | Security Boundary | `_bmad/bmm/workflows/4-implementation/sprint-status/workflow.yaml` | `auth` | L4: author: "BMad" |
| RISK-0169 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/4-implementation/sprint-status/workflow.yaml` | `yaml` | path contains `yaml` |
| RISK-0170 | high | Security Boundary | `_bmad/bmm/workflows/document-project/workflow.yaml` | `auth` | L5: author: "BMad" |
| RISK-0171 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/document-project/workflow.yaml` | `yaml` | path contains `yaml` |
| RISK-0172 | high | Security Boundary | `_bmad/bmm/workflows/document-project/workflows/deep-dive.yaml` | `auth` | L4: author: "BMad" |
| RISK-0173 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/document-project/workflows/deep-dive.yaml` | `yaml` | path contains `yaml` |
| RISK-0174 | high | Security Boundary | `_bmad/bmm/workflows/document-project/workflows/full-scan.yaml` | `auth` | L4: author: "BMad" |
| RISK-0175 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/document-project/workflows/full-scan.yaml` | `yaml` | path contains `yaml` |
| RISK-0176 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/excalidraw-diagrams/_shared/excalidraw-library.json` | `json` | path contains `json` |
| RISK-0177 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/excalidraw-diagrams/_shared/excalidraw-templates.yaml` | `yaml` | path contains `yaml` |
| RISK-0178 | high | Security Boundary | `_bmad/bmm/workflows/excalidraw-diagrams/create-dataflow/workflow.yaml` | `auth` | L3: author: "BMad" |
| RISK-0179 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/excalidraw-diagrams/create-dataflow/workflow.yaml` | `json` | L17: json_validation: "{project-root}/_bmad/core/resources/excalidraw/validate-json-instructions.md" |
| RISK-0180 | low | High Attention File | `_bmad/bmm/workflows/excalidraw-diagrams/create-dataflow/workflow.yaml` | `attention_score=100` | L1: name: create-excalidraw-dataflow |
| RISK-0181 | high | Security Boundary | `_bmad/bmm/workflows/excalidraw-diagrams/create-diagram/workflow.yaml` | `auth` | L3: author: "BMad" |
| RISK-0182 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/excalidraw-diagrams/create-diagram/workflow.yaml` | `json` | L17: json_validation: "{project-root}/_bmad/core/resources/excalidraw/validate-json-instructions.md" |
| RISK-0183 | low | High Attention File | `_bmad/bmm/workflows/excalidraw-diagrams/create-diagram/workflow.yaml` | `attention_score=100` | L1: name: create-excalidraw-diagram |
| RISK-0184 | high | Security Boundary | `_bmad/bmm/workflows/excalidraw-diagrams/create-flowchart/workflow.yaml` | `auth` | L3: author: "BMad" |
| RISK-0185 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/excalidraw-diagrams/create-flowchart/workflow.yaml` | `json` | L17: json_validation: "{project-root}/_bmad/core/resources/excalidraw/validate-json-instructions.md" |
| RISK-0186 | low | High Attention File | `_bmad/bmm/workflows/excalidraw-diagrams/create-flowchart/workflow.yaml` | `attention_score=100` | L1: name: create-excalidraw-flowchart |
| RISK-0187 | high | Security Boundary | `_bmad/bmm/workflows/excalidraw-diagrams/create-wireframe/workflow.yaml` | `auth` | L3: author: "BMad" |
| RISK-0188 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/excalidraw-diagrams/create-wireframe/workflow.yaml` | `json` | L17: json_validation: "{project-root}/_bmad/core/resources/excalidraw/validate-json-instructions.md" |
| RISK-0189 | low | High Attention File | `_bmad/bmm/workflows/excalidraw-diagrams/create-wireframe/workflow.yaml` | `attention_score=100` | L1: name: create-excalidraw-wireframe |
| RISK-0190 | high | Security Boundary | `_bmad/bmm/workflows/testarch/atdd/workflow.yaml` | `auth` | L4: author: "BMad" |
| RISK-0191 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/testarch/atdd/workflow.yaml` | `yaml` | path contains `yaml` |
| RISK-0192 | high | Security Boundary | `_bmad/bmm/workflows/testarch/automate/workflow.yaml` | `auth` | L4: author: "BMad" |
| RISK-0193 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/testarch/automate/workflow.yaml` | `yaml` | path contains `yaml` |
| RISK-0194 | medium | Concurrency Or Timing | `_bmad/bmm/workflows/testarch/ci/github-actions-template.yaml` | `timeout` | L25: timeout-minutes: 5 |
| RISK-0195 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/testarch/ci/github-actions-template.yaml` | `yaml` | path contains `yaml` |
| RISK-0196 | medium | Persistence Or State | `_bmad/bmm/workflows/testarch/ci/github-actions-template.yaml` | `cache` | L45: cache: "npm" |
| RISK-0197 | low | High Attention File | `_bmad/bmm/workflows/testarch/ci/github-actions-template.yaml` | `attention_score=100` | L25: timeout-minutes: 5 |
| RISK-0198 | medium | Concurrency Or Timing | `_bmad/bmm/workflows/testarch/ci/gitlab-ci-template.yaml` | `timeout` | L45: timeout: 5 minutes |
| RISK-0199 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/testarch/ci/gitlab-ci-template.yaml` | `yaml` | path contains `yaml` |
| RISK-0200 | medium | Persistence Or State | `_bmad/bmm/workflows/testarch/ci/gitlab-ci-template.yaml` | `cache` | L15: npm_config_cache: "$CI_PROJECT_DIR/.npm" |
| RISK-0201 | low | High Attention File | `_bmad/bmm/workflows/testarch/ci/gitlab-ci-template.yaml` | `attention_score=100` | L15: npm_config_cache: "$CI_PROJECT_DIR/.npm" |
| RISK-0202 | high | Security Boundary | `_bmad/bmm/workflows/testarch/ci/workflow.yaml` | `auth` | L4: author: "BMad" |
| RISK-0203 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/testarch/ci/workflow.yaml` | `yaml` | path contains `yaml` |
| RISK-0204 | high | Security Boundary | `_bmad/bmm/workflows/testarch/framework/workflow.yaml` | `auth` | L4: author: "BMad" |
| RISK-0205 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/testarch/framework/workflow.yaml` | `yaml` | path contains `yaml` |
| RISK-0206 | high | Security Boundary | `_bmad/bmm/workflows/testarch/nfr-assess/workflow.yaml` | `auth` | L4: author: "BMad" |
| RISK-0207 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/testarch/nfr-assess/workflow.yaml` | `yaml` | path contains `yaml` |
| RISK-0208 | high | Security Boundary | `_bmad/bmm/workflows/testarch/test-design/workflow.yaml` | `auth` | L4: author: "BMad" |
| RISK-0209 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/testarch/test-design/workflow.yaml` | `yaml` | path contains `yaml` |
| RISK-0210 | high | Security Boundary | `_bmad/bmm/workflows/testarch/test-review/workflow.yaml` | `auth` | L4: author: "BMad" |
| RISK-0211 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/testarch/test-review/workflow.yaml` | `yaml` | path contains `yaml` |
| RISK-0212 | high | Security Boundary | `_bmad/bmm/workflows/testarch/trace/workflow.yaml` | `auth` | L4: author: "BMad" |
| RISK-0213 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/testarch/trace/workflow.yaml` | `yaml` | path contains `yaml` |
| RISK-0214 | high | Security Boundary | `_bmad/bmm/workflows/workflow-status/init/workflow.yaml` | `auth` | L4: author: "BMad" |
| RISK-0215 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/workflow-status/init/workflow.yaml` | `yaml` | path contains `yaml` |
| RISK-0216 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/workflow-status/paths/enterprise-brownfield.yaml` | `yaml` | path contains `yaml` |
| RISK-0217 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/workflow-status/paths/enterprise-greenfield.yaml` | `yaml` | path contains `yaml` |
| RISK-0218 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/workflow-status/paths/method-brownfield.yaml` | `yaml` | path contains `yaml` |
| RISK-0219 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/workflow-status/paths/method-greenfield.yaml` | `yaml` | path contains `yaml` |
| RISK-0220 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/workflow-status/project-levels.yaml` | `yaml` | path contains `yaml` |
| RISK-0221 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/workflow-status/workflow-status-template.yaml` | `yaml` | path contains `yaml` |
| RISK-0222 | high | Security Boundary | `_bmad/bmm/workflows/workflow-status/workflow.yaml` | `auth` | L4: author: "BMad" |
| RISK-0223 | medium | Parser Or Heuristic | `_bmad/bmm/workflows/workflow-status/workflow.yaml` | `yaml` | path contains `yaml` |
| RISK-0224 | medium | Parser Or Heuristic | `_bmad/core/config.yaml` | `yaml` | path contains `yaml` |
| RISK-0225 | medium | Parser Or Heuristic | `codex_config.toml` | `toml` | path contains `toml` |
| RISK-0226 | medium | Parser Or Heuristic | `components.json` | `json` | path contains `json` |
| RISK-0227 | low | High Attention File | `eslint.config.js` | `attention_score=70` | L3: import reactHooks from "eslint-plugin-react-hooks"; |
| RISK-0228 | high | Security Boundary | `package-lock.json` | `auth` | L53: "class-variance-authority": "^0.7.1", |
| RISK-0229 | medium | Network Or IPC | `package-lock.json` | `socket` | L77: "socket.io": "^4.8.3", |
| RISK-0230 | medium | Concurrency Or Timing | `package-lock.json` | `lock` | path contains `lock` |
| RISK-0231 | medium | Parser Or Heuristic | `package-lock.json` | `parse` | L147: "@csstools/css-color-parser": "^3.0.9", |
| RISK-0232 | low | High Attention File | `package-lock.json` | `attention_score=100` | L13: "@hookform/resolvers": "^5.2.2", |
| RISK-0233 | high | Security Boundary | `package.json` | `auth` | L86: "class-variance-authority": "^0.7.1", |
| RISK-0234 | medium | Network Or IPC | `package.json` | `socket` | L110: "socket.io": "^4.8.3", |
| RISK-0235 | medium | Parser Or Heuristic | `package.json` | `json` | path contains `json` |
| RISK-0236 | medium | Persistence Or State | `package.json` | `cache` | L38: "cache:warmup": "tsx scripts/cache-warmup.ts", |
| RISK-0237 | low | High Attention File | `package.json` | `attention_score=100` | L3: "private": true, |
| RISK-0238 | medium | Parser Or Heuristic | `public/audio/sample-info.json` | `json` | path contains `json` |
| RISK-0239 | medium | Parser Or Heuristic | `public/srt/jfk.captions.json` | `json` | path contains `json` |
| RISK-0240 | medium | Concurrency Or Timing | `scripts/batch-audio-pipeline.ts` | `async` | L126: private async processSequential(audioFiles: string[]): Promise<void> { |
| RISK-0241 | low | High Attention File | `scripts/batch-audio-pipeline.ts` | `attention_score=100` | L46: private config: BatchConfig; |
| RISK-0242 | medium | Concurrency Or Timing | `scripts/benchmark-llm-performance.ts` | `timeout` | L6: * - Adaptive timeout effectiveness |
| RISK-0243 | medium | Parser Or Heuristic | `scripts/benchmark-llm-performance.ts` | `fallback` | L7: * - Error rates and fallback frequency |
| RISK-0244 | medium | Persistence Or State | `scripts/benchmark-llm-performance.ts` | `cache` | L5: * - Cache hit rates |
| RISK-0245 | low | High Attention File | `scripts/benchmark-llm-performance.ts` | `attention_score=100` | L5: * - Cache hit rates |
| RISK-0246 | low | High Attention File | `scripts/benchmark-performance.ts` | `attention_score=100` | L11: import { performance } from 'perf_hooks'; |
| RISK-0247 | medium | Concurrency Or Timing | `scripts/cache-warmup.ts` | `async` | L198: async function warmupCache(): Promise<void> { |
| RISK-0248 | medium | Parser Or Heuristic | `scripts/cache-warmup.ts` | `fallback` | L233: console.log(` ⚠️ Result incomplete (may be using fallback)`); |
| RISK-0249 | medium | Persistence Or State | `scripts/cache-warmup.ts` | `cache` | path contains `cache` |
| RISK-0250 | low | High Attention File | `scripts/cache-warmup.ts` | `attention_score=100` | L2: * Phase 43: Cache Warm-up Strategy |
| RISK-0251 | medium | Concurrency Or Timing | `scripts/demo-custom-instructions.ts` | `timeout` | L84: console.log(' ⚙️ Note: Using shorter timeout to avoid delays in demo...'); |
| RISK-0252 | medium | Parser Or Heuristic | `scripts/demo-custom-instructions.ts` | `parse` | L147: console.log(` Target: >0.5 (50% connectivity) - ${edgeRatio >= 0.5 ? '✅ PASS' : '⚠️ SPARSE'}`); |
| RISK-0253 | medium | Persistence Or State | `scripts/demo-custom-instructions.ts` | `cache` | L111: console.log(` Cache Hit Rate: ${stats.cacheHitRate}%`); |
| RISK-0254 | low | High Attention File | `scripts/demo-custom-instructions.ts` | `attention_score=100` | L52: console.log(` Status: ${llmService.isEnabled() ? 'ENABLED' : 'DISABLED (will use fallback)'}`); |
| RISK-0255 | medium | Parser Or Heuristic | `scripts/demo-phase27-quality-framework.ts` | `fallback` | L43: fallbackTriggered: false, |
| RISK-0256 | low | High Attention File | `scripts/demo-phase27-quality-framework.ts` | `attention_score=100` | L33: memoryUsage: 320, |
| RISK-0257 | medium | Parser Or Heuristic | `scripts/diagram-to-scenes.ts` | `parse` | L20: return JSON.parse(fs.readFileSync(p, 'utf8')) as T; |
| RISK-0258 | medium | Parser Or Heuristic | `scripts/generate-diagram-from-text.ts` | `parse` | L21: function parseArgs(): { text?: string; file?: string; out?: string } { |
| RISK-0259 | medium | Parser Or Heuristic | `scripts/phase28-custom-instructions-demo.ts` | `fallback` | L133: console.log(' Skipping LLM analysis test (fallback to rule-based)'); |
| RISK-0260 | low | High Attention File | `scripts/phase28-custom-instructions-demo.ts` | `attention_score=98` | L39: memoryUsage: number; |
| RISK-0261 | medium | Parser Or Heuristic | `scripts/phase29-system-validation.ts` | `fallback` | L142: fallbackTriggered: false, |
| RISK-0262 | medium | Persistence Or State | `scripts/phase29-system-validation.ts` | `cache` | L143: cacheHitRate: 0.0, // Fresh run |
| RISK-0263 | low | High Attention File | `scripts/phase29-system-validation.ts` | `attention_score=100` | L16: import { getHeapUsed } from '../src/utils/memory-usage'; |
| RISK-0264 | medium | Concurrency Or Timing | `scripts/phase38-custom-instructions-validation.ts` | `async` | L659: private async runTest( |
| RISK-0265 | medium | Parser Or Heuristic | `scripts/phase38-custom-instructions-validation.ts` | `fallback` | L498: fallbackTriggered: false, |
| RISK-0266 | medium | Persistence Or State | `scripts/phase38-custom-instructions-validation.ts` | `cache` | L303: cacheHits: stats.cacheHits, |
| RISK-0267 | low | High Attention File | `scripts/phase38-custom-instructions-validation.ts` | `attention_score=100` | L26: import { getMemoryUsage } from '@/utils/memory-usage'; |
| RISK-0268 | medium | Concurrency Or Timing | `scripts/phase40-custom-instructions-validation.ts` | `async` | L80: private async validateSystemOverview(): Promise<void> { |
| RISK-0269 | medium | Parser Or Heuristic | `scripts/phase40-custom-instructions-validation.ts` | `parse` | L192: const packageJson = JSON.parse( |
| RISK-0270 | low | High Attention File | `scripts/phase40-custom-instructions-validation.ts` | `attention_score=100` | L22: private results: ValidationResult[] = []; |
| RISK-0271 | medium | Parser Or Heuristic | `scripts/render-video.ts` | `parse` | L33: const inputData = JSON.parse(fs.readFileSync(inputFile, 'utf-8')); |
| RISK-0272 | high | Security Boundary | `scripts/run-pipeline.ts` | `token` | L59: const token = rest.shift()!; |
| RISK-0273 | medium | Parser Or Heuristic | `scripts/run-pipeline.ts` | `parse` | L47: function parseArgs(argv: string[]) { |
| RISK-0274 | low | High Attention File | `scripts/run-pipeline.ts` | `attention_score=84` | L47: function parseArgs(argv: string[]) { |
| RISK-0275 | medium | Parser Or Heuristic | `scripts/test-complete-audio-pipeline.ts` | `parse` | L278: result.metrics.videoSizeMB = parseFloat((videoStats.size / 1024 / 1024).toFixed(2)); |
| RISK-0276 | low | High Attention File | `scripts/test-complete-audio-pipeline.ts` | `attention_score=100` | L15: import { performance } from 'perf_hooks'; |
| RISK-0277 | medium | Concurrency Or Timing | `scripts/test-llm-integration.ts` | `async` | L102: private async testApiConnectivity(): Promise<void> { |
| RISK-0278 | medium | Parser Or Heuristic | `scripts/test-llm-integration.ts` | `fallback` | L9: * - Verify fallback mechanisms |
| RISK-0279 | medium | Persistence Or State | `scripts/test-llm-integration.ts` | `cache` | L95: // Test 4: Cache functionality |
| RISK-0280 | low | High Attention File | `scripts/test-llm-integration.ts` | `attention_score=100` | L9: * - Verify fallback mechanisms |
| RISK-0281 | medium | Concurrency Or Timing | `scripts/test-phase37.ts` | `timeout` | L271: new Error('Network timeout'), |
| RISK-0282 | medium | Parser Or Heuristic | `scripts/test-phase44-e2e.ts` | `fallback` | L49: console.log('[Test 2/6] LLM Content Analysis with Fallback...'); |
| RISK-0283 | medium | Persistence Or State | `scripts/test-phase44-e2e.ts` | `writefile` | L7: import { existsSync, readFileSync, writeFileSync } from 'fs'; |
| RISK-0284 | low | High Attention File | `scripts/test-phase44-e2e.ts` | `attention_score=100` | L11: import { getMemoryUsage } from '@/utils/memory-usage'; |
| RISK-0285 | high | Process Execution | `scripts/validate-deployment-readiness.ts` | `child_process` | L23: import { execSync } from 'child_process'; |
| RISK-0286 | medium | Concurrency Or Timing | `scripts/validate-deployment-readiness.ts` | `async` | L79: private async validateDependencies(): Promise<void> { |
| RISK-0287 | medium | Parser Or Heuristic | `scripts/validate-deployment-readiness.ts` | `parse` | L96: const packageJson = JSON.parse( |
| RISK-0288 | low | High Attention File | `scripts/validate-deployment-readiness.ts` | `attention_score=100` | L23: import { execSync } from 'child_process'; |
| RISK-0289 | medium | Parser Or Heuristic | `scripts/validate-llm-integration-phase42.ts` | `fallback` | L6: * - ContentAnalyzer with fallback mechanisms |
| RISK-0290 | medium | Persistence Or State | `scripts/validate-llm-integration-phase42.ts` | `cache` | L49: console.log(` Cache: ${stats.cacheHits} hits, ${stats.cacheMisses} misses`); |
| RISK-0291 | low | High Attention File | `scripts/validate-llm-integration-phase42.ts` | `attention_score=84` | L6: * - ContentAnalyzer with fallback mechanisms |
| RISK-0292 | high | Security Boundary | `scripts/validate-llm-integration.ts` | `api_key` | L69: log('warning', 'GOOGLE_API_KEY not set - LLM features will use fallback'); |
| RISK-0293 | medium | Parser Or Heuristic | `scripts/validate-llm-integration.ts` | `fallback` | L13: * 5. Fallback mechanisms ✅ |
| RISK-0294 | medium | Persistence Or State | `scripts/validate-llm-integration.ts` | `cache` | L14: * 6. Cache performance ✅ |
| RISK-0295 | low | High Attention File | `scripts/validate-llm-integration.ts` | `attention_score=100` | L13: * 5. Fallback mechanisms ✅ |
| RISK-0296 | medium | Parser Or Heuristic | `scripts/verify-phase1.ts` | `parse` | L32: const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')); |
| RISK-0297 | medium | Parser Or Heuristic | `scripts_operations/monitoring/constitutional_compliance_checker_enhanced.py` | `parse` | L9: import argparse |
| RISK-0298 | low | High Attention File | `scripts_operations/monitoring/constitutional_compliance_checker_enhanced.py` | `attention_score=100` | L9: import argparse |
| RISK-0299 | medium | Network Or IPC | `scripts_operations/monitoring/docker-compose.yml` | `bridge` | L192: driver: bridge |
| RISK-0300 | medium | Concurrency Or Timing | `scripts_operations/monitoring/docker-compose.yml` | `timeout` | L50: timeout: 10s |
| RISK-0301 | low | High Attention File | `scripts_operations/monitoring/docker-compose.yml` | `attention_score=100` | L2: # This provides a complete production setup with Nginx reverse proxy |
| RISK-0302 | medium | Parser Or Heuristic | `scripts_operations/monitoring/github_issue_monitor_integration.py` | `parse` | L160: import argparse |
| RISK-0303 | low | High Attention File | `scripts_operations/monitoring/github_issue_monitor_integration.py` | `attention_score=100` | L160: import argparse |
| RISK-0304 | medium | Network Or IPC | `scripts_operations/monitoring/health_check.sh` | `socket` | L143: # Check WebSocket endpoint |
| RISK-0305 | medium | Concurrency Or Timing | `scripts_operations/monitoring/health_check.sh` | `timeout` | L13: TIMEOUT=${HEALTH_CHECK_TIMEOUT:-10} |
| RISK-0306 | medium | Parser Or Heuristic | `scripts_operations/monitoring/health_check.sh` | `parse` | L125: # Parse JSON response if possible |
| RISK-0307 | low | High Attention File | `scripts_operations/monitoring/health_check.sh` | `attention_score=100` | L13: TIMEOUT=${HEALTH_CHECK_TIMEOUT:-10} |
| RISK-0308 | high | Security Boundary | `scripts_operations/monitoring/implement_security.py` | `auth` | L123: # Create authentication middleware |
| RISK-0309 | medium | Network Or IPC | `scripts_operations/monitoring/implement_security.py` | `http` | L137: from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials |
| RISK-0310 | medium | Persistence Or State | `scripts_operations/monitoring/implement_security.py` | `open(` | L125: with open(auth_middleware, "w") as f: |
| RISK-0311 | low | High Attention File | `scripts_operations/monitoring/implement_security.py` | `attention_score=100` | L47: return secrets.token_urlsafe(length) |
| RISK-0312 | high | Security Boundary | `scripts_operations/monitoring/run_github_issue_monitor.sh` | `token` | L49: GITHUB_TOKEN GitHub APIトークン（必須） |
| RISK-0313 | medium | Network Or IPC | `scripts_operations/monitoring/setup_monitoring.sh` | `socket` | L221: # WebSocket connection issues |
| RISK-0314 | medium | Concurrency Or Timing | `scripts_operations/monitoring/setup_monitoring.sh` | `timeout` | L120: scrape_timeout: 10s |
| RISK-0315 | low | High Attention File | `scripts_operations/monitoring/setup_monitoring.sh` | `attention_score=100` | L120: scrape_timeout: 10s |
| RISK-0316 | medium | Concurrency Or Timing | `scripts_operations/monitoring/start_production.sh` | `retry` | L255: log "Health check attempt $attempt/$max_attempts failed, retrying in 2 seconds..." |
| RISK-0317 | high | Security Boundary | `specs/speech-to-visuals/database-schema.sql` | `auth` | L26: user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- 🔵 RLS認証より |
| RISK-0318 | high | Destructive Mutation | `specs/speech-to-visuals/database-schema.sql` | `delete` | L26: user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- 🔵 RLS認証より |
| RISK-0319 | medium | Persistence Or State | `specs/speech-to-visuals/database-schema.sql` | `database` | path contains `database` |
| RISK-0320 | low | High Attention File | `specs/speech-to-visuals/database-schema.sql` | `attention_score=100` | L26: user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- 🔵 RLS認証より |
| RISK-0321 | high | Security Boundary | `specs/speech-to-visuals/interfaces.ts` | `token` | L177: maxOutputTokens?: number; // 🔵 出力制限 |
| RISK-0322 | medium | Concurrency Or Timing | `specs/speech-to-visuals/interfaces.ts` | `timeout` | L141: timeout?: number; // 🔵 PIPELINE_FLOW.md §4.2 より |
| RISK-0323 | medium | Parser Or Heuristic | `specs/speech-to-visuals/interfaces.ts` | `parse` | L182: parseResponse: (raw: string) => T; // 🔵 レスポンスパーサー |
| RISK-0324 | medium | Persistence Or State | `specs/speech-to-visuals/interfaces.ts` | `cache` | L196: fromCache: boolean; // 🔵 キャッシュヒットフラグ |
| RISK-0325 | low | High Attention File | `specs/speech-to-visuals/interfaces.ts` | `attention_score=100` | L141: timeout?: number; // 🔵 PIPELINE_FLOW.md §4.2 より |
| RISK-0326 | medium | Concurrency Or Timing | `src/analysis/__tests__/content-analyzer.test.ts` | `retry` | L49: retryCount: 0, |
| RISK-0327 | medium | Parser Or Heuristic | `src/analysis/__tests__/content-analyzer.test.ts` | `fallback` | L50: fallbackUsed: false, |
| RISK-0328 | medium | Persistence Or State | `src/analysis/__tests__/content-analyzer.test.ts` | `cache` | L48: fromCache: false, |
| RISK-0329 | low | High Attention File | `src/analysis/__tests__/content-analyzer.test.ts` | `attention_score=100` | L48: fromCache: false, |
| RISK-0330 | medium | Concurrency Or Timing | `src/analysis/__tests__/diagram-detector.test.ts` | `async` | L484: it('should handle error gracefully and return fallback analysis', async () => { |
| RISK-0331 | medium | Parser Or Heuristic | `src/analysis/__tests__/diagram-detector.test.ts` | `parse` | L277: const sparseFeatures: TextFeatures = { |
| RISK-0332 | medium | Concurrency Or Timing | `src/analysis/__tests__/fallback-chain.test.ts` | `async` | L152: const primaryWithRetryableError = async () => { |
| RISK-0333 | medium | Parser Or Heuristic | `src/analysis/__tests__/fallback-chain.test.ts` | `fallback` | path contains `fallback` |
| RISK-0334 | low | High Attention File | `src/analysis/__tests__/fallback-chain.test.ts` | `attention_score=100` | L2: * Tests for TASK-0018: Three-Layer Fallback Chain |
| RISK-0335 | medium | Concurrency Or Timing | `src/analysis/__tests__/gemini-analyzer-comprehensive.test.ts` | `async` | L72: execute: jest.fn().mockImplementation(async (req: { parser?: (text: string) => DiagramAnalysis }) => { |
| RISK-0336 | medium | Parser Or Heuristic | `src/analysis/__tests__/gemini-analyzer-comprehensive.test.ts` | `parse` | L9: * - createEnhancedParser() via execute: |
| RISK-0337 | medium | Persistence Or State | `src/analysis/__tests__/gemini-analyzer-comprehensive.test.ts` | `cache` | L18: * - getCacheStats() - stats mapping |
| RISK-0338 | low | High Attention File | `src/analysis/__tests__/gemini-analyzer-comprehensive.test.ts` | `attention_score=100` | L9: * - createEnhancedParser() via execute: |
| RISK-0339 | medium | Concurrency Or Timing | `src/analysis/__tests__/gemini-analyzer.test.ts` | `retry` | L35: retryCount: 0, |
| RISK-0340 | medium | Parser Or Heuristic | `src/analysis/__tests__/gemini-analyzer.test.ts` | `parse` | L21: * parsed result from the Gemini API. The mock simulates a successful |
| RISK-0341 | medium | Persistence Or State | `src/analysis/__tests__/gemini-analyzer.test.ts` | `cache` | L33: fromCache: false, |
| RISK-0342 | low | High Attention File | `src/analysis/__tests__/gemini-analyzer.test.ts` | `attention_score=100` | L21: * parsed result from the Gemini API. The mock simulates a successful |
| RISK-0343 | high | Security Boundary | `src/analysis/__tests__/language-detector.test.ts` | `token` | L24: /** Mock tokenizer that tests can configure via mockTokenizer */ |
| RISK-0344 | medium | Concurrency Or Timing | `src/analysis/__tests__/language-detector.test.ts` | `async` | L340: it('should initialize Kuromoji tokenizer successfully', async () => { |
| RISK-0345 | low | High Attention File | `src/analysis/__tests__/language-detector.test.ts` | `attention_score=100` | L24: /** Mock tokenizer that tests can configure via mockTokenizer */ |
| RISK-0346 | medium | Concurrency Or Timing | `src/analysis/__tests__/llm-service-comprehensive.test.ts` | `async` | L115: const mockStream = (async function* () { |
| RISK-0347 | medium | Parser Or Heuristic | `src/analysis/__tests__/llm-service-comprehensive.test.ts` | `fallback` | L7: * - execute() - model selection, retry, fallback, error handling |
| RISK-0348 | medium | Persistence Or State | `src/analysis/__tests__/llm-service-comprehensive.test.ts` | `cache` | L9: * - clearCache() |
| RISK-0349 | low | High Attention File | `src/analysis/__tests__/llm-service-comprehensive.test.ts` | `attention_score=100` | L7: * - execute() - model selection, retry, fallback, error handling |
| RISK-0350 | medium | Parser Or Heuristic | `src/analysis/__tests__/llm-service-warmup.test.ts` | `json` | L35: cachePersistPath: path.join(tmpDir, 'test-cache.json'), |
| RISK-0351 | medium | Persistence Or State | `src/analysis/__tests__/llm-service-warmup.test.ts` | `cache` | L2: * REQ-202: LLMService Cache Warmup Integration Tests |
| RISK-0352 | low | High Attention File | `src/analysis/__tests__/llm-service-warmup.test.ts` | `attention_score=100` | L2: * REQ-202: LLMService Cache Warmup Integration Tests |
| RISK-0353 | medium | Concurrency Or Timing | `src/analysis/__tests__/llm-service.test.ts` | `lock` | L51: it('should parse JSON wrapped in markdown code block (```json ... ```)', () => { |
| RISK-0354 | medium | Parser Or Heuristic | `src/analysis/__tests__/llm-service.test.ts` | `parse` | L6: * 6. Response parse error tolerance (malformed JSON, empty response) |
| RISK-0355 | low | High Attention File | `src/analysis/__tests__/llm-service.test.ts` | `attention_score=100` | L6: * 6. Response parse error tolerance (malformed JSON, empty response) |
| RISK-0356 | high | Security Boundary | `src/analysis/__tests__/retry-strategy.test.ts` | `auth` | L173: const authErrorFn = async () => { |
| RISK-0357 | medium | Concurrency Or Timing | `src/analysis/__tests__/retry-strategy.test.ts` | `async` | L83: const errorFn = async () => { |
| RISK-0358 | low | High Attention File | `src/analysis/__tests__/retry-strategy.test.ts` | `attention_score=100` | L2: * Tests for TASK-0019: Retry Strategy with Exponential Backoff and Jitter |
| RISK-0359 | medium | Parser Or Heuristic | `src/analysis/__tests__/rule-based-analyzer.test.ts` | `fallback` | L2: * Tests for TASK-0022: Rule-Based V1 Fallback Analyzer |
| RISK-0360 | high | Security Boundary | `src/analysis/__tests__/semantic-similarity.test.ts` | `token` | L51: // Both 2 chars, ratio = 1, but no common tokens |
| RISK-0361 | high | Security Boundary | `src/analysis/budget-alert.ts` | `session` | L4: * Monitors cumulative session/daily cost against configurable |
| RISK-0362 | low | High Attention File | `src/analysis/budget-alert.ts` | `attention_score=100` | L4: * Monitors cumulative session/daily cost against configurable |
| RISK-0363 | medium | Network Or IPC | `src/analysis/complexity-detector.ts` | `ipc` | L247: const density = (relationshipCount / words.length) * 100; |
| RISK-0364 | low | High Attention File | `src/analysis/complexity-detector.ts` | `attention_score=100` | L47: private readonly SIMPLE_THRESHOLD = 0.15; // Simple content (Flash model) |
| RISK-0365 | high | Security Boundary | `src/analysis/content-analyzer.ts` | `token` | L76: maxOutputTokens: 2048, |
| RISK-0366 | medium | Concurrency Or Timing | `src/analysis/content-analyzer.ts` | `retry` | L18: * - Consistent retry and error handling |
| RISK-0367 | medium | Parser Or Heuristic | `src/analysis/content-analyzer.ts` | `fallback` | L70: // Use LLMService for execution (handles caching, retry, fallback automatically) |
| RISK-0368 | medium | Persistence Or State | `src/analysis/content-analyzer.ts` | `cache` | L17: * - Shared cache with other analyzers |
| RISK-0369 | low | High Attention File | `src/analysis/content-analyzer.ts` | `attention_score=100` | L12: * - Maintains backward compatibility |
| RISK-0370 | high | Security Boundary | `src/analysis/cost-estimator.ts` | `token` | L5: * published pricing per million tokens. |
| RISK-0371 | low | High Attention File | `src/analysis/cost-estimator.ts` | `attention_score=100` | L5: * published pricing per million tokens. |
| RISK-0372 | low | High Attention File | `src/analysis/diagram-detector.ts` | `attention_score=100` | L161: private iteration: number = 1; |
| RISK-0373 | medium | Concurrency Or Timing | `src/analysis/fallback-chain.ts` | `timeout` | L24: timeout?: number; |
| RISK-0374 | medium | Parser Or Heuristic | `src/analysis/fallback-chain.ts` | `fallback` | path contains `fallback` |
| RISK-0375 | low | High Attention File | `src/analysis/fallback-chain.ts` | `attention_score=100` | L2: * TASK-0018: Three-Layer Fallback Chain |
| RISK-0376 | medium | Concurrency Or Timing | `src/analysis/gemini-analyzer.ts` | `retry` | L25: * - Consistent retry and error handling |
| RISK-0377 | medium | Parser Or Heuristic | `src/analysis/gemini-analyzer.ts` | `parse` | L33: import { parseJsonFromLLMText } from "./llm-utils"; |
| RISK-0378 | medium | Persistence Or State | `src/analysis/gemini-analyzer.ts` | `cache` | L24: * - Shared cache with ContentAnalyzer and future analyzers |
| RISK-0379 | low | High Attention File | `src/analysis/gemini-analyzer.ts` | `attention_score=100` | L24: * - Shared cache with ContentAnalyzer and future analyzers |
| RISK-0380 | high | Security Boundary | `src/analysis/language-detector.ts` | `token` | L54: tokens: Array<{ surface_form: string; pos: string }>; |
| RISK-0381 | high | Destructive Mutation | `src/analysis/language-detector.ts` | `force` | L616: export function forceLanguage(preferredLanguage: Language): Language { |
| RISK-0382 | medium | Parser Or Heuristic | `src/analysis/language-detector.ts` | `fallback` | L15: * - Graceful fallback when Kuromoji is unavailable |
| RISK-0383 | low | High Attention File | `src/analysis/language-detector.ts` | `attention_score=100` | L15: * - Graceful fallback when Kuromoji is unavailable |
| RISK-0384 | high | Security Boundary | `src/analysis/llm-cache.ts` | `session` | L6: * - Persistent file-based storage for cross-session efficiency |
| RISK-0385 | medium | Persistence Or State | `src/analysis/llm-cache.ts` | `cache` | path contains `cache` |
| RISK-0386 | low | High Attention File | `src/analysis/llm-cache.ts` | `attention_score=100` | L4: * - Memory-efficient with TTL and size limits |
| RISK-0387 | high | Security Boundary | `src/analysis/llm-service.ts` | `token` | L25: import { TokenUsageTracker, type ModelType, type StageType, type TokenUsageSummary } from './token-usage-tracker'; |
| RISK-0388 | medium | Concurrency Or Timing | `src/analysis/llm-service.ts` | `async` | L186: const defaultResolver = async (text: string): Promise<unknown> => text; |
| RISK-0389 | medium | Parser Or Heuristic | `src/analysis/llm-service.ts` | `parse` | L23: import { parseJsonFromLLMText } from "./llm-utils"; |
| RISK-0390 | medium | Persistence Or State | `src/analysis/llm-service.ts` | `cache` | L15: * - Shared cache across all LLM operations |
| RISK-0391 | low | High Attention File | `src/analysis/llm-service.ts` | `attention_score=100` | L8: * - Centralized rate limiting and retry logic |
| RISK-0392 | medium | Parser Or Heuristic | `src/analysis/llm-utils.ts` | `parse` | L6: * Extract and parse JSON from an LLM text response. |
| RISK-0393 | low | High Attention File | `src/analysis/llm-utils.ts` | `attention_score=100` | L6: * Extract and parse JSON from an LLM text response. |
| RISK-0394 | medium | Parser Or Heuristic | `src/analysis/prompt-templates.ts` | `json` | L212: const CONTENT_ANALYZER_PROMPT_JA = (text: string) => `以下のテキストを分析し、内容を最もよく表す図解を生成するためのJSONデータを作成してください。 |
| RISK-0395 | medium | Network Or IPC | `src/analysis/retry-strategy.ts` | `http` | L34: * Retryable HTTP status codes |
| RISK-0396 | medium | Concurrency Or Timing | `src/analysis/retry-strategy.ts` | `async` | L129: export async function executeWithRetry<T>( |
| RISK-0397 | low | High Attention File | `src/analysis/retry-strategy.ts` | `attention_score=100` | L2: * TASK-0019: Retry Strategy with Exponential Backoff and Jitter |
| RISK-0398 | medium | Parser Or Heuristic | `src/analysis/rule-based-analyzer.ts` | `fallback` | L2: * TASK-0022: Rule-Based V1 Fallback Analyzer |
| RISK-0399 | low | High Attention File | `src/analysis/scene-segmenter.ts` | `attention_score=100` | L11: private config: AnalysisConfig; |
| RISK-0400 | high | Security Boundary | `src/analysis/semantic-similarity.ts` | `token` | L8: * 1. Token-based Jaccard similarity (fast, no dependencies) |
| RISK-0401 | medium | Persistence Or State | `src/analysis/semantic-similarity.ts` | `cache` | L2: * Semantic Similarity Calculator for LLM Cache |
| RISK-0402 | low | High Attention File | `src/analysis/semantic-similarity.ts` | `attention_score=100` | L2: * Semantic Similarity Calculator for LLM Cache |
| RISK-0403 | medium | Parser Or Heuristic | `src/analysis/simple-diagram-detector.ts` | `regex` | L129: const keywordMatches = (text.match(regex) \|\| []).length; |
| RISK-0404 | low | High Attention File | `src/analysis/simple-diagram-detector.ts` | `attention_score=100` | L43: private flowKeywords = [ |
| RISK-0405 | high | Security Boundary | `src/analysis/token-usage-tracker.ts` | `token` | path contains `token` |
| RISK-0406 | medium | Parser Or Heuristic | `src/analysis/token-usage-tracker.ts` | `fallback` | L5: * grouped by stage (analysis, fallback, cache-warmup). |
| RISK-0407 | medium | Persistence Or State | `src/analysis/token-usage-tracker.ts` | `cache` | L5: * grouped by stage (analysis, fallback, cache-warmup). |
| RISK-0408 | low | High Attention File | `src/analysis/token-usage-tracker.ts` | `attention_score=100` | L2: * TASK-0144: Token Usage Tracker (REQ-098) |
| RISK-0409 | medium | Network Or IPC | `src/api/__tests__/graceful-shutdown.test.ts` | `http` | L8: import type { Server } from 'http'; |
| RISK-0410 | low | High Attention File | `src/api/__tests__/graceful-shutdown.test.ts` | `attention_score=84` | L94: const patchedOn = jest.fn((event: string, handler: (...args: unknown[]) => void) => { |
| RISK-0411 | high | Destructive Mutation | `src/api/__tests__/server-route-regression.test.ts` | `delete` | L101: l => /healthRouter/.test(l) && /app\.(use\|get\|post\|put\|delete\|patch)/.test(l), |
| RISK-0412 | medium | Concurrency Or Timing | `src/api/__tests__/startup-warmup.test.ts` | `async` | L38: test('calls warmupCache when LLM service is enabled', async () => { |
| RISK-0413 | medium | Persistence Or State | `src/api/__tests__/startup-warmup.test.ts` | `cache` | L2: * REQ-202: Startup cache warmup integration test |
| RISK-0414 | low | High Attention File | `src/api/__tests__/startup-warmup.test.ts` | `attention_score=100` | L2: * REQ-202: Startup cache warmup integration test |
| RISK-0415 | high | Security Boundary | `src/api/batch-processing-api.ts` | `token` | L85: cancelToken: { cancelled: boolean }; |
| RISK-0416 | medium | Concurrency Or Timing | `src/api/batch-processing-api.ts` | `async` | L202: const p = (async () => { |
| RISK-0417 | medium | Parser Or Heuristic | `src/api/batch-processing-api.ts` | `fallback` | L171: // Fallback for non-standard File objects (test mocks) |
| RISK-0418 | low | High Attention File | `src/api/batch-processing-api.ts` | `attention_score=100` | L76: * In-memory job storage (for Phase 37 MVP) |
| RISK-0419 | medium | Network Or IPC | `src/api/index.ts` | `http` | L1: import { Server } from 'http'; |
| RISK-0420 | medium | Concurrency Or Timing | `src/api/index.ts` | `timeout` | L10: const SHUTDOWN_TIMEOUT_MS = 30_000; |
| RISK-0421 | medium | Parser Or Heuristic | `src/api/index.ts` | `parse` | L9: const PORT = parseInt(process.env.PORT \|\| '3001', 10); |
| RISK-0422 | high | Security Boundary | `src/api/middleware/__tests__/auth-integration.test.ts` | `auth` | path contains `auth` |
| RISK-0423 | medium | Parser Or Heuristic | `src/api/middleware/__tests__/auth-integration.test.ts` | `json` | L8: * Uses REAL jsonwebtoken (no mocks) so actual JWT verification is tested. |
| RISK-0424 | low | High Attention File | `src/api/middleware/__tests__/auth-integration.test.ts` | `attention_score=100` | L2: * REQ-111: authMiddleware Express パイプライン統合テスト |
| RISK-0425 | high | Security Boundary | `src/api/middleware/__tests__/auth.test.ts` | `auth` | path contains `auth` |
| RISK-0426 | medium | Parser Or Heuristic | `src/api/middleware/__tests__/auth.test.ts` | `json` | L4: * Uses REAL jsonwebtoken (no mock) so tests verify actual JWT verification |
| RISK-0427 | low | High Attention File | `src/api/middleware/__tests__/auth.test.ts` | `attention_score=100` | L2: * authMiddleware unit tests. |
| RISK-0428 | high | Security Boundary | `src/api/middleware/__tests__/error-handler.test.ts` | `auth` | L5: AuthenticationError, |
| RISK-0429 | low | High Attention File | `src/api/middleware/__tests__/error-handler.test.ts` | `attention_score=100` | L5: AuthenticationError, |
| RISK-0430 | high | Security Boundary | `src/api/middleware/__tests__/mock-consistency.test.ts` | `auth` | L5: * with the JWT methods actually used by auth.ts. If auth.ts starts using |
| RISK-0431 | medium | Concurrency Or Timing | `src/api/middleware/__tests__/mock-consistency.test.ts` | `async` | L43: it('TC-112-02: auth.ts uses jwt.verify which maps to mock verify', async () => { |
| RISK-0432 | medium | Parser Or Heuristic | `src/api/middleware/__tests__/mock-consistency.test.ts` | `json` | L2: * REQ-112: jsonwebtoken モック整合性自動検証 |
| RISK-0433 | low | High Attention File | `src/api/middleware/__tests__/mock-consistency.test.ts` | `attention_score=100` | L2: * REQ-112: jsonwebtoken モック整合性自動検証 |
| RISK-0434 | high | Security Boundary | `src/api/middleware/auth.ts` | `auth` | path contains `auth` |
| RISK-0435 | medium | Parser Or Heuristic | `src/api/middleware/auth.ts` | `json` | L2: import * as jwt from 'jsonwebtoken'; |
| RISK-0436 | low | High Attention File | `src/api/middleware/auth.ts` | `attention_score=100` | L2: import * as jwt from 'jsonwebtoken'; |
| RISK-0437 | high | Security Boundary | `src/api/middleware/error-handler.ts` | `auth` | L25: export class AuthenticationError extends AppError { |
| RISK-0438 | low | High Attention File | `src/api/middleware/error-handler.ts` | `attention_score=100` | L25: export class AuthenticationError extends AppError { |
| RISK-0439 | medium | Concurrency Or Timing | `src/api/middleware/rate-limit.ts` | `rate limit` | L27: message: 'Upload rate limit exceeded', |
| RISK-0440 | high | Destructive Mutation | `src/api/middleware/timeout.ts` | `force` | L4: * Enforces a maximum duration for each HTTP request. When the timeout |
| RISK-0441 | medium | Network Or IPC | `src/api/middleware/timeout.ts` | `http` | L4: * Enforces a maximum duration for each HTTP request. When the timeout |
| RISK-0442 | medium | Concurrency Or Timing | `src/api/middleware/timeout.ts` | `timeout` | path contains `timeout` |
| RISK-0443 | low | High Attention File | `src/api/middleware/timeout.ts` | `attention_score=100` | L2: * Request timeout middleware. |
| RISK-0444 | high | Security Boundary | `src/api/routes/__tests__/monitoring.test.ts` | `token` | L100: expect(response.body.data.totalInputTokens).toBe(0); |
| RISK-0445 | medium | Concurrency Or Timing | `src/api/routes/__tests__/monitoring.test.ts` | `async` | L54: it('should reflect recorded request data', async () => { |
| RISK-0446 | low | High Attention File | `src/api/routes/__tests__/monitoring.test.ts` | `attention_score=100` | L54: it('should reflect recorded request data', async () => { |
| RISK-0447 | high | Security Boundary | `src/api/routes/__tests__/pipeline-auth.test.ts` | `auth` | path contains `auth` |
| RISK-0448 | high | Destructive Mutation | `src/api/routes/__tests__/pipeline-auth.test.ts` | `force` | L5: * enforce JWT authentication when NODE_ENV === 'production', |
| RISK-0449 | medium | Parser Or Heuristic | `src/api/routes/__tests__/pipeline-auth.test.ts` | `json` | L11: import * as jwt from 'jsonwebtoken'; |
| RISK-0450 | medium | Persistence Or State | `src/api/routes/__tests__/pipeline-auth.test.ts` | `state` | L17: function createAuthApp(stateManager?: PipelineStateManager, enforceAuth = true) { |
| RISK-0451 | low | High Attention File | `src/api/routes/__tests__/pipeline-auth.test.ts` | `attention_score=100` | L2: * ISS-030: Pipeline endpoints authentication tests |
| RISK-0452 | medium | Persistence Or State | `src/api/routes/__tests__/pipeline-iterations-cap.test.ts` | `state` | L5: import { PipelineStateManager } from '../pipeline'; |
| RISK-0453 | medium | Concurrency Or Timing | `src/api/routes/__tests__/pipeline.test.ts` | `async` | L336: it('should reflect updated state', async () => { |
| RISK-0454 | medium | Persistence Or State | `src/api/routes/__tests__/pipeline.test.ts` | `state` | L336: it('should reflect updated state', async () => { |
| RISK-0455 | high | Security Boundary | `src/api/routes/batch.ts` | `token` | L55: cancelToken: { cancelled: boolean }; |
| RISK-0456 | medium | Persistence Or State | `src/api/routes/batch.ts` | `state` | L32: export type JobState = 'queued' \| 'processing' \| 'completed' \| 'failed' \| 'cancelled'; |
| RISK-0457 | low | High Attention File | `src/api/routes/batch.ts` | `attention_score=100` | L53: interface InternalJob { |
| RISK-0458 | high | Security Boundary | `src/api/routes/monitoring.ts` | `token` | L6: * - GET /cost - LLM cost metrics (token usage, budget) |
| RISK-0459 | medium | Parser Or Heuristic | `src/api/routes/monitoring.ts` | `parse` | L27: .transform(val => (val ? parseInt(val, 10) : 300000)) |
| RISK-0460 | medium | Persistence Or State | `src/api/routes/monitoring.ts` | `cache` | L110: cacheHitRate: dashData.summary.cacheHitRate, |
| RISK-0461 | low | High Attention File | `src/api/routes/monitoring.ts` | `attention_score=100` | L6: * - GET /cost - LLM cost metrics (token usage, budget) |
| RISK-0462 | medium | Parser Or Heuristic | `src/api/routes/pipeline.ts` | `parse` | L176: const parsed = RenderRequestSchema.safeParse(req.body); |
| RISK-0463 | medium | Persistence Or State | `src/api/routes/pipeline.ts` | `state` | L85: // Pipeline state manager (in-memory singleton) |
| RISK-0464 | low | High Attention File | `src/api/routes/pipeline.ts` | `attention_score=100` | L85: // Pipeline state manager (in-memory singleton) |
| RISK-0465 | high | Security Boundary | `src/api/server.ts` | `auth` | L12: import { authMiddleware, AuthenticatedRequest } from './middleware/auth'; |
| RISK-0466 | high | Destructive Mutation | `src/api/server.ts` | `force` | L30: // ISS-030: Conditional auth — enforced in production, bypassed in dev/test |
| RISK-0467 | medium | Concurrency Or Timing | `src/api/server.ts` | `timeout` | L11: import { requestTimeout } from './middleware/timeout'; |
| RISK-0468 | medium | Parser Or Heuristic | `src/api/server.ts` | `parse` | L37: // JSON body parser — ISS-044: limit from centralized config |
| RISK-0469 | low | High Attention File | `src/api/server.ts` | `attention_score=100` | L11: import { requestTimeout } from './middleware/timeout'; |
| RISK-0470 | medium | Persistence Or State | `src/api/startup-warmup.ts` | `cache` | L2: * REQ-202: Startup cache warmup helper |
| RISK-0471 | low | High Attention File | `src/api/startup-warmup.ts` | `attention_score=100` | L2: * REQ-202: Startup cache warmup helper |
| RISK-0472 | high | Security Boundary | `src/api/websocket-handler.ts` | `auth` | L11: * - JWT auth middleware on connection |
| RISK-0473 | medium | Network Or IPC | `src/api/websocket-handler.ts` | `socket` | path contains `socket` |
| RISK-0474 | medium | Parser Or Heuristic | `src/api/websocket-handler.ts` | `json` | L15: import * as jwt from 'jsonwebtoken'; |
| RISK-0475 | low | High Attention File | `src/api/websocket-handler.ts` | `attention_score=100` | L2: * TASK-0047: WebSocket Real-time Progress Notification |
| RISK-0476 | medium | Persistence Or State | `src/components/AudioUploader.tsx` | `state` | L1: import { useState, useRef, useCallback, memo } from 'react'; |
| RISK-0477 | medium | Concurrency Or Timing | `src/components/EnhancedFileUploader.tsx` | `timeout` | L84: setTimeout(() => { |
| RISK-0478 | medium | Persistence Or State | `src/components/EnhancedFileUploader.tsx` | `state` | L16: import React, { useState, useCallback, useRef, DragEvent } from 'react'; |
| RISK-0479 | medium | Persistence Or State | `src/components/EnhancedVideoPreview.tsx` | `state` | L14: import React, { useState, useRef, useEffect, useCallback } from 'react'; |
| RISK-0480 | medium | Concurrency Or Timing | `src/components/ErrorAlertSystem.tsx` | `async` | L152: const executeRecovery = async (errorId: string, strategyName: string) => { |
| RISK-0481 | medium | Persistence Or State | `src/components/ErrorAlertSystem.tsx` | `state` | L7: import React, { useState, useEffect } from 'react'; |
| RISK-0482 | medium | Concurrency Or Timing | `src/components/FrameworkDashboard.tsx` | `async` | L164: const fetchIterationData = async () => { |
| RISK-0483 | medium | Persistence Or State | `src/components/FrameworkDashboard.tsx` | `state` | L14: import React, { useState, useEffect } from 'react'; |
| RISK-0484 | medium | Concurrency Or Timing | `src/components/FrameworkDashboardPage.tsx` | `async` | L32: const handleExecute = async (phase: string) => { |
| RISK-0485 | medium | Concurrency Or Timing | `src/components/InteractiveResultViewer.tsx` | `async` | L147: const generateSceneThumbnail = async (scene: Record<string, unknown>, index: number): Promise<string> => { |
| RISK-0486 | medium | Persistence Or State | `src/components/InteractiveResultViewer.tsx` | `state` | L41: interface ViewState { |
| RISK-0487 | medium | Concurrency Or Timing | `src/components/Iteration43Interface.tsx` | `await` | L110: await new Promise(resolve => setTimeout(resolve, 1000)); |
| RISK-0488 | medium | Persistence Or State | `src/components/Iteration43Interface.tsx` | `state` | L1: import React, { useState, useEffect, useCallback } from 'react'; |
| RISK-0489 | low | High Attention File | `src/components/Iteration43Interface.tsx` | `attention_score=98` | L38: memoryUsage: number; |
| RISK-0490 | medium | Persistence Or State | `src/components/PerformanceMetricsVisualization.tsx` | `state` | L13: import React, { useState, useEffect } from 'react'; |
| RISK-0491 | medium | Network Or IPC | `src/components/PipelineProgress.tsx` | `socket` | L4: * global progress bar, ETA, quality score, and WebSocket integration. |
| RISK-0492 | low | High Attention File | `src/components/PipelineProgress.tsx` | `attention_score=100` | L4: * global progress bar, ETA, quality score, and WebSocket integration. |
| RISK-0493 | low | High Attention File | `src/components/ProcessingStatus.tsx` | `attention_score=84` | L1: import { memo, useMemo } from 'react'; |
| RISK-0494 | medium | Concurrency Or Timing | `src/components/ProductionDashboard.tsx` | `timeout` | L175: <Label htmlFor="timeout">Timeout (ms)</Label> |
| RISK-0495 | medium | Parser Or Heuristic | `src/components/ProductionDashboard.tsx` | `parse` | L152: maxConcurrentJobs: parseInt(e.target.value) \|\| 1 |
| RISK-0496 | medium | Persistence Or State | `src/components/ProductionDashboard.tsx` | `state` | L7: import React, { useState, useEffect } from 'react'; |
| RISK-0497 | low | High Attention File | `src/components/ProductionDashboard.tsx` | `attention_score=100` | L119: <Label>Available Memory</Label> |
| RISK-0498 | medium | Network Or IPC | `src/components/SimplePipelineInterface.tsx` | `ipc` | L10: TooltipContent, |
| RISK-0499 | medium | Persistence Or State | `src/components/SimplePipelineInterface.tsx` | `state` | L44: const [state, dispatch] = useReducer(pipelineReducer, initialPipelineState); |
| RISK-0500 | low | High Attention File | `src/components/SimplePipelineInterface.tsx` | `attention_score=100` | L10: TooltipContent, |
| RISK-0501 | medium | Concurrency Or Timing | `src/components/SimplePipelineStateMachine.ts` | `retry` | L4: * Any state can transition to error, error -> idle for retry/reset |
| RISK-0502 | medium | Persistence Or State | `src/components/SimplePipelineStateMachine.ts` | `state` | path contains `state` |
| RISK-0503 | medium | Network Or IPC | `src/components/StageIndicator.tsx` | `ipc` | L21: TooltipContent, |
| RISK-0504 | low | High Attention File | `src/components/StageIndicator.tsx` | `attention_score=100` | L7: import { memo, useMemo, type FC } from 'react'; |
| RISK-0505 | medium | Concurrency Or Timing | `src/components/StreamingProcessor.tsx` | `timeout` | L79: const statsTimer = useRef<NodeJS.Timeout \| null>(null); |
| RISK-0506 | medium | Persistence Or State | `src/components/StreamingProcessor.tsx` | `state` | L7: import React, { useState, useCallback, useRef, useEffect } from 'react'; |
| RISK-0507 | medium | Parser Or Heuristic | `src/components/TutorialSystem.tsx` | `parse` | L58: const parsed = JSON.parse(savedProgress); |
| RISK-0508 | medium | Persistence Or State | `src/components/TutorialSystem.tsx` | `state` | L7: import React, { useState, useEffect } from 'react'; |
| RISK-0509 | low | High Attention File | `src/components/TutorialSystem.tsx` | `attention_score=70` | L46: // ISS-014: Wrap all localStorage access in try-catch for private browsing / quota errors |
| RISK-0510 | medium | Persistence Or State | `src/components/VideoGenerationPanel.tsx` | `state` | L6: import React, { useState, useCallback, useEffect } from 'react'; |
| RISK-0511 | medium | Parser Or Heuristic | `src/components/VideoPreview.tsx` | `fallback` | L187: // Empty scenes fallback |
| RISK-0512 | medium | Persistence Or State | `src/components/VideoPreview.tsx` | `state` | L6: import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'; |
| RISK-0513 | medium | Concurrency Or Timing | `src/components/VideoRenderer.tsx` | `async` | L30: const handleRender = async () => { |
| RISK-0514 | medium | Persistence Or State | `src/components/VideoRenderer.tsx` | `state` | L1: import {useState, memo, useCallback, useMemo} from 'react'; |
| RISK-0515 | medium | Concurrency Or Timing | `src/components/__tests__/AudioUploader.test.tsx` | `await` | L197: await new Promise(r => setTimeout(r, 0)); |
| RISK-0516 | low | High Attention File | `src/components/__tests__/AudioUploader.test.tsx` | `attention_score=100` | L197: await new Promise(r => setTimeout(r, 0)); |
| RISK-0517 | medium | Concurrency Or Timing | `src/components/__tests__/SimplePipelineInterface.test.tsx` | `retry` | L172: it('should transition from error to idle on RETRY', () => { |
| RISK-0518 | medium | Persistence Or State | `src/components/__tests__/SimplePipelineInterface.test.tsx` | `state` | L177: state = pipelineReducer(state, { type: 'RETRY' }); |
| RISK-0519 | low | High Attention File | `src/components/__tests__/SimplePipelineInterface.test.tsx` | `attention_score=70` | L172: it('should transition from error to idle on RETRY', () => { |
| RISK-0520 | medium | Parser Or Heuristic | `src/components/__tests__/StageIndicator.test.ts` | `fallback` | L58: it('uses Date.now() as fallback when nowMs and completedAt are null', () => { |
| RISK-0521 | medium | Concurrency Or Timing | `src/components/pipeline-interface.tsx` | `async` | L103: const saveAudioFile = async (file: File): Promise<string> => { |
| RISK-0522 | medium | Persistence Or State | `src/components/pipeline-interface.tsx` | `state` | L1: import React, { useState, useCallback } from 'react'; |
| RISK-0523 | high | Security Boundary | `src/components/ui/alert.tsx` | `auth` | L2: import { cva, type VariantProps } from "class-variance-authority"; |
| RISK-0524 | high | Security Boundary | `src/components/ui/badge.tsx` | `auth` | L2: import { cva, type VariantProps } from "class-variance-authority"; |
| RISK-0525 | high | Security Boundary | `src/components/ui/button.tsx` | `auth` | L3: import { cva, type VariantProps } from "class-variance-authority"; |
| RISK-0526 | high | Security Boundary | `src/components/ui/label.tsx` | `auth` | L3: import { cva, type VariantProps } from "class-variance-authority"; |
| RISK-0527 | high | Security Boundary | `src/components/ui/sheet.tsx` | `auth` | L2: import { cva, type VariantProps } from "class-variance-authority"; |
| RISK-0528 | high | Security Boundary | `src/components/ui/toast.tsx` | `auth` | L3: import { cva, type VariantProps } from "class-variance-authority"; |
| RISK-0529 | medium | Network Or IPC | `src/components/ui/tooltip.tsx` | `ipc` | L12: const TooltipContent = React.forwardRef< |
| RISK-0530 | medium | Parser Or Heuristic | `src/config/__tests__/env.test.ts` | `parse` | L1: import { getConfig, resetConfig, parseBoolean, parseNumber, maskSensitiveValue, getMaskedConfig } from '../env'; |
| RISK-0531 | low | High Attention File | `src/config/__tests__/env.test.ts` | `attention_score=100` | L1: import { getConfig, resetConfig, parseBoolean, parseNumber, maskSensitiveValue, getMaskedConfig } from '../env'; |
| RISK-0532 | medium | Persistence Or State | `src/config/__tests__/validate.test.ts` | `cache` | L11: cacheSize: 200, |
| RISK-0533 | medium | Parser Or Heuristic | `src/config/code-size-audit.ts` | `parse` | L186: const pkg = JSON.parse(raw) as { |
| RISK-0534 | medium | Parser Or Heuristic | `src/config/env.ts` | `parse` | L8: * Parses a string environment variable as a boolean. |
| RISK-0535 | medium | Persistence Or State | `src/config/env.ts` | `cache` | L4: /** Cached singleton config instance */ |
| RISK-0536 | low | High Attention File | `src/config/env.ts` | `attention_score=100` | L4: /** Cached singleton config instance */ |
| RISK-0537 | medium | Parser Or Heuristic | `src/config/index.ts` | `parse` | L8: export { getConfig, resetConfig, parseBoolean, parseNumber, maskSensitiveValue, getMaskedConfig } from './env'; |
| RISK-0538 | medium | Concurrency Or Timing | `src/config/limits.ts` | `timeout` | L41: /** Default request timeout in milliseconds */ |
| RISK-0539 | low | High Attention File | `src/config/limits.ts` | `attention_score=100` | L4: * All magic numbers that govern rate limiting, job concurrency, |
| RISK-0540 | medium | Concurrency Or Timing | `src/config/production-config.ts` | `timeout` | L32: timeoutMs: number; |
| RISK-0541 | medium | Parser Or Heuristic | `src/config/production-config.ts` | `fallback` | L86: * Safely get NODE_ENV with browser-compatible fallback (ISS-012) |
| RISK-0542 | medium | Persistence Or State | `src/config/production-config.ts` | `cache` | L33: cacheStrategy: 'memory' \| 'redis' \| 'hybrid'; |
| RISK-0543 | low | High Attention File | `src/config/production-config.ts` | `attention_score=100` | L31: memoryLimit: number; // in MB |
| RISK-0544 | medium | Persistence Or State | `src/config/schema.ts` | `cache` | L12: cacheSize: number; |
| RISK-0545 | high | Security Boundary | `src/config/validate.ts` | `secret` | L138: export function validateJwtSecret(secret: string): ValidationError[] { |
| RISK-0546 | medium | Persistence Or State | `src/config/validate.ts` | `cache` | L72: if (config.cacheSize !== undefined) { |
| RISK-0547 | low | High Attention File | `src/config/validate.ts` | `attention_score=84` | L72: if (config.cacheSize !== undefined) { |
| RISK-0548 | medium | Parser Or Heuristic | `src/export/__tests__/enhanced-export-engine.test.ts` | `parse` | L15: parsePngChunks, |
| RISK-0549 | low | High Attention File | `src/export/__tests__/enhanced-export-engine.test.ts` | `attention_score=100` | L15: parsePngChunks, |
| RISK-0550 | medium | Concurrency Or Timing | `src/export/apng-encoder.ts` | `lock` | L73: const blockCount = Math.ceil(raw.length / maxBlock) \|\| 1; |
| RISK-0551 | medium | Parser Or Heuristic | `src/export/apng-encoder.ts` | `parse` | L254: export function parsePngChunks(apng: Uint8Array): PngChunkInfo[] { |
| RISK-0552 | low | High Attention File | `src/export/apng-encoder.ts` | `attention_score=100` | L68: /** Wrap raw bytes in a zlib "store" (no-compression) container */ |
| RISK-0553 | high | Security Boundary | `src/export/enhanced-export-engine.ts` | `auth` | L84: author?: string; |
| RISK-0554 | medium | Concurrency Or Timing | `src/export/enhanced-export-engine.ts` | `async` | L249: private async processExportJob(job: ExportJob): Promise<ExportResult> { |
| RISK-0555 | low | High Attention File | `src/export/enhanced-export-engine.ts` | `attention_score=100` | L84: author?: string; |
| RISK-0556 | medium | Concurrency Or Timing | `src/export/export-ui.tsx` | `async` | L78: const handleExport = async () => { |
| RISK-0557 | medium | Parser Or Heuristic | `src/export/export-ui.tsx` | `parse` | L252: quality: { fps: parseInt(value) as VideoQuality['fps'] } |
| RISK-0558 | medium | Persistence Or State | `src/export/export-ui.tsx` | `state` | L8: import React, { useState, useEffect } from 'react'; |
| RISK-0559 | medium | Parser Or Heuristic | `src/export/export-verifier.ts` | `parse` | L312: const parsed = JSON.parse(text); |
| RISK-0560 | low | High Attention File | `src/export/export-verifier.ts` | `attention_score=100` | L77: private readonly options: VerificationOptions; |
| RISK-0561 | medium | Concurrency Or Timing | `src/export/multi-format-exporter.ts` | `async` | L85: private async exportSVG( |
| RISK-0562 | medium | Parser Or Heuristic | `src/export/multi-format-exporter.ts` | `json` | L192: private exportJSON( |
| RISK-0563 | low | High Attention File | `src/export/multi-format-exporter.ts` | `attention_score=100` | L49: private defaultWidth = 1920; |
| RISK-0564 | medium | Concurrency Or Timing | `src/export/production-exporter.ts` | `async` | L237: private async processJob(jobId: string): Promise<void> { |
| RISK-0565 | low | High Attention File | `src/export/production-exporter.ts` | `attention_score=100` | L65: * Internal types for production exporter pipeline |
| RISK-0566 | low | High Attention File | `src/framework/__tests__/auto-improvement-engine.test.ts` | `attention_score=100` | L42: memoryUsage: 300, |
| RISK-0567 | medium | Concurrency Or Timing | `src/framework/__tests__/continuous-learner.test.ts` | `async` | L280: it('should reflect data after recording processing results', async () => { |
| RISK-0568 | medium | Persistence Or State | `src/framework/__tests__/continuous-learner.test.ts` | `database` | L660: // Access internal database to get IDs |
| RISK-0569 | low | High Attention File | `src/framework/__tests__/continuous-learner.test.ts` | `attention_score=98` | L166: ['timeout', 'memory_overflow'], |
| RISK-0570 | low | High Attention File | `src/framework/auto-improvement-engine.ts` | `attention_score=100` | L20: memoryUsage: number; // MB |
| RISK-0571 | medium | Concurrency Or Timing | `src/framework/continuous-learner.ts` | `async` | L162: private async analyzeNewData(data: LearningData): Promise<void> { |
| RISK-0572 | medium | Persistence Or State | `src/framework/continuous-learner.ts` | `database` | L54: private learningDatabase: LearningData[] = []; |
| RISK-0573 | low | High Attention File | `src/framework/continuous-learner.ts` | `attention_score=100` | L54: private learningDatabase: LearningData[] = []; |
| RISK-0574 | medium | Concurrency Or Timing | `src/framework/iteration-manager.ts` | `retry` | L20: export type RecoveryStrategy = 'retry' \| 'fallback' \| 'minimal' \| 'manual'; |
| RISK-0575 | medium | Parser Or Heuristic | `src/framework/iteration-manager.ts` | `parse` | L153: const threshold = parseInt(percentMatch[1]); |
| RISK-0576 | low | High Attention File | `src/framework/iteration-manager.ts` | `attention_score=100` | L20: export type RecoveryStrategy = 'retry' \| 'fallback' \| 'minimal' \| 'manual'; |
| RISK-0577 | medium | Concurrency Or Timing | `src/framework/recursive-custom-instructions.ts` | `async` | L198: private async runQualityChecks(): Promise<QualityCheckResults> { |
| RISK-0578 | medium | Persistence Or State | `src/framework/recursive-custom-instructions.ts` | `state` | L86: private currentState: IterationState; |
| RISK-0579 | low | High Attention File | `src/framework/recursive-custom-instructions.ts` | `attention_score=100` | L30: memoryUsage: number; |
| RISK-0580 | high | Destructive Mutation | `src/hooks/use-toast.ts` | `delete` | L61: toastTimeouts.delete(toastId); |
| RISK-0581 | medium | Concurrency Or Timing | `src/hooks/use-toast.ts` | `timeout` | L53: const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>(); |
| RISK-0582 | medium | Persistence Or State | `src/hooks/use-toast.ts` | `state` | L126: let memoryState: State = { toasts: [] }; |
| RISK-0583 | low | High Attention File | `src/hooks/use-toast.ts` | `attention_score=100` | L53: const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>(); |
| RISK-0584 | medium | Persistence Or State | `src/hooks/useFrameworkPipeline.ts` | `state` | L19: interface ExecutionState { |
| RISK-0585 | low | High Attention File | `src/hooks/useFrameworkPipeline.ts` | `attention_score=92` | L2: * Phase 41: useFrameworkPipeline Hook |
| RISK-0586 | high | Security Boundary | `src/integrations/__tests__/auth.test.ts` | `auth` | path contains `auth` |
| RISK-0587 | medium | Concurrency Or Timing | `src/integrations/__tests__/auth.test.ts` | `async` | L38: it('should call signInWithPassword and return auth state', async () => { |
| RISK-0588 | medium | Parser Or Heuristic | `src/integrations/__tests__/auth.test.ts` | `json` | L3: import * as jwt from 'jsonwebtoken'; |
| RISK-0589 | medium | Persistence Or State | `src/integrations/__tests__/auth.test.ts` | `state` | L6: // 1) Auth functions tests (signIn / signOut / signUp / onAuthStateChange) |
| RISK-0590 | low | High Attention File | `src/integrations/__tests__/auth.test.ts` | `attention_score=100` | L3: import * as jwt from 'jsonwebtoken'; |
| RISK-0591 | high | Security Boundary | `src/integrations/__tests__/client.test.ts` | `auth` | L38: const fakeClient = { auth: {} }; |
| RISK-0592 | low | High Attention File | `src/integrations/__tests__/client.test.ts` | `attention_score=98` | L38: const fakeClient = { auth: {} }; |
| RISK-0593 | high | Security Boundary | `src/integrations/supabase/auth.ts` | `auth` | path contains `auth` |
| RISK-0594 | medium | Concurrency Or Timing | `src/integrations/supabase/auth.ts` | `async` | L16: export async function signIn(credentials: SignInWithPasswordCredentials): Promise<AuthState> { |
| RISK-0595 | medium | Persistence Or State | `src/integrations/supabase/auth.ts` | `state` | L10: export interface AuthState { |
| RISK-0596 | low | High Attention File | `src/integrations/supabase/auth.ts` | `attention_score=100` | L2: AuthChangeEvent, |
| RISK-0597 | high | Security Boundary | `src/integrations/supabase/client.ts` | `auth` | L40: auth: { |
| RISK-0598 | medium | Persistence Or State | `src/integrations/supabase/client.ts` | `database` | L32: export function getSupabaseClient(): SupabaseClient<Database> { |
| RISK-0599 | medium | Parser Or Heuristic | `src/integrations/supabase/types.ts` | `json` | L1: export type Json = |
| RISK-0600 | medium | Persistence Or State | `src/integrations/supabase/types.ts` | `database` | L63: type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase"> |
| RISK-0601 | low | High Attention File | `src/integrations/supabase/types.ts` | `attention_score=100` | L12: __InternalSupabase: { |
| RISK-0602 | medium | Concurrency Or Timing | `src/lib/actualVideoRenderer.ts` | `async` | L131: private async bundleComposition( |
| RISK-0603 | medium | Parser Or Heuristic | `src/lib/actualVideoRenderer.ts` | `parse` | L153: const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')); |
| RISK-0604 | medium | Persistence Or State | `src/lib/actualVideoRenderer.ts` | `cache` | L33: private bundleCachePath: string \| null = null; |
| RISK-0605 | low | High Attention File | `src/lib/actualVideoRenderer.ts` | `attention_score=100` | L33: private bundleCachePath: string \| null = null; |
| RISK-0606 | medium | Concurrency Or Timing | `src/lib/videoRenderer.ts` | `async` | L74: private async simulateRender( |
| RISK-0607 | medium | Concurrency Or Timing | `src/monitoring/health-check-service.ts` | `await` | L64: checks.memory = await this.checkMemoryHealth(); |
| RISK-0608 | medium | Persistence Or State | `src/monitoring/health-check-service.ts` | `cache` | L10: import { globalCache } from '@/performance/intelligent-cache'; |
| RISK-0609 | low | High Attention File | `src/monitoring/health-check-service.ts` | `attention_score=100` | L9: import { realTimeMonitor, PerformanceSnapshot } from './real-time-performance-monitor'; |
| RISK-0610 | high | Security Boundary | `src/monitoring/performance-dashboard.ts` | `token` | L10: import { TokenUsageTracker, type StageType } from '../analysis/token-usage-tracker'; |
| RISK-0611 | medium | Persistence Or State | `src/monitoring/performance-dashboard.ts` | `cache` | L12: import { globalCache } from '../performance/intelligent-cache'; |
| RISK-0612 | low | High Attention File | `src/monitoring/performance-dashboard.ts` | `attention_score=100` | L8: import { getMemoryUsage } from '@/utils/memory-usage'; |
| RISK-0613 | high | Security Boundary | `src/monitoring/production-error-handler.ts` | `session` | L13: sessionId: string; |
| RISK-0614 | medium | Concurrency Or Timing | `src/monitoring/production-error-handler.ts` | `timeout` | L61: private metricsIntervalId: NodeJS.Timeout \| null = null; |
| RISK-0615 | low | High Attention File | `src/monitoring/production-error-handler.ts` | `attention_score=100` | L13: sessionId: string; |
| RISK-0616 | low | High Attention File | `src/monitoring/production-monitor.ts` | `attention_score=100` | L88: private static instance: ProductionMonitor; |
| RISK-0617 | medium | Concurrency Or Timing | `src/monitoring/production-monitoring-excellence.ts` | `async` | L491: export async function executeMonitoringEnhancement(): Promise<MonitoringEnhancement> { |
| RISK-0618 | medium | Persistence Or State | `src/monitoring/production-monitoring-excellence.ts` | `cache` | L78: cache: HealthMetric; |
| RISK-0619 | low | High Attention File | `src/monitoring/production-monitoring-excellence.ts` | `attention_score=100` | L74: memory: HealthMetric; |
| RISK-0620 | medium | Network Or IPC | `src/monitoring/real-time-performance-monitor.ts` | `socket` | L5: * Provides WebSocket-based real-time metrics streaming for production monitoring |
| RISK-0621 | medium | Persistence Or State | `src/monitoring/real-time-performance-monitor.ts` | `cache` | L49: cacheHitRate: number; |
| RISK-0622 | low | High Attention File | `src/monitoring/real-time-performance-monitor.ts` | `attention_score=100` | L5: * Provides WebSocket-based real-time metrics streaming for production monitoring |
| RISK-0623 | medium | Parser Or Heuristic | `src/optimization/__tests__/smart-parameter-tuner.test.ts` | `fallback` | L345: // With 0 duration, uses fallback of 60s |
| RISK-0624 | medium | Concurrency Or Timing | `src/optimization/adaptive-content-processor.ts` | `retry` | L16: retryCount: number; |
| RISK-0625 | medium | Persistence Or State | `src/optimization/adaptive-content-processor.ts` | `cache` | L122: // Check for cached strategy |
| RISK-0626 | low | High Attention File | `src/optimization/adaptive-content-processor.ts` | `attention_score=100` | L7: import { performance } from 'perf_hooks'; |
| RISK-0627 | medium | Concurrency Or Timing | `src/optimization/batch-optimizer.ts` | `async` | L134: private async processChunk<I, O>( |
| RISK-0628 | medium | Persistence Or State | `src/optimization/cache-warmup.ts` | `cache` | path contains `cache` |
| RISK-0629 | low | High Attention File | `src/optimization/cache-warmup.ts` | `attention_score=100` | L2: * Cache Warmup Strategy for LLM Semantic Cache |
| RISK-0630 | medium | Persistence Or State | `src/optimization/computation-cache.ts` | `cache` | path contains `cache` |
| RISK-0631 | low | High Attention File | `src/optimization/computation-cache.ts` | `attention_score=100` | L2: * Computation Cache - Memoization with cache invalidation |
| RISK-0632 | medium | Concurrency Or Timing | `src/optimization/lazy-loader.ts` | `async` | L59: private async executeLoad<T>(key: string, loader: ModuleLoader<T>): Promise<T> { |
| RISK-0633 | medium | Persistence Or State | `src/optimization/lazy-loader.ts` | `cache` | L26: private cache: Map<string, LazyModule<unknown>> = new Map(); |
| RISK-0634 | low | High Attention File | `src/optimization/lazy-loader.ts` | `attention_score=100` | L26: private cache: Map<string, LazyModule<unknown>> = new Map(); |
| RISK-0635 | medium | Persistence Or State | `src/optimization/memory-cache.ts` | `cache` | path contains `cache` |
| RISK-0636 | low | High Attention File | `src/optimization/memory-cache.ts` | `attention_score=100` | L2: * Memory Cache - LRU cache with TTL support |
| RISK-0637 | medium | Parser Or Heuristic | `src/optimization/smart-parameter-tuner.ts` | `fallback` | L50: const duration = audioMetadata.duration \|\| 60; // fallback duration |
| RISK-0638 | low | High Attention File | `src/optimization/smart-parameter-tuner.ts` | `attention_score=100` | L8: import { performance } from 'perf_hooks'; |
| RISK-0639 | medium | Concurrency Or Timing | `src/pages/Index.tsx` | `async` | L23: const handleUpload = async (file: File) => { |
| RISK-0640 | medium | Persistence Or State | `src/pages/Index.tsx` | `state` | L1: import { useState } from 'react'; |
| RISK-0641 | medium | Concurrency Or Timing | `src/pages/__tests__/SimplePipeline.test.tsx` | `await` | L43: const SimplePipeline = (await import('../SimplePipeline')).default; |
| RISK-0642 | medium | Concurrency Or Timing | `src/performance/__tests__/intelligent-cache-robustness.test.ts` | `async` | L45: test('should handle complex data types in cache', async () => { |
| RISK-0643 | medium | Parser Or Heuristic | `src/performance/__tests__/intelligent-cache-robustness.test.ts` | `parse` | L2: * Tests for ISS-019: JSON.parse robustness in intelligent-cache.ts decompressData |
| RISK-0644 | medium | Persistence Or State | `src/performance/__tests__/intelligent-cache-robustness.test.ts` | `cache` | path contains `cache` |
| RISK-0645 | low | High Attention File | `src/performance/__tests__/intelligent-cache-robustness.test.ts` | `attention_score=100` | L2: * Tests for ISS-019: JSON.parse robustness in intelligent-cache.ts decompressData |
| RISK-0646 | medium | Parser Or Heuristic | `src/performance/__tests__/intelligent-cache.test.ts` | `json` | L1818: const customKeyGen = (args: unknown[]) => `custom-${JSON.stringify(args)}`; |
| RISK-0647 | medium | Persistence Or State | `src/performance/__tests__/intelligent-cache.test.ts` | `cache` | path contains `cache` |
| RISK-0648 | low | High Attention File | `src/performance/__tests__/intelligent-cache.test.ts` | `attention_score=100` | L2: * Comprehensive tests for IntelligentCache |
| RISK-0649 | medium | Persistence Or State | `src/performance/index.ts` | `cache` | L1: export { IntelligentCache, globalCache } from './intelligent-cache'; |
| RISK-0650 | medium | Persistence Or State | `src/performance/intelligent-cache.ts` | `cache` | path contains `cache` |
| RISK-0651 | low | High Attention File | `src/performance/intelligent-cache.ts` | `attention_score=100` | L5: * performance, memory efficiency, and intelligent content matching. |
| RISK-0652 | low | High Attention File | `src/pipeline/__tests__/adaptive-quality-presets.test.ts` | `attention_score=70` | L56: expect(preset.expectedMetrics).toHaveProperty('memoryUsageMax'); |
| RISK-0653 | medium | Parser Or Heuristic | `src/pipeline/__tests__/improvement-detector.test.ts` | `fallback` | L38: fallbackTriggered: false, |
| RISK-0654 | low | High Attention File | `src/pipeline/__tests__/improvement-detector.test.ts` | `attention_score=100` | L34: memoryUsage: 300, |
| RISK-0655 | medium | Parser Or Heuristic | `src/pipeline/__tests__/pipeline-quality-monitor.test.ts` | `fallback` | L62: fallbackTriggered: false, |
| RISK-0656 | medium | Persistence Or State | `src/pipeline/__tests__/pipeline-quality-monitor.test.ts` | `cache` | L90: cacheHitRate: 0.8, |
| RISK-0657 | low | High Attention File | `src/pipeline/__tests__/pipeline-quality-monitor.test.ts` | `attention_score=100` | L58: memoryUsage: 300, |
| RISK-0658 | medium | Concurrency Or Timing | `src/pipeline/__tests__/retry.test.ts` | `await` | L13: const { result } = await retryWithBackoff(fn); |
| RISK-0659 | low | High Attention File | `src/pipeline/__tests__/retry.test.ts` | `attention_score=100` | L2: * Unit tests for src/pipeline/retry.ts — retryWithBackoff |
| RISK-0660 | medium | Concurrency Or Timing | `src/pipeline/__tests__/simple-pipeline.test.ts` | `async` | L378: it('should retry on failure and eventually succeed', async () => { |
| RISK-0661 | low | High Attention File | `src/pipeline/__tests__/simple-pipeline.test.ts` | `attention_score=70` | L377: describe('processWithRetry', () => { |
| RISK-0662 | medium | Parser Or Heuristic | `src/pipeline/__tests__/video-generator.test.ts` | `fallback` | L218: content: 'Scene without layout data for testing fallback behavior', |
| RISK-0663 | high | Security Boundary | `src/pipeline/adaptive-quality-presets.ts` | `token` | L38: llmMaxTokens: number; |
| RISK-0664 | medium | Concurrency Or Timing | `src/pipeline/adaptive-quality-presets.ts` | `timeout` | L39: llmTimeout: number; |
| RISK-0665 | medium | Persistence Or State | `src/pipeline/adaptive-quality-presets.ts` | `cache` | L40: enableLLMCache: boolean; |
| RISK-0666 | low | High Attention File | `src/pipeline/adaptive-quality-presets.ts` | `attention_score=100` | L38: llmMaxTokens: number; |
| RISK-0667 | high | Security Boundary | `src/pipeline/cost-efficiency-metrics.ts` | `token` | L6: * - tokens per analysis (total tokens / analysis count) |
| RISK-0668 | low | High Attention File | `src/pipeline/cost-efficiency-metrics.ts` | `attention_score=100` | L6: * - tokens per analysis (total tokens / analysis count) |
| RISK-0669 | low | High Attention File | `src/pipeline/framework-integrated-pipeline.ts` | `attention_score=100` | L19: import { getHeapUsed } from '@/utils/memory-usage'; |
| RISK-0670 | low | High Attention File | `src/pipeline/improvement-detector.ts` | `attention_score=100` | L46: private qualityMonitor: QualityMonitor; |
| RISK-0671 | medium | Concurrency Or Timing | `src/pipeline/index.ts` | `retry` | L3: export { retryWithBackoff } from './retry'; |
| RISK-0672 | medium | Concurrency Or Timing | `src/pipeline/main-pipeline.ts` | `await` | L678: const layouts = (await Promise.all(layoutPromises)).filter(Boolean); |
| RISK-0673 | medium | Persistence Or State | `src/pipeline/main-pipeline.ts` | `cache` | L8: import { globalCache } from '@/performance/intelligent-cache'; |
| RISK-0674 | low | High Attention File | `src/pipeline/main-pipeline.ts` | `attention_score=100` | L8: import { globalCache } from '@/performance/intelligent-cache'; |
| RISK-0675 | medium | Parser Or Heuristic | `src/pipeline/parallel-benchmark.ts` | `fallback` | L60: const parallelMs = par?.durationMs ?? seq.durationMs; // fallback: treat as sequential |
| RISK-0676 | medium | Concurrency Or Timing | `src/pipeline/parallel-layout-executor.ts` | `async` | L27: export async function runWithConcurrency<T, R>( |
| RISK-0677 | low | High Attention File | `src/pipeline/parallel-layout-executor.ts` | `attention_score=100` | L5: * with configurable concurrency limits and optional retry support. |
| RISK-0678 | low | High Attention File | `src/pipeline/performance-baseline.ts` | `attention_score=100` | L4: * Defines timing and memory baselines for each pipeline stage. |
| RISK-0679 | high | Security Boundary | `src/pipeline/pipeline-health-score.ts` | `token` | L10: * - Cost efficiency: 25% (cost/token regression) |
| RISK-0680 | low | High Attention File | `src/pipeline/pipeline-health-score.ts` | `attention_score=100` | L10: * - Cost efficiency: 25% (cost/token regression) |
| RISK-0681 | medium | Concurrency Or Timing | `src/pipeline/pipeline-orchestrator.ts` | `retry` | L41: import { retryWithBackoff } from './retry'; |
| RISK-0682 | medium | Parser Or Heuristic | `src/pipeline/pipeline-orchestrator.ts` | `fallback` | L10: * - 3-tier fallback chain when quality gates fail |
| RISK-0683 | low | High Attention File | `src/pipeline/pipeline-orchestrator.ts` | `attention_score=100` | L10: * - 3-tier fallback chain when quality gates fail |
| RISK-0684 | medium | Parser Or Heuristic | `src/pipeline/quality-monitor.ts` | `fallback` | L35: fallbackTriggered: boolean; |
| RISK-0685 | medium | Persistence Or State | `src/pipeline/quality-monitor.ts` | `cache` | L18: cacheHitRate?: number; // 0-1 |
| RISK-0686 | low | High Attention File | `src/pipeline/quality-monitor.ts` | `attention_score=100` | L17: memoryUsage: number; // MB |
| RISK-0687 | high | Security Boundary | `src/pipeline/retry.ts` | `auth` | L6: * (UNKNOWN type, auth failures, etc.) propagate immediately. |
| RISK-0688 | medium | Concurrency Or Timing | `src/pipeline/retry.ts` | `async` | L47: export async function retryWithBackoff<T>( |
| RISK-0689 | low | High Attention File | `src/pipeline/retry.ts` | `attention_score=100` | L2: * Pipeline retry with exponential backoff, driven by ErrorClassifier. |
| RISK-0690 | medium | Concurrency Or Timing | `src/pipeline/simple-pipeline.ts` | `async` | L226: const processScene = async (segment: unknown, index: number): Promise<SceneGraph \| null> => { |
| RISK-0691 | low | High Attention File | `src/pipeline/simple-pipeline.ts` | `attention_score=100` | L15: import { getHeapUsed } from '@/utils/memory-usage'; |
| RISK-0692 | medium | Concurrency Or Timing | `src/pipeline/stage-timing-metrics.ts` | `async` | L70: export async function timeStage<T>( |
| RISK-0693 | low | High Attention File | `src/pipeline/stage-timing-metrics.ts` | `attention_score=98` | L16: /** Number of retry attempts that occurred during this stage (0 = no retries) */ |
| RISK-0694 | medium | Concurrency Or Timing | `src/pipeline/types.ts` | `retry` | L103: /** Total retry attempts across all stages (for observability) */ |
| RISK-0695 | low | High Attention File | `src/pipeline/types.ts` | `attention_score=70` | L78: * All fields are optional to remain backward-compatible with existing pipeline outputs. |
| RISK-0696 | medium | Concurrency Or Timing | `src/pipeline/video-generator.ts` | `thread` | L78: : 2; // Fallback to 2 threads |
| RISK-0697 | medium | Parser Or Heuristic | `src/pipeline/video-generator.ts` | `fallback` | L78: : 2; // Fallback to 2 threads |
| RISK-0698 | low | High Attention File | `src/pipeline/video-generator.ts` | `attention_score=100` | L65: private iteration: number = 1; |
| RISK-0699 | high | Security Boundary | `src/quality/__tests__/enhanced-error-recovery.test.ts` | `session` | L51: sessionId: 'test-session', |
| RISK-0700 | medium | Concurrency Or Timing | `src/quality/__tests__/enhanced-error-recovery.test.ts` | `retry` | L3: * Covers: EnhancedErrorRecovery class, CircuitBreaker, retryWithBackoff, |
| RISK-0701 | medium | Parser Or Heuristic | `src/quality/__tests__/enhanced-error-recovery.test.ts` | `fallback` | L4: * executeWithFallback, createErrorNotification, load balancing, resilience metrics, |
| RISK-0702 | medium | Persistence Or State | `src/quality/__tests__/enhanced-error-recovery.test.ts` | `cache` | L10: // Mock the intelligent-cache module - define mocks outside factory for test access |
| RISK-0703 | low | High Attention File | `src/quality/__tests__/enhanced-error-recovery.test.ts` | `attention_score=100` | L3: * Covers: EnhancedErrorRecovery class, CircuitBreaker, retryWithBackoff, |
| RISK-0704 | medium | Persistence Or State | `src/quality/adaptive-quality-gates.ts` | `cache` | L121: name: 'LLM Cache Hit Rate', |
| RISK-0705 | low | High Attention File | `src/quality/adaptive-quality-gates.ts` | `attention_score=100` | L9: import { realTimeMonitor, PerformanceSnapshot } from '@/monitoring/real-time-performance-monitor'; |
| RISK-0706 | high | Security Boundary | `src/quality/enhanced-error-recovery.ts` | `session` | L23: sessionId: string; |
| RISK-0707 | medium | Concurrency Or Timing | `src/quality/enhanced-error-recovery.ts` | `timeout` | L72: timeout: number; |
| RISK-0708 | medium | Parser Or Heuristic | `src/quality/enhanced-error-recovery.ts` | `fallback` | L41: fallbackUsed: boolean; |
| RISK-0709 | medium | Persistence Or State | `src/quality/enhanced-error-recovery.ts` | `cache` | L10: import { globalCache } from '../performance/intelligent-cache'; |
| RISK-0710 | low | High Attention File | `src/quality/enhanced-error-recovery.ts` | `attention_score=100` | L10: import { globalCache } from '../performance/intelligent-cache'; |
| RISK-0711 | medium | Concurrency Or Timing | `src/quality/error-classifier.ts` | `timeout` | L21: \| 'LLM_TIMEOUT' |
| RISK-0712 | low | High Attention File | `src/quality/error-classifier.ts` | `attention_score=100` | L21: \| 'LLM_TIMEOUT' |
| RISK-0713 | medium | Concurrency Or Timing | `src/quality/index.ts` | `retry` | L21: RetryOptions, |
| RISK-0714 | medium | Parser Or Heuristic | `src/quality/index.ts` | `fallback` | L23: FallbackResult, |
| RISK-0715 | medium | Concurrency Or Timing | `src/quality/quality-gate.ts` | `retry` | L39: fallbackAction?: 'retry' \| 'skip' \| 'abort'; |
| RISK-0716 | medium | Parser Or Heuristic | `src/quality/quality-gate.ts` | `fallback` | L39: fallbackAction?: 'retry' \| 'skip' \| 'abort'; |
| RISK-0717 | low | High Attention File | `src/quality/quality-gate.ts` | `attention_score=100` | L39: fallbackAction?: 'retry' \| 'skip' \| 'abort'; |
| RISK-0718 | medium | Concurrency Or Timing | `src/quality/quality-monitor.ts` | `async` | L184: private async assessPerformance(result: PipelineResult): Promise<number> { |
| RISK-0719 | low | High Attention File | `src/quality/quality-monitor.ts` | `attention_score=100` | L15: memoryUsage: number; |
| RISK-0720 | medium | Parser Or Heuristic | `src/quality/regression-detector.ts` | `parse` | L133: const parsed = JSON.parse(data); |
| RISK-0721 | low | High Attention File | `src/quality/regression-detector.ts` | `attention_score=100` | L64: private static instance: RegressionDetector; |
| RISK-0722 | medium | Concurrency Or Timing | `src/quality/user-guided-error-recovery.ts` | `await` | L118: const result = await retryFunction(); |
| RISK-0723 | medium | Parser Or Heuristic | `src/quality/user-guided-error-recovery.ts` | `fallback` | L7: * - Automatic retry with fallback strategies |
| RISK-0724 | low | High Attention File | `src/quality/user-guided-error-recovery.ts` | `attention_score=100` | L7: * - Automatic retry with fallback strategies |
| RISK-0725 | medium | Parser Or Heuristic | `src/remotion/CaptionOverlay.tsx` | `parse` | L9: import { SrtCaption } from './srt-parser'; |
| RISK-0726 | low | High Attention File | `src/remotion/EdgeAnimation.tsx` | `attention_score=100` | L3: * Edge drawing animation: 0.5s = 15 frames at 30fps |
| RISK-0727 | medium | Parser Or Heuristic | `src/remotion/__tests__/CaptionOverlay.test.tsx` | `parse` | L8: import { SrtCaption } from '../srt-parser'; |
| RISK-0728 | low | High Attention File | `src/remotion/__tests__/EdgeAnimation.test.tsx` | `attention_score=100` | L3: * Edge drawing animation: 0.5s = 15 frames at 30fps |
| RISK-0729 | low | High Attention File | `src/remotion/__tests__/animation-strategies.test.ts` | `attention_score=100` | L12: EDGE_DRAW_DURATION_FRAMES, |
| RISK-0730 | medium | Parser Or Heuristic | `src/remotion/__tests__/scene-synchronizer.test.ts` | `parse` | L16: import { SrtCaption } from '../srt-parser'; |
| RISK-0731 | medium | Parser Or Heuristic | `src/remotion/__tests__/srt-parser.test.ts` | `parse` | path contains `parse` |
| RISK-0732 | low | High Attention File | `src/remotion/__tests__/srt-parser.test.ts` | `attention_score=100` | L2: * Tests for srt-parser.ts |
| RISK-0733 | low | High Attention File | `src/remotion/animation-strategies.ts` | `attention_score=100` | L12: /** Edge drawing duration: 0.5s = 15 frames at 30fps */ |
| RISK-0734 | medium | Concurrency Or Timing | `src/remotion/renderer.ts` | `async` | L206: export async function renderVideo( |
| RISK-0735 | medium | Parser Or Heuristic | `src/remotion/scene-synchronizer.ts` | `parse` | L10: import { SrtCaption } from './srt-parser'; |
| RISK-0736 | low | High Attention File | `src/remotion/scene-synchronizer.ts` | `attention_score=70` | L10: import { SrtCaption } from './srt-parser'; |
| RISK-0737 | medium | Parser Or Heuristic | `src/remotion/srt-parser.ts` | `parse` | path contains `parse` |
| RISK-0738 | low | High Attention File | `src/remotion/srt-parser.ts` | `attention_score=100` | L2: * SRT (SubRip Text) Format Parser |
| RISK-0739 | medium | Concurrency Or Timing | `src/test/helpers.ts` | `async` | L39: export async function waitMs(ms: number): Promise<void> { |
| RISK-0740 | medium | Concurrency Or Timing | `src/test/layout/LayoutStrategy.test.ts` | `async` | L64: it('returns fallback layout with success=false when performLayout throws', async () => { |
| RISK-0741 | medium | Parser Or Heuristic | `src/test/layout/LayoutStrategy.test.ts` | `fallback` | L63: // ---------- apply() catch / fallback (lines 128-153) ---------- |
| RISK-0742 | low | High Attention File | `src/test/layout/LayoutStrategy.test.ts` | `attention_score=100` | L13: private shouldThrow: boolean; |
| RISK-0743 | medium | Concurrency Or Timing | `src/test/layout/OverlapResolver.test.ts` | `async` | L42: it('resolves overlapping nodes (fallback to grid if needed)', async () => { |
| RISK-0744 | medium | Parser Or Heuristic | `src/test/layout/OverlapResolver.test.ts` | `fallback` | L42: it('resolves overlapping nodes (fallback to grid if needed)', async () => { |
| RISK-0745 | low | High Attention File | `src/test/layout/OverlapResolver.test.ts` | `attention_score=100` | L6: /** Type helper to access OverlapResolver private members in tests */ |
| RISK-0746 | high | Destructive Mutation | `src/test/layout/ProgressiveForceStrategy.test.ts` | `force` | path contains `force` |
| RISK-0747 | medium | Concurrency Or Timing | `src/test/layout/layout-engine.test.ts` | `lock` | L217: // Trigger the catch block by mocking internal method |
| RISK-0748 | high | Security Boundary | `src/test/mocks/supabase.ts` | `auth` | L5: * storage operations, and auth helpers -- all backed by jest.fn(). |
| RISK-0749 | high | Destructive Mutation | `src/test/mocks/supabase.ts` | `delete` | L19: interface MockUpdateDeleteBuilder { |
| RISK-0750 | medium | Persistence Or State | `src/test/mocks/supabase.ts` | `state` | L34: onAuthStateChange: jest.Mock; |
| RISK-0751 | low | High Attention File | `src/test/mocks/supabase.ts` | `attention_score=100` | L5: * storage operations, and auth helpers -- all backed by jest.fn(). |
| RISK-0752 | medium | Parser Or Heuristic | `src/transcription/__tests__/audio-preprocessor.test.ts` | `heuristic` | L329: // 16000 bytes ≈ 1 second at 128kbps heuristic |
| RISK-0753 | low | High Attention File | `src/transcription/__tests__/audio-preprocessor.test.ts` | `attention_score=100` | L10: * 6. Buffer-size fallback estimation |
| RISK-0754 | medium | Concurrency Or Timing | `src/transcription/__tests__/browser-transcriber.test.ts` | `async` | L184: it('getBrowserCompatibility() がブラウザ情報を返す', async () => { |
| RISK-0755 | low | High Attention File | `src/transcription/__tests__/browser-transcriber.test.ts` | `attention_score=100` | L5: * Covers: start/stop, interim results, browser compatibility, error handling, pause/resume. |
| RISK-0756 | medium | Concurrency Or Timing | `src/transcription/__tests__/streaming-transcriber.test.ts` | `async` | L131: const loadModule = async () => { |
| RISK-0757 | medium | Concurrency Or Timing | `src/transcription/__tests__/transcriber.test.ts` | `async` | L103: it('should return fallback segments when whisper fails', async () => { |
| RISK-0758 | medium | Parser Or Heuristic | `src/transcription/__tests__/transcriber.test.ts` | `fallback` | L35: // Default: whisper returns failure so fallback segments are used |
| RISK-0759 | low | High Attention File | `src/transcription/__tests__/transcriber.test.ts` | `attention_score=100` | L35: // Default: whisper returns failure so fallback segments are used |
| RISK-0760 | medium | Network Or IPC | `src/transcription/__tests__/whisper-transcriber.test.ts` | `proxy` | L155: // Use generateSrt as proxy for segment handling |
| RISK-0761 | medium | Parser Or Heuristic | `src/transcription/__tests__/whisper-transcriber.test.ts` | `fallback` | L125: // by creating a transcriber that returns Japanese content via the fallback |
| RISK-0762 | low | High Attention File | `src/transcription/__tests__/whisper-transcriber.test.ts` | `attention_score=98` | L123: // We need to use a different approach: override internal method |
| RISK-0763 | medium | Parser Or Heuristic | `src/transcription/audio-preprocessor.ts` | `heuristic` | L416: * Assumes ~128kbps MP3-like encoding as a rough heuristic. |
| RISK-0764 | low | High Attention File | `src/transcription/audio-preprocessor.ts` | `attention_score=98` | L140: private readonly config: AudioPreprocessorConfig; |
| RISK-0765 | medium | Parser Or Heuristic | `src/transcription/browser-transcriber.ts` | `fallback` | L27: * Uses Web Speech API and fallback strategies for cross-browser compatibility |
| RISK-0766 | medium | Persistence Or State | `src/transcription/browser-transcriber.ts` | `state` | L38: private state: TranscriptionState = 'idle'; |
| RISK-0767 | low | High Attention File | `src/transcription/browser-transcriber.ts` | `attention_score=100` | L18: * Browser compatibility info |
| RISK-0768 | high | Security Boundary | `src/transcription/streaming-quality-monitor.ts` | `session` | L60: /** Alerts emitted during the session */ |
| RISK-0769 | low | High Attention File | `src/transcription/streaming-quality-monitor.ts` | `attention_score=100` | L60: /** Alerts emitted during the session */ |
| RISK-0770 | medium | Concurrency Or Timing | `src/transcription/streaming-transcriber.ts` | `await` | L158: await new Promise(resolve => setTimeout(resolve, 100)); |
| RISK-0771 | low | High Attention File | `src/transcription/streaming-transcriber.ts` | `attention_score=100` | L41: private config: StreamingTranscriptionConfig; |
| RISK-0772 | medium | Concurrency Or Timing | `src/transcription/transcriber.ts` | `async` | L96: private async runWhisperTranscription(audioPath: string): Promise<TranscriptionSegment[]> { |
| RISK-0773 | medium | Parser Or Heuristic | `src/transcription/transcriber.ts` | `fallback` | L93: * Enhanced transcription using Whisper with fallback strategies |
| RISK-0774 | low | High Attention File | `src/transcription/transcriber.ts` | `attention_score=100` | L13: private config: TranscriptionConfig; |
| RISK-0775 | medium | Concurrency Or Timing | `src/transcription/whisper-transcriber.ts` | `async` | L77: private async initializeWhisper(): Promise<void> { |
| RISK-0776 | medium | Parser Or Heuristic | `src/transcription/whisper-transcriber.ts` | `fallback` | L54: * Real implementation with fallback strategies (段階的フォールバック) |
| RISK-0777 | low | High Attention File | `src/transcription/whisper-transcriber.ts` | `attention_score=100` | L54: * Real implementation with fallback strategies (段階的フォールバック) |
| RISK-0778 | medium | Persistence Or State | `src/types/__tests__/cache.test.ts` | `cache` | path contains `cache` |
| RISK-0779 | low | High Attention File | `src/types/__tests__/cache.test.ts` | `attention_score=100` | L2: * Tests for Cache types |
| RISK-0780 | high | Security Boundary | `src/types/api/index.ts` | `auth` | L183: // Authentication Types |
| RISK-0781 | medium | Network Or IPC | `src/types/api/index.ts` | `socket` | L236: // WebSocket Event Types |
| RISK-0782 | medium | Concurrency Or Timing | `src/types/api/index.ts` | `rate limit` | L217: // Rate Limiting Types |
| RISK-0783 | low | High Attention File | `src/types/api/index.ts` | `attention_score=100` | L183: // Authentication Types |
| RISK-0784 | medium | Persistence Or State | `src/types/cache.ts` | `cache` | path contains `cache` |
| RISK-0785 | low | High Attention File | `src/types/cache.ts` | `attention_score=100` | L2: * Cache Type Definitions |
| RISK-0786 | medium | Persistence Or State | `src/types/index.ts` | `cache` | L58: // Cache types |
| RISK-0787 | low | High Attention File | `src/types/index.ts` | `attention_score=84` | L58: // Cache types |
| RISK-0788 | high | Security Boundary | `src/types/llm.ts` | `token` | L37: maxOutputTokens?: number; |
| RISK-0789 | medium | Concurrency Or Timing | `src/types/llm.ts` | `timeout` | L39: timeout?: number; |
| RISK-0790 | medium | Parser Or Heuristic | `src/types/llm.ts` | `parse` | L42: parseResponse: (raw: string) => T; |
| RISK-0791 | medium | Persistence Or State | `src/types/llm.ts` | `cache` | L52: fromCache: boolean; |
| RISK-0792 | low | High Attention File | `src/types/llm.ts` | `attention_score=84` | L37: maxOutputTokens?: number; |
| RISK-0793 | medium | Concurrency Or Timing | `src/types/pipeline.ts` | `timeout` | L47: timeout?: number; |
| RISK-0794 | high | Security Boundary | `src/types/workspace.ts` | `token` | L151: token: string; |
| RISK-0795 | low | High Attention File | `src/utils/__tests__/memory-usage.test.ts` | `attention_score=100` | L1: import { getMemoryUsage, getHeapUsed } from '../memory-usage'; |
| RISK-0796 | medium | Concurrency Or Timing | `src/utils/iteration-logger.ts` | `async` | L73: private async ensureLogFile(): Promise<void> { |
| RISK-0797 | medium | Parser Or Heuristic | `src/utils/iteration-logger.ts` | `parse` | L58: // Parse existing entries to maintain history |
| RISK-0798 | low | High Attention File | `src/utils/iteration-logger.ts` | `attention_score=100` | L27: memoryUsage?: number; |
| RISK-0799 | low | High Attention File | `src/utils/memory-usage.ts` | `attention_score=100` | L2: * Cross-platform memory usage utility (ISS-006) |
| RISK-0800 | medium | Parser Or Heuristic | `src/utils/sanitize.ts` | `fallback` | L27: * - Empty result fallback → `unnamed` |
| RISK-0801 | medium | Concurrency Or Timing | `src/visualization/__tests__/advanced-visual-engine.test.ts` | `async` | L571: it('creates fallback scene on enhancement failure', async () => { |
| RISK-0802 | medium | Parser Or Heuristic | `src/visualization/__tests__/advanced-visual-engine.test.ts` | `fallback` | L571: it('creates fallback scene on enhancement failure', async () => { |
| RISK-0803 | low | High Attention File | `src/visualization/advanced-layouts.ts` | `attention_score=100` | L68: edgeDrawing: { duration: number; easing: string }; |
| RISK-0804 | medium | Concurrency Or Timing | `src/visualization/advanced-visual-engine.ts` | `async` | L181: private async enhanceLayout(scene: SceneGraph, style: VisualStyle): Promise<Record<string, unknown>> { |
| RISK-0805 | low | High Attention File | `src/visualization/advanced-visual-engine.ts` | `attention_score=100` | L69: private iteration: number = 1; |
| RISK-0806 | high | Destructive Mutation | `src/visualization/complex-layout-engine.ts` | `force` | L89: export interface ForceDirectedState { |
| RISK-0807 | medium | Persistence Or State | `src/visualization/complex-layout-engine.ts` | `state` | L89: export interface ForceDirectedState { |
| RISK-0808 | low | High Attention File | `src/visualization/complex-layout-engine.ts` | `attention_score=100` | L68: memoryLimit: number; |
| RISK-0809 | high | Destructive Mutation | `src/visualization/edge-crossing-minimizer.ts` | `force` | L326: const force = (repulsionStrength * weight) / (dist * dist); |
| RISK-0810 | medium | Parser Or Heuristic | `src/visualization/edge-crossing-minimizer.ts` | `heuristic` | L5: * heuristic-based minimization to reduce crossing count. |
| RISK-0811 | low | High Attention File | `src/visualization/edge-crossing-minimizer.ts` | `attention_score=84` | L5: * heuristic-based minimization to reduce crossing count. |
| RISK-0812 | medium | Concurrency Or Timing | `src/visualization/enhanced-zero-overlap-layout.ts` | `async` | L204: private async generateInitialLayout( |
| RISK-0813 | low | High Attention File | `src/visualization/enhanced-zero-overlap-layout.ts` | `attention_score=100` | L99: private config: ZeroOverlapConfig; |
| RISK-0814 | medium | Concurrency Or Timing | `src/visualization/layout-auto-optimizer.ts` | `retry` | L6: * Maximum 3 retries. Each retry re-evaluates the score. |
| RISK-0815 | medium | Parser Or Heuristic | `src/visualization/layout-auto-optimizer.ts` | `fallback` | L169: * @param strategySelector Provides fallback chain for strategy reselection |
| RISK-0816 | low | High Attention File | `src/visualization/layout-auto-optimizer.ts` | `attention_score=100` | L6: * Maximum 3 retries. Each retry re-evaluates the score. |
| RISK-0817 | medium | Parser Or Heuristic | `src/visualization/layout-engine.ts` | `fallback` | L11: import { FallbackLayoutStrategy } from './strategies/FallbackLayoutStrategy'; |
| RISK-0818 | low | High Attention File | `src/visualization/layout-engine.ts` | `attention_score=100` | L11: import { FallbackLayoutStrategy } from './strategies/FallbackLayoutStrategy'; |
| RISK-0819 | low | High Attention File | `src/visualization/layout-quality-composite.ts` | `attention_score=84` | L84: const crossingRaw = input.crossingCount ?? 0; |
| RISK-0820 | high | Destructive Mutation | `src/visualization/layout/OverlapResolver.ts` | `force` | L3: import ProgressiveForceStrategy from './strategies/ProgressiveForceStrategy'; |
| RISK-0821 | medium | Concurrency Or Timing | `src/visualization/layout/OverlapResolver.ts` | `await` | L69: const strategyResult = await this.applyStrategyWithTimeout( |
| RISK-0822 | low | High Attention File | `src/visualization/layout/OverlapResolver.ts` | `attention_score=100` | L10: private strategies: LayoutStrategy[] = []; |
| RISK-0823 | low | High Attention File | `src/visualization/layout/strategies/GridSnapStrategy.ts` | `attention_score=100` | L17: private cellSize: number = 100; // Initial cell size, will be adjusted |
| RISK-0824 | high | Destructive Mutation | `src/visualization/layout/strategies/ProgressiveForceStrategy.ts` | `force` | path contains `force` |
| RISK-0825 | low | High Attention File | `src/visualization/layout/strategies/ProgressiveForceStrategy.ts` | `attention_score=100` | L17: private alpha = 1.0; // Current simulation temperature |
| RISK-0826 | low | High Attention File | `src/visualization/layout/strategies/SimulatedAnnealingStrategy.ts` | `attention_score=100` | L16: private initialTemperature = 10; |
| RISK-0827 | medium | Parser Or Heuristic | `src/visualization/overlap-resolver.ts` | `fallback` | L80: // Final check - if still has overlaps, apply grid-snap fallback |
| RISK-0828 | low | High Attention File | `src/visualization/overlap-resolver.ts` | `attention_score=84` | L10: private maxIterations: number; |
| RISK-0829 | low | High Attention File | `src/visualization/spatial-hash.ts` | `attention_score=70` | L11: private grid = new Map<string, Set<PositionedNode>>(); |
| RISK-0830 | medium | Concurrency Or Timing | `src/visualization/strategies/CulturalLayoutAdapter.ts` | `async` | L46: private async applyRTLLayout(layout: DiagramLayout): Promise<DiagramLayout> { |
| RISK-0831 | low | High Attention File | `src/visualization/strategies/CulturalLayoutAdapter.ts` | `attention_score=100` | L5: private config: ComplexLayoutConfig; |
| RISK-0832 | medium | Parser Or Heuristic | `src/visualization/strategies/DagreLayoutStrategy.ts` | `fallback` | L5: import { FallbackLayoutStrategy } from './FallbackLayoutStrategy'; |
| RISK-0833 | low | High Attention File | `src/visualization/strategies/DagreLayoutStrategy.ts` | `attention_score=98` | L5: import { FallbackLayoutStrategy } from './FallbackLayoutStrategy'; |
| RISK-0834 | medium | Parser Or Heuristic | `src/visualization/strategies/FallbackLayoutStrategy.ts` | `fallback` | path contains `fallback` |
| RISK-0835 | low | High Attention File | `src/visualization/strategies/FallbackLayoutStrategy.ts` | `attention_score=100` | L4: export class FallbackLayoutStrategy { |
| RISK-0836 | low | High Attention File | `src/visualization/strategies/LayoutEvaluator.ts` | `attention_score=70` | L6: private config: LayoutConfig; |
| RISK-0837 | medium | Concurrency Or Timing | `src/visualization/strategies/LayoutOptimizer.ts` | `async` | L139: private async adjustSpacingByImportance(layout: DiagramLayout): Promise<DiagramLayout> { |
| RISK-0838 | low | High Attention File | `src/visualization/strategies/LayoutOptimizer.ts` | `attention_score=100` | L5: private config: LayoutConfig; |
| RISK-0839 | high | Destructive Mutation | `src/visualization/strategies/NetworkLayoutStrategy.ts` | `force` | L113: private async applyForceDirectedAlgorithm( |
| RISK-0840 | medium | Concurrency Or Timing | `src/visualization/strategies/NetworkLayoutStrategy.ts` | `async` | L113: private async applyForceDirectedAlgorithm( |
| RISK-0841 | low | High Attention File | `src/visualization/strategies/NetworkLayoutStrategy.ts` | `attention_score=98` | L64: private calculateOptimalSpacing(nodeCount: number, config: LayoutConfig): number { |
| RISK-0842 | high | Destructive Mutation | `src/visualization/strategies/OverlapResolver.ts` | `force` | L256: private async forceSeparateOverlappingNodes(nodes: PositionedNode[]): Promise<void> { |
| RISK-0843 | medium | Concurrency Or Timing | `src/visualization/strategies/OverlapResolver.ts` | `async` | L170: private async resolveSpecificOverlap(node1: PositionedNode, node2: PositionedNode, diagramType: DiagramType): Promise<void> { |
| RISK-0844 | low | High Attention File | `src/visualization/strategies/OverlapResolver.ts` | `attention_score=100` | L17: private config: LayoutConfig; |
| RISK-0845 | medium | Network Or IPC | `src/visualization/strategies/TimelineLayoutStrategy.ts` | `proxy` | L36: // Sort nodes by temporal order (using array order as proxy for time) |
| RISK-0846 | medium | Parser Or Heuristic | `src/visualization/strategies/TreeLayoutStrategy.ts` | `fallback` | L195: // Fallback |
| RISK-0847 | low | High Attention File | `src/visualization/strategies/TreeLayoutStrategy.ts` | `attention_score=98` | L75: private findRootNode(nodes: NodeDatum[], edges: EdgeDatum[]): string { |
| RISK-0848 | high | Destructive Mutation | `src/visualization/strategies/__tests__/flow-strategy.test.ts` | `force` | L274: // ---- gridSnapFallback (via forced overlap) ---- |
| RISK-0849 | medium | Parser Or Heuristic | `src/visualization/strategies/__tests__/flow-strategy.test.ts` | `fallback` | L188: it('should handle many nodes (potential gridSnapFallback path)', () => { |
| RISK-0850 | low | High Attention File | `src/visualization/strategies/__tests__/flow-strategy.test.ts` | `attention_score=100` | L188: it('should handle many nodes (potential gridSnapFallback path)', () => { |
| RISK-0851 | high | Destructive Mutation | `src/visualization/strategies/__tests__/tree-strategy.test.ts` | `force` | L327: // ---- gridSnapFallback (via forced overlap) ---- |
| RISK-0852 | medium | Parser Or Heuristic | `src/visualization/strategies/__tests__/tree-strategy.test.ts` | `fallback` | L226: it('should handle many nodes (potential gridSnapFallback path)', () => { |
| RISK-0853 | low | High Attention File | `src/visualization/strategies/__tests__/tree-strategy.test.ts` | `attention_score=100` | L226: it('should handle many nodes (potential gridSnapFallback path)', () => { |
| RISK-0854 | high | Destructive Mutation | `src/visualization/strategies/cycle-strategy.ts` | `force` | L5: * Uses Force-Directed fallback if overlaps are detected after initial placement. |
| RISK-0855 | medium | Parser Or Heuristic | `src/visualization/strategies/cycle-strategy.ts` | `fallback` | L5: * Uses Force-Directed fallback if overlaps are detected after initial placement. |
| RISK-0856 | low | High Attention File | `src/visualization/strategies/cycle-strategy.ts` | `attention_score=100` | L5: * Uses Force-Directed fallback if overlaps are detected after initial placement. |
| RISK-0857 | medium | Parser Or Heuristic | `src/visualization/strategies/flow-strategy.ts` | `fallback` | L80: return this.gridSnapFallback(nodes, edges, positionedNodes); |
| RISK-0858 | medium | Parser Or Heuristic | `src/visualization/strategies/matrix-strategy.ts` | `fallback` | L5: * Grid placement guarantees zero overlaps -- no fallback needed. |
| RISK-0859 | high | Destructive Mutation | `src/visualization/strategies/timeline-strategy.ts` | `force` | L5: * with X-axis optimized via force-directed method and grid-snap fallback. |
| RISK-0860 | medium | Parser Or Heuristic | `src/visualization/strategies/timeline-strategy.ts` | `fallback` | L5: * with X-axis optimized via force-directed method and grid-snap fallback. |
| RISK-0861 | low | High Attention File | `src/visualization/strategies/timeline-strategy.ts` | `attention_score=70` | L5: * with X-axis optimized via force-directed method and grid-snap fallback. |
| RISK-0862 | medium | Parser Or Heuristic | `src/visualization/strategies/tree-strategy.ts` | `fallback` | L80: return this.gridSnapFallback(nodes, edges, positionedNodes); |
| RISK-0863 | medium | Concurrency Or Timing | `src/visualization/strategy-selector.ts` | `async` | L95: export async function executeLayout( |
| RISK-0864 | medium | Parser Or Heuristic | `src/visualization/strategy-selector.ts` | `fallback` | L15: private fallbackStrategy: LayoutStrategy; |
| RISK-0865 | low | High Attention File | `src/visualization/strategy-selector.ts` | `attention_score=100` | L14: private registry: StrategyRegistry; |
| RISK-0866 | medium | Parser Or Heuristic | `src/visualization/visual-balance-scorer.ts` | `parse` | L183: // Dynamic grid size: scales with node count to avoid penalizing sparse layouts |
| RISK-0867 | low | High Attention File | `src/visualization/visual-balance-scorer.ts` | `attention_score=84` | L93: private computeCentroid(centers: { x: number; y: number }[]): { x: number; y: number } { |
| RISK-0868 | medium | Concurrency Or Timing | `src/workers/__tests__/export-delegation-helpers.test.ts` | `await` | L96: const result = await testInternals(engine).processExportViaWorker(createJob(), 30, 10); |
| RISK-0869 | low | High Attention File | `src/workers/__tests__/export-delegation-helpers.test.ts` | `attention_score=100` | L5: * private methods at unit level, including the disposed-flag guard. |
| RISK-0870 | medium | Concurrency Or Timing | `src/workers/__tests__/export-engine-integration.test.ts` | `async` | L85: it('exports successfully when workers unavailable (fallback)', async () => { |
| RISK-0871 | medium | Parser Or Heuristic | `src/workers/__tests__/export-engine-integration.test.ts` | `fallback` | L85: it('exports successfully when workers unavailable (fallback)', async () => { |
| RISK-0872 | medium | Persistence Or State | `src/workers/__tests__/export-engine-integration.test.ts` | `state` | L94: it('isWorkerEnabled reflects pool state', () => { |
| RISK-0873 | medium | Parser Or Heuristic | `src/workers/__tests__/fallback.test.ts` | `fallback` | path contains `fallback` |
| RISK-0874 | medium | Parser Or Heuristic | `src/workers/__tests__/layout-delegation-helpers.test.ts` | `fallback` | L10: import type { FallbackLayoutStrategy } from '../../visualization/strategies/FallbackLayoutStrategy'; |
| RISK-0875 | low | High Attention File | `src/workers/__tests__/layout-delegation-helpers.test.ts` | `attention_score=100` | L4: * Tests computeLayoutViaWorker private method at unit level, |
| RISK-0876 | medium | Parser Or Heuristic | `src/workers/__tests__/layout-engine-integration.test.ts` | `fallback` | L12: import type { FallbackLayoutStrategy } from '../../visualization/strategies/FallbackLayoutStrategy'; |
| RISK-0877 | low | High Attention File | `src/workers/__tests__/worker-pool.test.ts` | `attention_score=100` | L18: dispatchMessage: (data: WorkerResponse) => void; |
| RISK-0878 | medium | Parser Or Heuristic | `src/workers/index.ts` | `fallback` | L38: // Re-export worker processing functions for testing and fallback |
| RISK-0879 | low | High Attention File | `src/workers/worker-pool.ts` | `attention_score=100` | L31: private workers: PooledWorker[] = []; |
| RISK-0880 | medium | Parser Or Heuristic | `supabase/config.toml` | `toml` | path contains `toml` |
| RISK-0881 | high | Security Boundary | `supabase/functions/_shared/auth.ts` | `auth` | path contains `auth` |
| RISK-0882 | medium | Concurrency Or Timing | `supabase/functions/_shared/auth.ts` | `async` | L52: export async function validateToken( |
| RISK-0883 | low | High Attention File | `supabase/functions/_shared/auth.ts` | `attention_score=100` | L2: * Shared Auth Module for Supabase Edge Functions |
| RISK-0884 | high | Security Boundary | `supabase/functions/_shared/error-handler.ts` | `auth` | L12: 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', |
| RISK-0885 | medium | Concurrency Or Timing | `supabase/functions/_shared/error-handler.ts` | `async` | L175: export async function fetchWithTimeout( |
| RISK-0886 | low | High Attention File | `supabase/functions/_shared/error-handler.ts` | `attention_score=100` | L5: * timeout handling with AbortController, and error classification. |
| RISK-0887 | high | Security Boundary | `supabase/functions/generate-scenes/index.ts` | `auth` | L2: import { authenticateRequest, SupabaseAuthClient } from '../_shared/auth.ts'; |
| RISK-0888 | medium | Network Or IPC | `supabase/functions/generate-scenes/index.ts` | `http` | L1: import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'; |
| RISK-0889 | medium | Concurrency Or Timing | `supabase/functions/generate-scenes/index.ts` | `async` | L260: export async function handleGenerateScenes( |
| RISK-0890 | medium | Parser Or Heuristic | `supabase/functions/generate-scenes/index.ts` | `parse` | L344: // Parse body |
| RISK-0891 | low | High Attention File | `supabase/functions/generate-scenes/index.ts` | `attention_score=84` | L2: import { authenticateRequest, SupabaseAuthClient } from '../_shared/auth.ts'; |
| RISK-0892 | high | Security Boundary | `supabase/functions/render-video/index.ts` | `auth` | L2: import { authenticateRequest, SupabaseAuthClient } from '../_shared/auth.ts'; |
| RISK-0893 | medium | Network Or IPC | `supabase/functions/render-video/index.ts` | `http` | L1: import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'; |
| RISK-0894 | medium | Concurrency Or Timing | `supabase/functions/render-video/index.ts` | `async` | L71: export async function handleRenderVideo( |
| RISK-0895 | medium | Parser Or Heuristic | `supabase/functions/render-video/index.ts` | `parse` | L138: // Parse body |
| RISK-0896 | low | High Attention File | `supabase/functions/render-video/index.ts` | `attention_score=84` | L2: import { authenticateRequest, SupabaseAuthClient } from '../_shared/auth.ts'; |
| RISK-0897 | high | Security Boundary | `supabase/functions/transcribe-audio/index.ts` | `auth` | L2: import { authenticateRequest, SupabaseAuthClient } from '../_shared/auth.ts'; |
| RISK-0898 | medium | Network Or IPC | `supabase/functions/transcribe-audio/index.ts` | `http` | L1: import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'; |
| RISK-0899 | medium | Concurrency Or Timing | `supabase/functions/transcribe-audio/index.ts` | `async` | L42: export async function handleTranscribe( |
| RISK-0900 | low | High Attention File | `supabase/functions/transcribe-audio/index.ts` | `attention_score=100` | L2: import { authenticateRequest, SupabaseAuthClient } from '../_shared/auth.ts'; |
| RISK-0901 | high | Security Boundary | `supabase/migrations/00001_create_diagram_projects.sql` | `auth` | L17: user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, |
| RISK-0902 | high | Destructive Mutation | `supabase/migrations/00001_create_diagram_projects.sql` | `delete` | L17: user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, |
| RISK-0903 | medium | Persistence Or State | `supabase/migrations/00001_create_diagram_projects.sql` | `migration` | path contains `migration` |
| RISK-0904 | low | High Attention File | `supabase/migrations/00001_create_diagram_projects.sql` | `attention_score=70` | L17: user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, |
| RISK-0905 | high | Security Boundary | `supabase/migrations/00002_create_audio_bucket.sql` | `auth` | L16: CREATE POLICY "audio_bucket_authenticated_insert" ON storage.objects |
| RISK-0906 | high | Destructive Mutation | `supabase/migrations/00002_create_audio_bucket.sql` | `delete` | L24: CREATE POLICY "audio_bucket_authenticated_delete" ON storage.objects |
| RISK-0907 | medium | Persistence Or State | `supabase/migrations/00002_create_audio_bucket.sql` | `migration` | path contains `migration` |
| RISK-0908 | low | High Attention File | `supabase/migrations/00002_create_audio_bucket.sql` | `attention_score=84` | L16: CREATE POLICY "audio_bucket_authenticated_insert" ON storage.objects |
| RISK-0909 | high | Security Boundary | `supabase/migrations/20250930171109_612ba1fa-31c3-424e-af25-861822582ce3.sql` | `auth` | L11: CREATE POLICY "Authenticated users can upload audio" |
| RISK-0910 | high | Destructive Mutation | `supabase/migrations/20250930171109_612ba1fa-31c3-424e-af25-861822582ce3.sql` | `delete` | L15: CREATE POLICY "Authenticated users can delete their audio" |
| RISK-0911 | medium | Persistence Or State | `supabase/migrations/20250930171109_612ba1fa-31c3-424e-af25-861822582ce3.sql` | `migration` | path contains `migration` |
| RISK-0912 | low | High Attention File | `supabase/migrations/20250930171109_612ba1fa-31c3-424e-af25-861822582ce3.sql` | `attention_score=100` | L11: CREATE POLICY "Authenticated users can upload audio" |
| RISK-0913 | medium | Persistence Or State | `supabase/migrations/verify_rls_policies.sql` | `migration` | path contains `migration` |
| RISK-0914 | medium | Persistence Or State | `supabase/migrations/verify_storage_policies.sql` | `migration` | path contains `migration` |
| RISK-0915 | medium | Parser Or Heuristic | `test-scene-data.json` | `json` | path contains `json` |
| RISK-0916 | high | Security Boundary | `tests/__mocks__/deno-server.ts` | `auth` | L12: auth: { |
| RISK-0917 | medium | Concurrency Or Timing | `tests/__mocks__/deno-server.ts` | `async` | L13: getUser: async (_token: string) => ({ |
| RISK-0918 | high | Security Boundary | `tests/__mocks__/socket-io.ts` | `auth` | L7: handshake: { auth: { token?: string } }; |
| RISK-0919 | medium | Network Or IPC | `tests/__mocks__/socket-io.ts` | `socket` | path contains `socket` |
| RISK-0920 | low | High Attention File | `tests/__mocks__/socket-io.ts` | `attention_score=84` | L2: * Mock for Socket.IO server used in WebSocket handler tests. |
| RISK-0921 | high | Security Boundary | `tests/acceptance/acceptance-test-suite.test.ts` | `auth` | L32: import { authMiddleware, AuthenticatedRequest } from '@/api/middleware/auth'; |
| RISK-0922 | medium | Network Or IPC | `tests/acceptance/acceptance-test-suite.test.ts` | `socket` | L34: import { emitJobProgress, emitStreamingSegment, createWsAuthMiddleware } from '@/api/websocket-handler'; |
| RISK-0923 | medium | Concurrency Or Timing | `tests/acceptance/acceptance-test-suite.test.ts` | `retry` | L19: import { isRetryable } from '@/analysis/retry-strategy'; |
| RISK-0924 | medium | Parser Or Heuristic | `tests/acceptance/acceptance-test-suite.test.ts` | `json` | L11: import * as jwt from 'jsonwebtoken'; |
| RISK-0925 | medium | Persistence Or State | `tests/acceptance/acceptance-test-suite.test.ts` | `cache` | L36: import { ComputationCache } from '@/optimization/computation-cache'; |
| RISK-0926 | low | High Attention File | `tests/acceptance/acceptance-test-suite.test.ts` | `attention_score=100` | L11: import * as jwt from 'jsonwebtoken'; |
| RISK-0927 | high | Security Boundary | `tests/analysis/budget-alert-boundary.test.ts` | `token` | L5: * that are not covered by the integration tests in token-usage-cost-monitoring.test.ts. |
| RISK-0928 | low | High Attention File | `tests/analysis/budget-alert-boundary.test.ts` | `attention_score=100` | L5: * that are not covered by the integration tests in token-usage-cost-monitoring.test.ts. |
| RISK-0929 | high | Security Boundary | `tests/analysis/budget-alert.test.ts` | `session` | L11: expect(system.getSessionCost()).toBe(0); |
| RISK-0930 | low | High Attention File | `tests/analysis/budget-alert.test.ts` | `attention_score=100` | L11: expect(system.getSessionCost()).toBe(0); |
| RISK-0931 | high | Security Boundary | `tests/analysis/cost-estimator-edge-cases.test.ts` | `token` | L4: * Covers paths not exercised by token-usage-cost-monitoring.test.ts: |
| RISK-0932 | low | High Attention File | `tests/analysis/cost-estimator-edge-cases.test.ts` | `attention_score=100` | L4: * Covers paths not exercised by token-usage-cost-monitoring.test.ts: |
| RISK-0933 | medium | Parser Or Heuristic | `tests/analysis/llm-cache-debounce.test.ts` | `json` | L45: cachePath = path.join(tmpDir, 'cache.json'); |
| RISK-0934 | medium | Persistence Or State | `tests/analysis/llm-cache-debounce.test.ts` | `cache` | path contains `cache` |
| RISK-0935 | low | High Attention File | `tests/analysis/llm-cache-debounce.test.ts` | `attention_score=100` | L2: * Dedicated tests for LLMCache debounce-interval behavior. |
| RISK-0936 | medium | Persistence Or State | `tests/analysis/llm-cache-stats-paths.test.ts` | `cache` | path contains `cache` |
| RISK-0937 | low | High Attention File | `tests/analysis/llm-cache-stats-paths.test.ts` | `attention_score=100` | L2: * Tests for untested LLMCache paths: |
| RISK-0938 | medium | Persistence Or State | `tests/analysis/llm-cache-ttl-eviction.test.ts` | `cache` | path contains `cache` |
| RISK-0939 | low | High Attention File | `tests/analysis/llm-cache-ttl-eviction.test.ts` | `attention_score=100` | L2: * Targeted tests for LLMCache TTL expiry boundaries, max-size eviction |
| RISK-0940 | medium | Persistence Or State | `tests/analysis/llm-cache.test.ts` | `cache` | path contains `cache` |
| RISK-0941 | low | High Attention File | `tests/analysis/llm-cache.test.ts` | `attention_score=100` | L2: * Tests for LLMCache module |
| RISK-0942 | high | Security Boundary | `tests/analysis/llm-monitoring-integration.test.ts` | `token` | L4: * Verifies that token-usage-tracker, cost-estimator, and budget-alert |
| RISK-0943 | medium | Concurrency Or Timing | `tests/analysis/llm-monitoring-integration.test.ts` | `async` | L83: const mockStream = (async function* () { |
| RISK-0944 | medium | Parser Or Heuristic | `tests/analysis/llm-monitoring-integration.test.ts` | `fallback` | L14: * 7. Fallback responses are recorded with 'fallback' stage |
| RISK-0945 | medium | Persistence Or State | `tests/analysis/llm-monitoring-integration.test.ts` | `cache` | L13: * 6. Cache hits do NOT record token usage |
| RISK-0946 | low | High Attention File | `tests/analysis/llm-monitoring-integration.test.ts` | `attention_score=100` | L4: * Verifies that token-usage-tracker, cost-estimator, and budget-alert |
| RISK-0947 | medium | Parser Or Heuristic | `tests/analysis/llm-utils.test.ts` | `parse` | L2: * Tests for parseJsonFromLLMText (llm-utils.ts) |
| RISK-0948 | low | High Attention File | `tests/analysis/llm-utils.test.ts` | `attention_score=100` | L2: * Tests for parseJsonFromLLMText (llm-utils.ts) |
| RISK-0949 | high | Security Boundary | `tests/analysis/token-usage-cost-monitoring.test.ts` | `token` | path contains `token` |
| RISK-0950 | low | High Attention File | `tests/analysis/token-usage-cost-monitoring.test.ts` | `attention_score=100` | L2: * TASK-0144: LLM Cost & Token Usage Monitoring Tests (REQ-098) |
| RISK-0951 | high | Security Boundary | `tests/analysis/token-usage-tracker-edge-cases.test.ts` | `token` | path contains `token` |
| RISK-0952 | low | High Attention File | `tests/analysis/token-usage-tracker-edge-cases.test.ts` | `attention_score=100` | L2: * Edge-case tests for token-usage-tracker.ts |
| RISK-0953 | low | High Attention File | `tests/benchmark/performance-benchmark.test.ts` | `attention_score=100` | L4: * Simulates a full pipeline run, measures per-stage timing and memory, |
| RISK-0954 | medium | Parser Or Heuristic | `tests/e2e/pipeline-flow.test.ts` | `fallback` | L113: fallbackStrategies: [{ stage: 2, strategy: 'rule-based' }], |
| RISK-0955 | medium | Network Or IPC | `tests/integration/api.test.ts` | `socket` | L5: * Express routes, error handling, WebSocket event types, and |
| RISK-0956 | medium | Concurrency Or Timing | `tests/integration/api.test.ts` | `await` | L133: await new Promise((r) => setTimeout(r, 10)); |
| RISK-0957 | low | High Attention File | `tests/integration/api.test.ts` | `attention_score=100` | L5: * Express routes, error handling, WebSocket event types, and |
| RISK-0958 | high | Security Boundary | `tests/integration/batch.test.ts` | `token` | L212: // Verify cancel token is set |
| RISK-0959 | low | High Attention File | `tests/integration/batch.test.ts` | `attention_score=98` | L212: // Verify cancel token is set |
| RISK-0960 | medium | Concurrency Or Timing | `tests/integration/label-sizing-pipeline.test.ts` | `async` | L100: it('should reflect label overflow in quality metrics alongside layout quality', async () => { |
| RISK-0961 | medium | Parser Or Heuristic | `tests/integration/label-sizing-pipeline.test.ts` | `fallback` | L54: fallbackStrategies: [], |
| RISK-0962 | medium | Concurrency Or Timing | `tests/integration/layout-quality-pipeline.test.ts` | `retry` | L33: { id: 'retry', label: 'リトライ', x: 200, y: 250, width: 120, height: 50 }, |
| RISK-0963 | medium | Persistence Or State | `tests/integration/monitoring-health-degraded.test.ts` | `cache` | L13: * Previous phases (45-48) tested warmup state transitions and cache backend |
| RISK-0964 | low | High Attention File | `tests/integration/monitoring-health-degraded.test.ts` | `attention_score=100` | L13: * Previous phases (45-48) tested warmup state transitions and cache backend |
| RISK-0965 | medium | Parser Or Heuristic | `tests/integration/phase32-quality-pipeline.test.ts` | `fallback` | L96: fallbackStrategies: [], |
| RISK-0966 | medium | Concurrency Or Timing | `tests/integration/pipeline.test.ts` | `async` | L328: it('uses fallback when quality gate fails and fallback succeeds', async () => { |
| RISK-0967 | medium | Parser Or Heuristic | `tests/integration/pipeline.test.ts` | `fallback` | L12: FallbackStrategy, |
| RISK-0968 | medium | Persistence Or State | `tests/integration/pipeline.test.ts` | `cache` | L157: // Mock the performance/intelligent-cache used by EnhancedErrorRecovery |
| RISK-0969 | low | High Attention File | `tests/integration/pipeline.test.ts` | `attention_score=100` | L12: FallbackStrategy, |
| RISK-0970 | medium | Concurrency Or Timing | `tests/integration/warmup-cache-backend-failure.test.ts` | `async` | L65: warmupCache: jest.fn().mockImplementation(async () => { |
| RISK-0971 | medium | Persistence Or State | `tests/integration/warmup-cache-backend-failure.test.ts` | `cache` | path contains `cache` |
| RISK-0972 | low | High Attention File | `tests/integration/warmup-cache-backend-failure.test.ts` | `attention_score=100` | L2: * Phase 46: Warmup Cache Backend Unreachable Integration Tests |
| RISK-0973 | medium | Concurrency Or Timing | `tests/integration/warmup-default-pattern-resilience.test.ts` | `async` | L75: warmupCache: jest.fn().mockImplementation(async () => { |
| RISK-0974 | medium | Persistence Or State | `tests/integration/warmup-default-pattern-resilience.test.ts` | `cache` | L9: * through the full pipeline: CacheWarmupManager → startup-warmup → health endpoint. |
| RISK-0975 | low | High Attention File | `tests/integration/warmup-default-pattern-resilience.test.ts` | `attention_score=100` | L9: * through the full pipeline: CacheWarmupManager → startup-warmup → health endpoint. |
| RISK-0976 | medium | Concurrency Or Timing | `tests/integration/warmup-failure-resilience.test.ts` | `await` | L92: await new Promise((r) => setTimeout(r, 50)); |
| RISK-0977 | medium | Persistence Or State | `tests/integration/warmup-failure-resilience.test.ts` | `cache` | L5: * REQ-114: Cache backend unreachable integration tests (3 tests) |
| RISK-0978 | low | High Attention File | `tests/integration/warmup-failure-resilience.test.ts` | `attention_score=100` | L5: * REQ-114: Cache backend unreachable integration tests (3 tests) |
| RISK-0979 | medium | Concurrency Or Timing | `tests/integration/warmup-zero-success-resilience.test.ts` | `async` | L62: warmupCache: jest.fn().mockImplementation(async () => { |
| RISK-0980 | medium | Persistence Or State | `tests/integration/warmup-zero-success-resilience.test.ts` | `cache` | L8: * Validates that when warmupCache resolves true but all individual patterns |
| RISK-0981 | low | High Attention File | `tests/integration/warmup-zero-success-resilience.test.ts` | `attention_score=100` | L6: * REQ-121: Warmup retry after zero-success completion |
| RISK-0982 | medium | Concurrency Or Timing | `tests/integration/worker-fallback.test.ts` | `thread` | L35: // Main-thread processing (simulating fallback) |
| RISK-0983 | medium | Parser Or Heuristic | `tests/integration/worker-fallback.test.ts` | `fallback` | path contains `fallback` |
| RISK-0984 | low | High Attention File | `tests/integration/worker-fallback.test.ts` | `attention_score=98` | L2: * Worker Fallback Integration Tests |
| RISK-0985 | medium | Concurrency Or Timing | `tests/integration/worker-pool.test.ts` | `async` | L97: it('should queue excess tasks and dispatch when workers become idle', async () => { |
| RISK-0986 | low | High Attention File | `tests/integration/worker-pool.test.ts` | `attention_score=100` | L45: const dispatchToLastWorker = (data: WorkerResponse) => { |
| RISK-0987 | medium | Parser Or Heuristic | `tests/llm-parsing.ts` | `parse` | L3: * Simple parser test for LLM JSON responses |
| RISK-0988 | low | High Attention File | `tests/llm-parsing.ts` | `attention_score=100` | L3: * Simple parser test for LLM JSON responses |
| RISK-0989 | high | Security Boundary | `tests/mocks/jsonwebtoken.ts` | `auth` | L4: * NOTE: Auth-related tests (auth.test.ts, auth-integration.test.ts, |
| RISK-0990 | medium | Network Or IPC | `tests/mocks/jsonwebtoken.ts` | `socket` | L5: * pipeline-auth.test.ts, websocket-handler.test.ts) use REAL jsonwebtoken |
| RISK-0991 | medium | Parser Or Heuristic | `tests/mocks/jsonwebtoken.ts` | `json` | path contains `json` |
| RISK-0992 | medium | Concurrency Or Timing | `tests/performance/benchmark.test.ts` | `async` | L129: const expensiveCompute = async () => { |
| RISK-0993 | medium | Persistence Or State | `tests/performance/benchmark.test.ts` | `cache` | L14: import { ComputationCache } from '@/optimization/computation-cache'; |
| RISK-0994 | low | High Attention File | `tests/performance/benchmark.test.ts` | `attention_score=100` | L8: * - Memory usage ≤ 512MB |
| RISK-0995 | low | High Attention File | `tests/performance/e2e-benchmark.test.ts` | `attention_score=100` | L10: * Memory: Heap usage <= 512MB (measured: 82.21MB historical) |
| RISK-0996 | medium | Parser Or Heuristic | `tests/pipeline/parallel-benchmark.test.ts` | `fallback` | L5: * with edge cases, baseline matching, and fallback behaviour. |
| RISK-0997 | low | High Attention File | `tests/pipeline/parallel-benchmark.test.ts` | `attention_score=98` | L5: * with edge cases, baseline matching, and fallback behaviour. |
| RISK-0998 | medium | Concurrency Or Timing | `tests/pipeline/parallel-execution.test.ts` | `async` | L38: const layoutFn = async (diag: typeof diagrams[0]) => ({ |
| RISK-0999 | medium | Parser Or Heuristic | `tests/pipeline/parallel-execution.test.ts` | `parse` | L227: const parsed = JSON.parse(json); |
| RISK-1000 | low | High Attention File | `tests/pipeline/parallel-execution.test.ts` | `attention_score=98` | L86: await new Promise(resolve => setTimeout(resolve, 10)); |
| RISK-1001 | high | Security Boundary | `tests/pipeline/performance-regression-detector.test.ts` | `token` | L162: test('$0.03/video, 2000 tokens/analysis → correct efficiency', () => { |
| RISK-1002 | low | High Attention File | `tests/pipeline/performance-regression-detector.test.ts` | `attention_score=100` | L47: memoryMB: 40, |
| RISK-1003 | high | Security Boundary | `tests/pipeline/pipeline-health-score.test.ts` | `token` | L157: tokensPerAnalysis: 2000, |
| RISK-1004 | low | High Attention File | `tests/pipeline/pipeline-health-score.test.ts` | `attention_score=100` | L157: tokensPerAnalysis: 2000, |
| RISK-1005 | medium | Concurrency Or Timing | `tests/pipeline/retry-edge-cases.test.ts` | `async` | L33: it('maxRetries=0 throws immediately on failure with no retry', async () => { |
| RISK-1006 | low | High Attention File | `tests/pipeline/retry-edge-cases.test.ts` | `attention_score=100` | L2: * Edge-case tests for retryWithBackoff and ErrorClassifier. |
| RISK-1007 | medium | Concurrency Or Timing | `tests/pipeline/retry-integration.test.ts` | `async` | L46: it('recovers from rate limit then timeout in sequence', async () => { |
| RISK-1008 | medium | Parser Or Heuristic | `tests/pipeline/retry-integration.test.ts` | `fallback` | L7: * 3. PipelineOrchestrator.executeStageWithGates — retries before fallbacks |
| RISK-1009 | low | High Attention File | `tests/pipeline/retry-integration.test.ts` | `attention_score=100` | L2: * Integration tests for retryWithBackoff wired into pipeline stages. |
| RISK-1010 | medium | Concurrency Or Timing | `tests/pipeline/retry-metrics-parallel.test.ts` | `async` | L40: const { result, attempts } = await retryWithBackoff(async () => 'ok', { maxRetries: 3 }); |
| RISK-1011 | low | High Attention File | `tests/pipeline/retry-metrics-parallel.test.ts` | `attention_score=100` | L2: * Tests for retry observability in metrics and parallel execution paths. |
| RISK-1012 | medium | Concurrency Or Timing | `tests/pipeline/retry-observability-surface.test.ts` | `async` | L40: it('exposes totalRetryAttempts in pipeline result metrics', async () => { |
| RISK-1013 | low | High Attention File | `tests/pipeline/retry-observability-surface.test.ts` | `attention_score=100` | L2: * Tests for retry observability surfacing in pipeline completion output. |
| RISK-1014 | medium | Concurrency Or Timing | `tests/quality/enhanced-error-recovery.test.ts` | `async` | L56: test('should retry on failure and eventually succeed', async () => { |
| RISK-1015 | medium | Parser Or Heuristic | `tests/quality/enhanced-error-recovery.test.ts` | `fallback` | L3: * Covers: retryWithBackoff, executeWithFallback, createErrorNotification, |
| RISK-1016 | medium | Persistence Or State | `tests/quality/enhanced-error-recovery.test.ts` | `cache` | L10: // Mock the intelligent-cache module |
| RISK-1017 | low | High Attention File | `tests/quality/enhanced-error-recovery.test.ts` | `attention_score=100` | L3: * Covers: retryWithBackoff, executeWithFallback, createErrorNotification, |
| RISK-1018 | medium | Concurrency Or Timing | `tests/quality/error-classifier.test.ts` | `timeout` | L45: test('classifies LLM timeout errors', () => { |
| RISK-1019 | low | High Attention File | `tests/quality/error-classifier.test.ts` | `attention_score=100` | L18: const result = classifier.classify(new Error('Out of memory during rendering')); |
| RISK-1020 | medium | Concurrency Or Timing | `tests/quality/quality-gate.test.ts` | `retry` | L57: fallbackAction: 'retry', |
| RISK-1021 | medium | Parser Or Heuristic | `tests/quality/quality-gate.test.ts` | `fallback` | L57: fallbackAction: 'retry', |
| RISK-1022 | low | High Attention File | `tests/quality/quality-gate.test.ts` | `attention_score=70` | L57: fallbackAction: 'retry', |
| RISK-1023 | medium | Concurrency Or Timing | `tests/quality/regression-detector.test.ts` | `async` | L122: test('loads and parses baseline from disk', async () => { |
| RISK-1024 | medium | Parser Or Heuristic | `tests/quality/regression-detector.test.ts` | `parse` | L122: test('loads and parses baseline from disk', async () => { |
| RISK-1025 | low | High Attention File | `tests/quality/regression-detector.test.ts` | `attention_score=70` | L57: memoryUsage: 256, |
| RISK-1026 | medium | Network Or IPC | `tests/setupJestGlobals.ts` | `bridge` | L13: * This setup file bridges the gap: it imports the runtime object once and |
| RISK-1027 | medium | Concurrency Or Timing | `tests/test-phase19-adaptive-llm.ts` | `rate limit` | L179: console.log(`❌ Analysis failed (may be rate limited or API error)`); |
| RISK-1028 | medium | Persistence Or State | `tests/test-phase19-adaptive-llm.ts` | `cache` | L183: const stats = analyzer.getCacheStats(); |
| RISK-1029 | low | High Attention File | `tests/test-phase19-adaptive-llm.ts` | `attention_score=70` | L40: text: "The distributed microservices architecture employs event-driven communication patterns utilizing Apache Kafka as the message broker. Service mesh implementation via Istio provides traffic management, security |
| RISK-1030 | medium | Concurrency Or Timing | `tests/test-phase21-adaptive-content-analyzer.ts` | `async` | L87: async function testCacheEffectiveness() { |
| RISK-1031 | medium | Parser Or Heuristic | `tests/test-phase21-adaptive-content-analyzer.ts` | `fallback` | L11: * 4. Fallback mechanism |
| RISK-1032 | medium | Persistence Or State | `tests/test-phase21-adaptive-content-analyzer.ts` | `cache` | L10: * 3. Cache effectiveness |
| RISK-1033 | low | High Attention File | `tests/test-phase21-adaptive-content-analyzer.ts` | `attention_score=100` | L10: * 3. Cache effectiveness |
| RISK-1034 | medium | Concurrency Or Timing | `tests/test-phase22-unified-llm-service.ts` | `async` | L125: async function test3_CacheEffectiveness(): Promise<boolean> { |
| RISK-1035 | medium | Parser Or Heuristic | `tests/test-phase22-unified-llm-service.ts` | `fallback` | L10: * 5. Error handling and fallback mechanisms |
| RISK-1036 | medium | Persistence Or State | `tests/test-phase22-unified-llm-service.ts` | `cache` | L8: * 3. Cache effectiveness across components |
| RISK-1037 | low | High Attention File | `tests/test-phase22-unified-llm-service.ts` | `attention_score=100` | L8: * 3. Cache effectiveness across components |
| RISK-1038 | medium | Persistence Or State | `tests/test-phase23-gemini-analyzer-unified.ts` | `cache` | L8: * 4. Shares cache with ContentAnalyzer |
| RISK-1039 | low | High Attention File | `tests/test-phase23-gemini-analyzer-unified.ts` | `attention_score=100` | L5: * 1. Maintains backward compatibility with Phase 19/22 API |
| RISK-1040 | medium | Concurrency Or Timing | `tests/test-phase26-relationship-extraction.ts` | `timeout` | L184: console.log(` Avg Response: ${stats.adaptiveTimeout.avgResponseTimeMs.toFixed(0)}ms`); |
| RISK-1041 | medium | Persistence Or State | `tests/test-phase26-relationship-extraction.ts` | `cache` | L154: const stats = analyzer.getCacheStats(); |
| RISK-1042 | high | Security Boundary | `tests/transcription/streaming-quality-monitor.test.ts` | `session` | L5: * alert emission, and session summaries. |
| RISK-1043 | high | Security Boundary | `tests/unit/api/batch-parallel-processing.test.ts` | `token` | L7: * - Respects cancellation tokens |
| RISK-1044 | medium | Concurrency Or Timing | `tests/unit/api/batch-parallel-processing.test.ts` | `async` | L63: const worker = async (): Promise<void> => { |
| RISK-1045 | low | High Attention File | `tests/unit/api/batch-parallel-processing.test.ts` | `attention_score=100` | L7: * - Respects cancellation tokens |
| RISK-1046 | medium | Parser Or Heuristic | `tests/unit/api/cors-config.test.ts` | `parse` | L48: test('should parse CORS_ORIGINS env var as comma-separated list', () => { |
| RISK-1047 | medium | Concurrency Or Timing | `tests/unit/api/pipeline-rate-limit.test.ts` | `async` | L18: it('should include rate limit headers on POST /api/render', async () => { |
| RISK-1048 | low | High Attention File | `tests/unit/api/pipeline-rate-limit.test.ts` | `attention_score=100` | L4: * Ensures the API rate limiter middleware is active on /api pipeline |
| RISK-1049 | medium | Concurrency Or Timing | `tests/unit/api/request-timeout.test.ts` | `async` | L51: it('returns 504 when a request exceeds the timeout', async () => { |
| RISK-1050 | low | High Attention File | `tests/unit/api/request-timeout.test.ts` | `attention_score=100` | L2: * Tests for request timeout middleware. |
| RISK-1051 | high | Security Boundary | `tests/unit/api/routes/monitoring.test.ts` | `token` | L121: customDashboard.recordTokenUsage({ |
| RISK-1052 | medium | Persistence Or State | `tests/unit/api/routes/monitoring.test.ts` | `cache` | L53: warmupCache: jest.fn(), |
| RISK-1053 | low | High Attention File | `tests/unit/api/routes/monitoring.test.ts` | `attention_score=100` | L53: warmupCache: jest.fn(), |
| RISK-1054 | medium | Concurrency Or Timing | `tests/unit/api/server-rate-limit.test.ts` | `async` | L18: it('should include rate limit headers on batch job creation', async () => { |
| RISK-1055 | low | High Attention File | `tests/unit/api/server-rate-limit.test.ts` | `attention_score=98` | L4: * Ensures the upload rate limiter middleware is active on /api/v1/batch |
| RISK-1056 | high | Security Boundary | `tests/unit/api/websocket-handler.test.ts` | `auth` | L11: * - JWT auth middleware on connection |
| RISK-1057 | medium | Network Or IPC | `tests/unit/api/websocket-handler.test.ts` | `socket` | path contains `socket` |
| RISK-1058 | medium | Parser Or Heuristic | `tests/unit/api/websocket-handler.test.ts` | `json` | L15: import * as jwt from 'jsonwebtoken'; |
| RISK-1059 | low | High Attention File | `tests/unit/api/websocket-handler.test.ts` | `attention_score=100` | L2: * TASK-0047: WebSocket Real-time Progress Notification - Tests |
| RISK-1060 | medium | Network Or IPC | `tests/unit/api/websocket-payload-validation.test.ts` | `socket` | path contains `socket` |
| RISK-1061 | low | High Attention File | `tests/unit/api/websocket-payload-validation.test.ts` | `attention_score=100` | L2: * ISS-042: WebSocket payload validation tests |
| RISK-1062 | medium | Concurrency Or Timing | `tests/unit/config/centralized-limits.test.ts` | `rate limit` | L23: it('should define API rate limit with window and max', () => { |
| RISK-1063 | medium | Persistence Or State | `tests/unit/config/production-config.test.ts` | `cache` | L19: // Clear module cache so production-config is re-imported fresh |
| RISK-1064 | high | Security Boundary | `tests/unit/edge-functions/auth.test.ts` | `auth` | path contains `auth` |
| RISK-1065 | low | High Attention File | `tests/unit/edge-functions/auth.test.ts` | `attention_score=100` | L2: extractToken, |
| RISK-1066 | high | Security Boundary | `tests/unit/edge-functions/error-handler.test.ts` | `auth` | L19: it('should include authorization in allowed headers', () => { |
| RISK-1067 | medium | Concurrency Or Timing | `tests/unit/edge-functions/error-handler.test.ts` | `timeout` | L9: createTimeout, |
| RISK-1068 | low | High Attention File | `tests/unit/edge-functions/error-handler.test.ts` | `attention_score=100` | L9: createTimeout, |
| RISK-1069 | medium | Concurrency Or Timing | `tests/unit/edge-functions/generate-scenes.test.ts` | `timeout` | L7: GENERATE_TIMEOUT_MS, |
| RISK-1070 | medium | Concurrency Or Timing | `tests/unit/edge-functions/render-video.test.ts` | `timeout` | L4: RENDER_TIMEOUT_MS, |
| RISK-1071 | medium | Concurrency Or Timing | `tests/unit/edge-functions/timeout.test.ts` | `timeout` | path contains `timeout` |
| RISK-1072 | low | High Attention File | `tests/unit/edge-functions/timeout.test.ts` | `attention_score=100` | L2: createTimeout, |
| RISK-1073 | medium | Concurrency Or Timing | `tests/unit/edge-functions/transcribe-audio.test.ts` | `await` | L22: const { fetchWithTimeout } = await import('#supabase/functions/_shared/error-handler.ts') as { fetchWithTimeout: jest.Mock }; |
| RISK-1074 | low | High Attention File | `tests/unit/edge-functions/transcribe-audio.test.ts` | `attention_score=100` | L5: // Mock the error-handler module's fetchWithTimeout |
| RISK-1075 | low | High Attention File | `tests/unit/hooks/use-framework-pipeline.test.ts` | `attention_score=100` | L6: * REQ-137: useFrameworkPipeline Hook Unit Tests |
| RISK-1076 | medium | Concurrency Or Timing | `tests/unit/hooks/use-toast.test.ts` | `timeout` | L16: // Use fake timers to control setTimeout in addToRemoveQueue side-effect |
| RISK-1077 | medium | Concurrency Or Timing | `tests/unit/monitoring/health-check-service-exception.test.ts` | `timeout` | L48: recentErrors: ['timeout error'], |
| RISK-1078 | medium | Parser Or Heuristic | `tests/unit/monitoring/health-check-service-exception.test.ts` | `fallback` | L2: * REQ-134: HealthCheckService Exception / Degraded-Status Fallback Tests |
| RISK-1079 | medium | Persistence Or State | `tests/unit/monitoring/health-check-service-exception.test.ts` | `cache` | L35: cacheHitRate: 0.6, |
| RISK-1080 | low | High Attention File | `tests/unit/monitoring/health-check-service-exception.test.ts` | `attention_score=100` | L2: * REQ-134: HealthCheckService Exception / Degraded-Status Fallback Tests |
| RISK-1081 | medium | Concurrency Or Timing | `tests/unit/monitoring/health-check-service.test.ts` | `timeout` | L54: recentErrors: ['timeout error'], |
| RISK-1082 | medium | Persistence Or State | `tests/unit/monitoring/health-check-service.test.ts` | `cache` | L6: * memory, cache, pipeline, LLM, error recovery, and performance trends. |
| RISK-1083 | low | High Attention File | `tests/unit/monitoring/health-check-service.test.ts` | `attention_score=100` | L6: * memory, cache, pipeline, LLM, error recovery, and performance trends. |
| RISK-1084 | medium | Concurrency Or Timing | `tests/unit/optimization/adaptive-content-processor.test.ts` | `async` | L129: it('caches strategy for same fingerprint', async () => { |
| RISK-1085 | medium | Persistence Or State | `tests/unit/optimization/adaptive-content-processor.test.ts` | `cache` | L129: it('caches strategy for same fingerprint', async () => { |
| RISK-1086 | low | High Attention File | `tests/unit/optimization/adaptive-content-processor.test.ts` | `attention_score=100` | L91: expect(result.strategy.transcriptionConfig.retryCount).toBeGreaterThanOrEqual(3); |
| RISK-1087 | medium | Concurrency Or Timing | `tests/unit/optimization/batch-optimizer.test.ts` | `async` | L9: const identityProcessor = async (item: number, _index: number) => item * 2; |
| RISK-1088 | medium | Concurrency Or Timing | `tests/unit/optimization/cache-warmup.test.ts` | `async` | L54: const resolver = async (text: string): Promise<string> => `resolved: ${text}`; |
| RISK-1089 | medium | Persistence Or State | `tests/unit/optimization/cache-warmup.test.ts` | `cache` | path contains `cache` |
| RISK-1090 | low | High Attention File | `tests/unit/optimization/cache-warmup.test.ts` | `attention_score=100` | L1: import { CacheWarmupManager, WarmupPattern, WarmupResult } from '@/optimization/cache-warmup'; |
| RISK-1091 | medium | Concurrency Or Timing | `tests/unit/optimization/computation-cache.test.ts` | `async` | L20: const result1 = await cache.getOrCompute('key1', async () => { |
| RISK-1092 | medium | Persistence Or State | `tests/unit/optimization/computation-cache.test.ts` | `cache` | path contains `cache` |
| RISK-1093 | low | High Attention File | `tests/unit/optimization/computation-cache.test.ts` | `attention_score=100` | L2: ComputationCache, |
| RISK-1094 | medium | Concurrency Or Timing | `tests/unit/optimization/lazy-loader.test.ts` | `async` | L41: const loaderFn = async () => { |
| RISK-1095 | medium | Persistence Or State | `tests/unit/optimization/lazy-loader.test.ts` | `cache` | L157: // Second get should use cache |
| RISK-1096 | low | High Attention File | `tests/unit/optimization/lazy-loader.test.ts` | `attention_score=92` | L44: await new Promise((resolve) => setTimeout(resolve, 50)); |
| RISK-1097 | medium | Persistence Or State | `tests/unit/optimization/memory-cache.test.ts` | `cache` | path contains `cache` |
| RISK-1098 | low | High Attention File | `tests/unit/optimization/memory-cache.test.ts` | `attention_score=100` | L1: import { MemoryCache } from '@/optimization/memory-cache'; |
| RISK-1099 | medium | Persistence Or State | `tests/unit/performance/cache-health.test.ts` | `cache` | path contains `cache` |
| RISK-1100 | low | High Attention File | `tests/unit/performance/cache-health.test.ts` | `attention_score=100` | L2: * Tests for cache health monitoring and corruption recovery. |
| RISK-1101 | medium | Concurrency Or Timing | `tests/unit/performance/intelligent-cache.test.ts` | `await` | L12: await cache.store('test content', { result: 'hello' }, { |
| RISK-1102 | medium | Persistence Or State | `tests/unit/performance/intelligent-cache.test.ts` | `cache` | path contains `cache` |
| RISK-1103 | low | High Attention File | `tests/unit/performance/intelligent-cache.test.ts` | `attention_score=100` | L1: import { IntelligentCache, globalCache, cached } from '@/performance/intelligent-cache'; |
| RISK-1104 | high | Security Boundary | `tests/unit/pipeline/cost-efficiency-metrics.test.ts` | `token` | L5: * - calculateCostEfficiency: per-unit cost/token computation |
| RISK-1105 | low | High Attention File | `tests/unit/pipeline/cost-efficiency-metrics.test.ts` | `attention_score=100` | L5: * - calculateCostEfficiency: per-unit cost/token computation |
| RISK-1106 | medium | Concurrency Or Timing | `tests/unit/pipeline/parallel-layout-executor.test.ts` | `timeout` | L17: const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)); |
| RISK-1107 | low | High Attention File | `tests/unit/pipeline/performance-baseline.test.ts` | `attention_score=100` | L27: expect(result!.maxMemoryMB).toBe(50); |
| RISK-1108 | high | Security Boundary | `tests/unit/pipeline/pipeline-health-score.test.ts` | `token` | L77: tokensPerAnalysis: 2000, |
| RISK-1109 | low | High Attention File | `tests/unit/pipeline/pipeline-health-score.test.ts` | `attention_score=100` | L77: tokensPerAnalysis: 2000, |
| RISK-1110 | medium | Concurrency Or Timing | `tests/unit/pipeline/pipeline-orchestrator.test.ts` | `async` | L227: it('should invoke fallback when a quality gate fails', async () => { |
| RISK-1111 | medium | Parser Or Heuristic | `tests/unit/pipeline/pipeline-orchestrator.test.ts` | `fallback` | L14: FallbackStrategy, |
| RISK-1112 | low | High Attention File | `tests/unit/pipeline/pipeline-orchestrator.test.ts` | `attention_score=100` | L14: FallbackStrategy, |
| RISK-1113 | medium | Parser Or Heuristic | `tests/unit/pipeline/pipeline-quality-monitor.test.ts` | `fallback` | L45: fallbackTriggered: false, |
| RISK-1114 | medium | Persistence Or State | `tests/unit/pipeline/pipeline-quality-monitor.test.ts` | `cache` | L96: cacheHitRate: 0.8, |
| RISK-1115 | low | High Attention File | `tests/unit/pipeline/pipeline-quality-monitor.test.ts` | `attention_score=100` | L13: // Get fresh instance via private constructor reset |
| RISK-1116 | medium | Concurrency Or Timing | `tests/unit/pipeline/stage-timing-metrics.test.ts` | `await` | L91: await new Promise(resolve => setTimeout(resolve, 50)); |
| RISK-1117 | medium | Concurrency Or Timing | `tests/unit/pipeline/streaming-transcriber.test.ts` | `timeout` | L215: // Resolve the timeout |
| RISK-1118 | medium | Persistence Or State | `tests/unit/quality/adaptive-quality-gates.test.ts` | `cache` | L13: llm: { cacheHitRate: 0.5, avgFlashResponseTime: 1000, avgProResponseTime: 5000, flashUsagePercent: 80 }, |
| RISK-1119 | medium | Concurrency Or Timing | `tests/unit/quality/enhanced-error-recovery.test.ts` | `async` | L28: it('should retry with exponential backoff on transient failures', async () => { |
| RISK-1120 | medium | Parser Or Heuristic | `tests/unit/quality/enhanced-error-recovery.test.ts` | `fallback` | L4: * Tests for the retry with exponential backoff, fallback processing, |
| RISK-1121 | low | High Attention File | `tests/unit/quality/enhanced-error-recovery.test.ts` | `attention_score=100` | L4: * Tests for the retry with exponential backoff, fallback processing, |
| RISK-1122 | medium | Concurrency Or Timing | `tests/unit/quality/error-classifier.test.ts` | `timeout` | L104: it('should classify LLM timeout errors', () => { |
| RISK-1123 | low | High Attention File | `tests/unit/quality/error-classifier.test.ts` | `attention_score=100` | L87: it('should classify LLM rate limited errors', () => { |
| RISK-1124 | medium | Concurrency Or Timing | `tests/unit/quality/quality-gate.test.ts` | `retry` | L546: fallbackAction: 'retry', |
| RISK-1125 | medium | Parser Or Heuristic | `tests/unit/quality/quality-gate.test.ts` | `fallback` | L546: fallbackAction: 'retry', |
| RISK-1126 | low | High Attention File | `tests/unit/quality/quality-gate.test.ts` | `attention_score=70` | L546: fallbackAction: 'retry', |
| RISK-1127 | medium | Concurrency Or Timing | `tests/unit/quality/user-guided-error-recovery.test.ts` | `timeout` | L87: it('should classify timeout errors', () => { |
| RISK-1128 | low | High Attention File | `tests/unit/quality/user-guided-error-recovery.test.ts` | `attention_score=100` | L80: it('should classify memory errors', () => { |
| RISK-1129 | medium | Parser Or Heuristic | `tests/unit/transcription/transcription-pipeline-validation.test.ts` | `fallback` | L54: // past validation. It may succeed (fallback segments) or fail, but should |
| RISK-1130 | medium | Parser Or Heuristic | `tests/unit/utils/iteration-logger.test.ts` | `regex` | L14: const escapeRegex = (s: string) => s.replace(/[.*+?^${}()\|[\]\\]/g, '\\$&'); |
| RISK-1131 | medium | Concurrency Or Timing | `tests/unit/utils/memory-usage.test.ts` | `async` | L27: test('should use process.memoryUsage when available', async () => { |
| RISK-1132 | medium | Parser Or Heuristic | `tests/unit/utils/memory-usage.test.ts` | `fallback` | L7: * - Fallback: returns zeroes |
| RISK-1133 | low | High Attention File | `tests/unit/utils/memory-usage.test.ts` | `attention_score=100` | L2: * REQ-138: memory-usage.ts Unit Tests |
| RISK-1134 | medium | Concurrency Or Timing | `tests/validate-llm-accuracy.ts` | `timeout` | L294: console.log(` Adaptive Timeout: ${cacheStats.adaptiveTimeout.currentTimeoutMs}ms`); |
| RISK-1135 | medium | Persistence Or State | `tests/validate-llm-accuracy.ts` | `cache` | L288: // Cache statistics |
| RISK-1136 | low | High Attention File | `tests/validate-llm-accuracy.ts` | `attention_score=100` | L288: // Cache statistics |
| RISK-1137 | medium | Parser Or Heuristic | `tests/visualization/advanced-layouts.test.ts` | `fallback` | L160: test('should fallback to dark theme for unknown theme name', () => { |
| RISK-1138 | low | High Attention File | `tests/visualization/advanced-layouts.test.ts` | `attention_score=100` | L160: test('should fallback to dark theme for unknown theme name', () => { |
| RISK-1139 | medium | Concurrency Or Timing | `tests/visualization/complex-layout-engine.test.ts` | `async` | L547: it('should optimize memory when memoryUsage exceeds limit', async () => { |
| RISK-1140 | medium | Parser Or Heuristic | `tests/visualization/complex-layout-engine.test.ts` | `fallback` | L6: import { FallbackLayoutStrategy } from '@/visualization/strategies/FallbackLayoutStrategy'; |
| RISK-1141 | low | High Attention File | `tests/visualization/complex-layout-engine.test.ts` | `attention_score=100` | L6: import { FallbackLayoutStrategy } from '@/visualization/strategies/FallbackLayoutStrategy'; |
| RISK-1142 | high | Destructive Mutation | `tests/visualization/cycle-strategy.test.ts` | `force` | L4: * Includes edge cases: empty nodes, single node, overlaps, force-directed fallback, |
| RISK-1143 | medium | Parser Or Heuristic | `tests/visualization/cycle-strategy.test.ts` | `fallback` | L4: * Includes edge cases: empty nodes, single node, overlaps, force-directed fallback, |
| RISK-1144 | low | High Attention File | `tests/visualization/cycle-strategy.test.ts` | `attention_score=70` | L4: * Includes edge cases: empty nodes, single node, overlaps, force-directed fallback, |
| RISK-1145 | high | Destructive Mutation | `tests/visualization/enhanced-zero-overlap-layout.test.ts` | `force` | L18: * Uses bracket notation to bypass TypeScript private access enforcement. |
| RISK-1146 | medium | Persistence Or State | `tests/visualization/enhanced-zero-overlap-layout.test.ts` | `state` | L431: test('should clear internal state without throwing', () => { |
| RISK-1147 | low | High Attention File | `tests/visualization/enhanced-zero-overlap-layout.test.ts` | `attention_score=100` | L17: * Helper to access private methods on ZeroOverlapLayoutEngine for testing. |
| RISK-1148 | high | Destructive Mutation | `tests/visualization/force-directed-simulation.test.ts` | `force` | path contains `force` |
| RISK-1149 | medium | Parser Or Heuristic | `tests/visualization/force-directed-simulation.test.ts` | `fallback` | L22: import { FallbackLayoutStrategy } from '@/visualization/strategies/FallbackLayoutStrategy'; |
| RISK-1150 | medium | Parser Or Heuristic | `tests/visualization/graph-coarsening.test.ts` | `fallback` | L21: import { FallbackLayoutStrategy } from '@/visualization/strategies/FallbackLayoutStrategy'; |
| RISK-1151 | medium | Concurrency Or Timing | `tests/visualization/layout-auto-optimizer.test.ts` | `async` | L120: it('tries fallback strategy when primary gives low score', async () => { |
| RISK-1152 | medium | Parser Or Heuristic | `tests/visualization/layout-auto-optimizer.test.ts` | `fallback` | L120: it('tries fallback strategy when primary gives low score', async () => { |
| RISK-1153 | low | High Attention File | `tests/visualization/layout-auto-optimizer.test.ts` | `attention_score=70` | L120: it('tries fallback strategy when primary gives low score', async () => { |
| RISK-1154 | medium | Parser Or Heuristic | `tests/visualization/overlap-resolver.test.ts` | `fallback` | L66: expect(overlaps).toHaveLength(0); // Grid-snap fallback guarantees this |
| RISK-1155 | high | Destructive Mutation | `tests/visualization/strategies/cycle-strategy.test.ts` | `force` | L133: it('should apply force-directed fallback for overlapping large nodes', () => { |
| RISK-1156 | medium | Parser Or Heuristic | `tests/visualization/strategies/cycle-strategy.test.ts` | `fallback` | L133: it('should apply force-directed fallback for overlapping large nodes', () => { |
| RISK-1157 | medium | Parser Or Heuristic | `tests/visualization/strategies/fallback-layout-strategy.test.ts` | `fallback` | path contains `fallback` |
| RISK-1158 | low | High Attention File | `tests/visualization/strategies/fallback-layout-strategy.test.ts` | `attention_score=100` | L1: import { FallbackLayoutStrategy } from '@/visualization/strategies/FallbackLayoutStrategy'; |
| RISK-1159 | medium | Parser Or Heuristic | `tests/visualization/strategies/flow-strategy.test.ts` | `fallback` | L232: describe('many overlapping nodes (triggers gridSnapFallback)', () => { |
| RISK-1160 | medium | Parser Or Heuristic | `tests/visualization/strategies/timeline-strategy.test.ts` | `fallback` | L105: it('should use index order as fallback when no edges are provided', () => { |
| RISK-1161 | medium | Parser Or Heuristic | `tests/visualization/strategies/tree-strategy.test.ts` | `fallback` | L237: describe('many overlapping nodes (triggers gridSnapFallback)', () => { |
| RISK-1162 | medium | Concurrency Or Timing | `tests/visualization/strategy-selector-execute-layout.test.ts` | `async` | L71: it('should use fallback for unknown diagram types', async () => { |
| RISK-1163 | medium | Parser Or Heuristic | `tests/visualization/strategy-selector-execute-layout.test.ts` | `fallback` | L71: it('should use fallback for unknown diagram types', async () => { |
| RISK-1164 | low | High Attention File | `tests/visualization/strategy-selector-execute-layout.test.ts` | `attention_score=84` | L71: it('should use fallback for unknown diagram types', async () => { |
| RISK-1165 | medium | Parser Or Heuristic | `tests/visualization/strategy-selector.test.ts` | `fallback` | L37: // But we test the fallback behavior through executeLayout with valid types |
| RISK-1166 | medium | Parser Or Heuristic | `tsconfig.app.json` | `json` | path contains `json` |
| RISK-1167 | medium | Parser Or Heuristic | `tsconfig.json` | `json` | path contains `json` |
| RISK-1168 | medium | Parser Or Heuristic | `tsconfig.node.json` | `json` | path contains `json` |
| RISK-1169 | medium | Parser Or Heuristic | `tsconfig.test.json` | `json` | path contains `json` |
| RISK-1170 | high | Process Execution | `vite.config.ts` | `child_process` | L56: return ['path', 'fs', 'os', 'util', 'assert', 'module', 'child_process', 'stream', 'worker_threads', 'crypto', 'url', 'http', 'https', 'net', 'tls'].some(nodeModule => |
| RISK-1171 | medium | Network Or IPC | `vite.config.ts` | `http` | L56: return ['path', 'fs', 'os', 'util', 'assert', 'module', 'child_process', 'stream', 'worker_threads', 'crypto', 'url', 'http', 'https', 'net', 'tls'].some(nodeModule => |
| RISK-1172 | medium | Concurrency Or Timing | `vite.config.ts` | `thread` | L56: return ['path', 'fs', 'os', 'util', 'assert', 'module', 'child_process', 'stream', 'worker_threads', 'crypto', 'url', 'http', 'https', 'net', 'tls'].some(nodeModule => |
| RISK-1173 | low | High Attention File | `vite.config.ts` | `attention_score=70` | L2: import react from "@vitejs/plugin-react-swc"; |

## Review Guidance

- High severity findings should be reviewed before converting extracted knowhow into reusable skills.
- Check whether the source has tests or guardrails for the cited trust boundary.
- Treat this register as a static-analysis triage list, not a proof of vulnerability.
