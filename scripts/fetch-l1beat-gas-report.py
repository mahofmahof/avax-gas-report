#!/usr/bin/env python3
import datetime as dt
import json
import os
import subprocess
import sys

RPC = os.environ.get("AVAX_RPC_URL", "https://rpc.l1beat.io/ext/bc/C/rpc")
TIMEZONE = os.environ.get("REPORT_TIMEZONE", "Europe/Istanbul")

try:
    from zoneinfo import ZoneInfo
except ImportError:
    ZoneInfo = None


def local_tz():
    if ZoneInfo:
        try:
            return ZoneInfo(TIMEZONE)
        except Exception:
            pass
    return dt.timezone(dt.timedelta(hours=3))


def rpc(method, params):
    payload = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params})
    out = curl_json(payload)
    data = json.loads(out)
    if "error" in data:
        raise RuntimeError(data["error"])
    return data["result"]


def curl_json(payload):
    out = subprocess.check_output(
        [
            "curl",
            "-sS",
            "--retry",
            "3",
            "--retry-delay",
            "2",
            "--max-time",
            "30",
            "-H",
            "content-type: application/json",
            "--data",
            payload,
            RPC,
        ],
        text=True,
    )
    return out


def rpc_batch(calls):
    payload = json.dumps([
        {"jsonrpc": "2.0", "id": i, "method": method, "params": params}
        for i, (method, params) in enumerate(calls)
    ])
    data = json.loads(curl_json(payload))
    by_id = {item["id"]: item for item in data}
    result = []
    for i in range(len(calls)):
        item = by_id[i]
        if "error" in item:
            raise RuntimeError(item["error"])
        result.append(item["result"])
    return result


def block(number):
    return rpc("eth_getBlockByNumber", [hex(number), False])


def block_timestamp(number):
    return int(block(number)["timestamp"], 16)


def find_start_block(latest, target_ts):
    lo = max(0, latest - 120_000)
    hi = latest
    while lo < hi:
        mid = (lo + hi) // 2
        if block_timestamp(mid) < target_ts:
            lo = mid + 1
        else:
            hi = mid
    return lo


def main():
    tz = local_tz()
    latest = int(rpc("eth_blockNumber", []), 16)
    latest_ts = block_timestamp(latest)
    target_ts = latest_ts - 24 * 60 * 60
    start = find_start_block(latest, target_ts)

    buckets = {}
    counts = {}
    mins = {}
    maxs = {}

    # L1Beat currently answers old eth_getBlockByNumber calls, but eth_feeHistory
    # can reject ranges near 24h with "request beyond historical limit".
    # Sample roughly one block per minute; good enough for hourly averages and
    # stable for GitHub Actions.
    step = max(1, (latest - start) // (24 * 60))
    sample_blocks = list(range(start, latest + 1, step))
    if sample_blocks[-1] != latest:
        sample_blocks.append(latest)

    batch_size = int(os.environ.get("RPC_BATCH_SIZE", "100"))
    for offset in range(0, len(sample_blocks), batch_size):
        batch = sample_blocks[offset:offset + batch_size]
        calls = [("eth_getBlockByNumber", [hex(number), False]) for number in batch]
        for item in rpc_batch(calls):
            ts = int(item["timestamp"], 16)
            fee = int(item.get("baseFeePerGas", "0x0"), 16)
            if target_ts <= ts <= latest_ts:
                hour = dt.datetime.fromtimestamp(ts, tz).strftime("%Y-%m-%d %H:00")
                gwei = fee / 1_000_000_000
                buckets[hour] = buckets.get(hour, 0.0) + gwei
                counts[hour] = counts.get(hour, 0) + 1
                mins[hour] = gwei if hour not in mins else min(mins[hour], gwei)
                maxs[hour] = gwei if hour not in maxs else max(maxs[hour], gwei)

    hours = []
    for hour in sorted(buckets):
        hours.append(
            {
                "hour": hour,
                "avgGwei": round(buckets[hour] / counts[hour], 6),
                "minGwei": round(mins[hour], 6),
                "maxGwei": round(maxs[hour], 6),
                "samples": counts[hour],
            }
        )

    report = {
        "generatedAt": dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "timezone": TIMEZONE,
        "source": RPC,
        "latestBlock": latest,
        "sampleStepBlocks": step,
        "sampleCount": len(sample_blocks),
        "policy": {
            "lowBelowWei": "90000000",
            "highAboveWei": "130000000",
            "stopAboveWei": "220000000",
        },
        "hours": hours,
    }
    json.dump(report, sys.stdout, indent=2)
    print()


if __name__ == "__main__":
    main()
