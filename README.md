# AVAX Gas Report

Static GitHub Pages dashboard for hourly C-Chain gas averages.

## Local Preview

```bash
python3 -m http.server 8080
```

Open:

Use the address printed by `python3 -m http.server`.

## Generate Data From L1Beat

```bash
python3 scripts/fetch-l1beat-gas-report.py > data/latest.json
```

## GitHub Pages Setup

1. Create an empty GitHub repository, for example `avax-gas-report`.
2. Push this folder:

```bash
git init
git add .
git commit -m "Initial AVAX gas report page"
git branch -M main
git remote add origin git@github.com:YOUR_USER/avax-gas-report.git
git push -u origin main
```

3. In GitHub:
   - Repository `Settings`
   - `Pages`
   - Source: `GitHub Actions`
4. The included workflow deploys the static site after every push to `main`.

## Updating Daily

Generate a fresh `data/latest.json`, then:

```bash
git add data/latest.json
git commit -m "Update gas report"
git push
```

## Automatic Updates From L1Beat

This repo includes a GitHub Actions workflow:

```text
.github/workflows/update-data.yml
```

It runs hourly and writes:

```text
data/latest.json
```

Default RPC:

```text
https://rpc.l1beat.io/ext/bc/C/rpc
```

Manual run:

```text
GitHub -> Actions -> Update Gas Data -> Run workflow
```

The static page reads `data/latest.json` by default and can also load static
archive files listed in:

```text
data/archive/index.json
```

Implementation note: L1Beat allows historical `eth_getBlockByNumber` reads, while
large `eth_feeHistory` ranges can hit historical limits. The updater therefore
samples roughly one block per minute and groups those samples by hour.

## Current Policy Shown

The dashboard currently displays:

- low below: `90m wei`
- high above: `130m wei`
- stop above: `220m wei`

These values come from `data/latest.json`.
