# Git hooks

`.git/hooks/` isn't tracked by git, so hooks here are copied in manually. One-time setup after cloning:

```sh
cp scripts/git-hooks/post-commit .git/hooks/post-commit
chmod +x .git/hooks/post-commit
```

## post-commit

Warns (does not block) when a commit touches `stock-sim/engine/*.py`, `stock-sim/engine/orchestrator.py`, or the price/value config seed files without also updating `stock-sim/docs/price-value-engine.md` in the same commit. See that file's "Maintenance Protocol" section for what to update.
