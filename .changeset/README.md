# Changesets

This repository uses [changesets](https://github.com/changesets/changesets) to manage versioning and publishing.

## Adding a changeset

When making changes that should result in a version bump, run:

```bash
npm run changeset
```

This will open an interactive prompt to:
1. Select which packages are affected
2. Choose the semver bump type (patch, minor, major)
3. Write a summary of the changes

## Versioning

When ready to release, the release workflow will:
1. Consume all pending changesets
2. Update package versions
3. Update CHANGELOG.md files
4. Publish to npm

## Manual version bump

To manually bump versions locally (creates a PR):

```bash
npm run version-packages
```
