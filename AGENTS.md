# Agents instructions

These are common instructions for agents across all scenarios.

## General guidelines

- Never use the em dash "—" in your responses. Use a plain dash "-" instead.
- When writing comment message, commits or others, never auto-add your agent name as author or co-author.
- Avoid personal details in prompts, screenshots, logs, and scratch files.
- Create or modify a CHANGELOG.md file following the Keep a Changelog format for every PR that changes the codebase.
- When writing or substantially editing long Markdown files, put each full sentence in its own line.
  - Preserve normal Markdown structure, but avoid wrapping multiple sentences onto one physical line.
  - Let a blank line separate paragraphs, lists, and headings.
- When making technical decisions, don't give much weight to development cost. Instead, prefer quality, simplicity, robustness, scalability and long-term maintainability.
- When doing bug fixes, always start with reproducing the bug in the E2E setting as closely aligned with how an end user would experience it as possible.
  - This makes sure you find the real problems so your fix will actually solve it.
- When end-to-end testing a product, be picky about the UI you see and be obsessed with pixel perfection.
  - If something clearly looks off, even if it's not directly related to what you are doing, try to get it fixed along.
- Apply that same high standard to engineering excellence: lean, test failures, and test flakiness.
  - If you see one, even if it's not caused by what you are working on right now, still get it fixed.
- TDD is mandatory for bug fixes and new features.
- Openspec is mandatory for bug fixes and new features.
  - The tasks or subtasks in the spec should be solved in parallel with different subagents if they are independent, and in sequence if they are dependent on each other.
- When generating or modifying code in a git repository, always do it in a new git worktree
- When generating or modifying code in a git repository, always create small commits that follows commitlint with clear commit messages that explain the "why" behind the change, not just the "what".
  - If a spec is being solved, create a commit for each task solved in the spec, not create a commit for each subtask in the task.
- When making changes to the codebase, always run all tests and linters before submitting a PR or merging the code.
  - Check also the security (OWASP included), code quality (complexity), performance, and maintainability. If you see a problem, even if it's not directly related to what you are working on, ask the human what to do.
- Create a document in `design/decisions` folder for any architectural or design changes or decisions made. Use few sentences to explain the decision and why it was made. Link to the spec it is related to.
- Create a document in `design/improvements` folder for any improvements that could be made to the product or codebase. Use few sentences to explain the improvement and why it is needed. Link to the spec it is related to.
