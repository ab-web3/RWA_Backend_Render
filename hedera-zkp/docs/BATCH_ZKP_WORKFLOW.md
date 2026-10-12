# Batch V5 ZKP workflow

The V5 circuit currently proves the provisional rule `eligibility_label == 1`.
It does not place the CSV or personal attributes on-chain.

1. `python scripts/batch_prepare_inputs.py`
2. `node scripts/batch_prove.js`

The inputs are written to `artifacts/batch/inputs`, proofs to
`artifacts/batch/proofs`, and the pass/fail report to
`artifacts/batch/batch_summary.json`.

For the thesis, report the number of eligible rows, proofs generated, proofs
verified locally, and failures. On-chain submission should be a separate,
controlled experiment; do not submit thousands of transactions automatically.
