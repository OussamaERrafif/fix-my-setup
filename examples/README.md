# Examples

## `sample-output.txt`

Real human-readable output of `fix-my-setup --port 3000 --no-network` run inside
[`demo-project/`](./demo-project). It shows the tool catching two real issues:

- `package.json` declares a dependency but `node_modules` is missing
- `.env` exists but `DATABASE_URL` is missing

## `sample-report.json`

A real **anonymized** report (`fix-my-setup report`). Note that no usernames,
home paths, project paths, or environment values appear — only key names and
statuses.

## Try it yourself

```bash
cd examples/demo-project
cp .env.sample .env          # Windows: copy .env.sample .env
npx fix-my-setup --port 3000
```

You should see the missing `DATABASE_URL` warning and the missing-`node_modules`
error, each with a suggested fix. Delete the `.env` afterward — it is only for
the demo.
