# AVAX Gas Report Page Plan

## Goal

Publish a lightweight GitHub Pages site that shows hourly Avalanche C-Chain gas averages for AVAX gas monitoring.

## Page Structure

- Header
  - Current report date and data source
  - Latest average / min / max summary
- Main chart
  - 24 hourly bars
  - Average gwei as the main value
  - Min/max range shown in tooltip/table
- Hourly table
  - Hour
  - Average gwei
  - Min gwei
  - Max gwei
  - Sample count
- Notes panel
  - Current policy thresholds
  - Data freshness warning

## Data Model

Static file:

```text
data/latest.json
```

Format:

```json
{
  "generatedAt": "2026-08-06T08:45:00Z",
  "timezone": "Europe/Istanbul",
  "source": "https://rpc.l1beat.io/ext/bc/C/rpc",
  "policy": {
    "lowBelowWei": "90000000",
    "highAboveWei": "130000000",
    "stopAboveWei": "220000000"
  },
  "hours": [
    {
      "hour": "2026-08-06 01:00",
      "avgGwei": 0.62,
      "minGwei": 0.258,
      "maxGwei": 1.164,
      "samples": 720
    }
  ]
}
```

## Update Flow

1. GitHub Actions runs `scripts/fetch-l1beat-gas-report.py` hourly.
2. The script reads public Avalanche RPC data from L1Beat.
3. The workflow commits updated `data/latest.json` when values change.
4. GitHub Pages publishes the static site.

## Future

- Add 7-day heatmap.
- Add profitability threshold overlay.
