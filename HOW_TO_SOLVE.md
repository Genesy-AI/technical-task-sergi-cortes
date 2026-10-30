# Steps to Solve

The problem is based on a relative small codebase and focused on a single developer.

Depending on the problem scale, the solution can be solved using different approaches, but I would use a reduced harness to solve the problem. Also for a team, some tools would need to be differently configured.

## Why the harness and context that is used

I try to use a reduced harness to solve the problem. Nowadays the models and tools are better and more powerful.

Using a small and controled harness allows me to focus on the problem and the solution, without being distracted by the tools and the environment.

I have added to the repo the AGENTS.md that I have globally defined.

### Tools

- **Claude Code CLI**: AI agent that normally I run. In the past I used to run PI.
- **Herdr**: Terminal multiplexer that allows me to run multiple terminals in one window. It has specific AI features, like panels for the agents.
- **Neovim**: editor for the code and the documentation. I have configured it with some plugins that allow me to communicate with Herdr.
- **OpenSpec**: Specifications as the source of truth, which allows me to define which are the inputs and how to check the AI outputs.

### Skills

I try to reduce the number of skills. The models and tools are powerful enough to solve the problem, but I have added some skills that allow me to improve the quality of the solution.

```bash
 code-review-and-quality   conventional-commit   performance-optimization   openspec
 code-simplification       no-mistakes           security-and-hardening
```

### Plugins

Plugins for Claude Code and Herdr

```bash
❯ claude-mem@thedotmack
Version: 15.4.0
Scope: user
Status: ✔ enabled

Herdr 2 plugins installed
- chmarax.herdr-nvim (herdr-nvim) enabled [github:ChmaraX/herdr-nvim@3ef126f68b443469f6d3c09248380ce18f70fd5b]
- openspec (openspec) enabled [github:FlorisKr/herdr-openspec@240a28e937283214e5317a0e89fbb714bae88629]

Herdr 3 plugins made by me
- community.claude-mem-clean (claude-mem clean) enabled [local:~/.config/herdr/plugins/herdr-claude-mem-clean]
- community.claude-subagents (Claude Code subagents) enabled [local:~/.config/herdr/plugins/herdr-claude-subagents]
- worktree-sync (Worktree Sync) enabled [local:~/.config/herdr/plugins/herdr-worktree-sync]
```

- Claude-mem: Allows to store and retrieve context in SQLLite, which is useful for caching results, reduce tokens and improving performance.
- Herdr-nvim: Allows to comunicate Neovim and Herdr, which is my preferred editor.
- Openspec: Allows to view OpenSpec specifications in a more readable way, which is useful for understanding the problem and the solution.
- Worktree Sync: Allows to sync the git worktree with the herdr spaces
- Claude Subagents: Allows to view subagents in a more readable way
- Claude-mem clean: Allows to clean the claude-mem database

## How it will be used to solve the problem

- The harness and context that I have defined will be used to solve the problem in a controlled and efficient way.

- The folders are structured with the following purpose:
  - `design/architecture` folder: Architecture diagrams and code design consideration.
  - `openspec/` folder: OpenSpec specifications for the features that will be implemented.
  - `design/fixes` folder: BugFix specifications for the bugs that will be fixed.
  - `design/decisions` folder: Architectural decisions that will be made during the implementation of the solution.
  - `design/improvements` folder: Improvements that could be made, which will improve the product and the codebase.

- Before starting a problem, AI will summarize the code design, architecture diagrams, and the problem statement in a design folder, which will be used as a reference for the specifications.

- My context is to solve the problem in vertical slices using SDD (Specification Driven Development) and TDD (Test Driven Development) approaches.
- The AI will use Openspec core workflow, following the steps of the SDD and TDD approaches, which are:
  - Define the specification of the problem and the solution.
  - Define the tests that will validate the solution.
  - Implement the solution.
  - Run the tests and validate the solution.
  - Human approval of the solution and PR.
- Features and Bug Fixes: Solved using OpenSpec, where specs are the source of truth, and the model and the tools are used to implement the solution.
  - Core Workflow: Explore -> Propose -> Review -> Apply and verify -> Sync -> Archive
  - If the codebase or product would be bigger, I would use a more complex solution, designing and using an specific workflow inside the same tools.

- Create the PR for human review and approval, which then will be merged.
  - Before creating, validate the outputs with the specs and testings
  - When creating, update the CHANGELOG.md

## What are the expected outcomes and how to measure success

- The expected outcome is to have a working solution that meets the specifications and passes the tests.
  - All specification tasks ans sub-tasks are completed
  - Security check, including OWASP, to check for vulnerabilities and security issues.
  - Testing check, including unit tests, integration tests, and end-to-end tests.
  - Code Quality check, including code style, code smells, and code complexity.
  - Performance check (Optional), including performance tests and benchmarks.
