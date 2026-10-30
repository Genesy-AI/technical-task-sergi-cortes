# Remove the unused API mutation registry

`frontend/src/api/mutations/useApiMutation.ts` defines a typed registry of mutation options, but no component uses it.
It pulls in `lodash` and `ts-toolbelt` and relies on `any` in its type plumbing, which now needs a file-level lint exception.
It also caused the build-breaking type error fixed in task 2.3 of the change below, because its optimistic lead drifted from the lead type.
Removing it, or replacing it with plain `useMutation` calls when optimistic updates are needed, would cut dead complexity and two dependencies.
Removal was not done in the bug fix because deleting a shared abstraction is a design decision for the team.

Related change: [fix-csv-country-codes](../../openspec/changes/fix-csv-country-codes/proposal.md), task 2.3.
Related finding: A9 in [05-assessment.md](../architecture/05-assessment.md).
