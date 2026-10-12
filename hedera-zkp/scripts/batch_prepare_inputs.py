"""Prepare one private-input JSON per eligible V5 investor row.

The original CSV is read-only and is never copied or modified.
"""
import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "config" / "dataset_config.json"
OUT = ROOT / "artifacts" / "batch" / "inputs"


def secret(label: str, investor_id: str) -> int:
    return int(hashlib.sha256(f"{label}:{investor_id}".encode()).hexdigest(), 16)


def main() -> None:
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    dataset = Path(config["dataset_path"])
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = []

    with dataset.open(newline="", encoding="utf-8") as handle:
        for row_number, row in enumerate(csv.DictReader(handle), start=1):
            if int(row["eligibility_label"]) != 1:
                continue
            investor_id = row["investor_id"]
            payload = {
                "eligibility_label": 1,
                "investor_secret": secret("investor", investor_id),
                "issuer_secret": secret("issuer-demo", investor_id),
                "token_id": 1001,
                "credential_expiry": 2000000000,
                "current_time": 1700000000,
            }
            name = f"row_{row_number:05d}_{investor_id}"
            (OUT / f"{name}.json").write_text(json.dumps(payload), encoding="utf-8")
            manifest.append({
                "row_number": row_number,
                "investor_id": investor_id,
                "input": f"{name}.json",
            })

    (OUT.parent / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Prepared {len(manifest)} eligible inputs")


if __name__ == "__main__":
    main()
