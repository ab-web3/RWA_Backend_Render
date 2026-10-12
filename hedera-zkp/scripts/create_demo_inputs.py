"""Create local demo inputs for the provisional V5 eligibility circuit.

This script reads only the synthetic CSV and writes non-sensitive demo inputs
under artifacts/circuit. It does not copy the dataset or write back to it.
The current circuit intentionally proves eligibility_label == 1 as an
integration prototype; it is not the final eligibility policy.
"""

import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "config" / "dataset_config.json"
OUT = ROOT / "artifacts" / "circuit"


def scalar(value: str):
    value = value.strip()
    try:
        return int(value)
    except ValueError:
        return value


def secret(label: str, investor_id: str) -> int:
    digest = hashlib.sha256(f"{label}:{investor_id}".encode()).hexdigest()
    return int(digest, 16)


def make_input(row: dict, token_id: int, expiry: int, now: int) -> dict:
    investor_id = row["investor_id"]
    return {
        "eligibility_label": int(row["eligibility_label"]),
        "investor_secret": secret("investor", investor_id),
        "issuer_secret": secret("issuer-demo", investor_id),
        "token_id": token_id,
        "credential_expiry": expiry,
        "current_time": now,
    }


def main() -> None:
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    dataset = Path(config["dataset_path"])
    rows = list(csv.DictReader(dataset.open(newline="", encoding="utf-8")))
    eligible = next(row for row in rows if int(row["eligibility_label"]) == 1)
    ineligible = next(row for row in rows if int(row["eligibility_label"]) == 0)
    OUT.mkdir(parents=True, exist_ok=True)
    # Fixed values make the first local test reproducible.
    values = {
        "eligible": make_input(eligible, token_id=1001, expiry=2000000000, now=1700000000),
        "ineligible": make_input(ineligible, token_id=1001, expiry=2000000000, now=1700000000),
    }
    for name, payload in values.items():
        (OUT / f"input_{name}.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print("Created demo inputs in", OUT)


if __name__ == "__main__":
    main()
