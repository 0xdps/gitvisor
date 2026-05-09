## What does this PR do?

<!-- A clear and concise description of the change. -->

## Related issue

<!-- Fixes #<issue_number> or N/A -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor / code quality
- [ ] Documentation
- [ ] Dependency update
- [ ] Infrastructure / CI

## Checklist

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm build` passes
- [ ] Core packages do not import from cloud (`packages/*` have no cloud deps)
- [ ] No `console.log` left in production code paths
- [ ] `.env.example` updated if new env vars were added
