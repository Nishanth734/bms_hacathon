"""Generate a realistic IBM HI-Small format dataset with planted AML typologies."""
from __future__ import annotations

import csv
import random
from datetime import datetime, timedelta
from pathlib import Path

def generate_sample_data(out_path: str = "data/HI-Small_Trans.csv", num_legit: int = 5000):
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    header = [
        "Timestamp", "From Bank", "Account", "To Bank", "Account.1",
        "Amount Received", "Receiving Currency", "Amount Paid", "Payment Currency",
        "Payment Format", "Is Laundering"
    ]

    base_time = datetime(2022, 1, 1, 8, 0, 0)
    rows = []

    # 1. Background legitimate traffic
    random.seed(42)
    banks = [f"Bank_{i:02d}" for i in range(1, 15)]
    accounts = [f"ACC_{i:04d}" for i in range(1, 200)]

    for i in range(num_legit):
        t = base_time + timedelta(minutes=random.randint(0, 14 * 24 * 60))
        amt = round(random.lognormvariate(8.0, 1.2), 2)
        b_src = random.choice(banks)
        b_dst = random.choice(banks)
        a_src = random.choice(accounts)
        a_dst = random.choice(accounts)
        if b_src == b_dst and a_src == a_dst:
            continue

        rows.append({
            "Timestamp": t.strftime("%Y/%m/%d %H:%M"),
            "From Bank": b_src,
            "Account": a_src,
            "To Bank": b_dst,
            "Account.1": a_dst,
            "Amount Received": f"{amt:.2f}",
            "Receiving Currency": "USD",
            "Amount Paid": f"{amt:.2f}",
            "Payment Currency": "USD",
            "Payment Format": random.choice(["Wire", "ACH", "Cheque", "Credit Card"]),
            "Is Laundering": "0",
        })

    # 2. Planted Cycles (A -> B -> C -> A)
    for c in range(12):
        t0 = base_time + timedelta(days=c + 1, hours=random.randint(1, 10))
        b_ring = f"BankRing_{c:02d}"
        a = f"CycleA_{c}"
        b = f"CycleB_{c}"
        c_node = f"CycleC_{c}"
        amt = round(random.uniform(50000, 200000), 2)

        rows.append({
            "Timestamp": t0.strftime("%Y/%m/%d %H:%M"),
            "From Bank": b_ring, "Account": a, "To Bank": b_ring, "Account.1": b,
            "Amount Received": f"{amt:.2f}", "Receiving Currency": "USD",
            "Amount Paid": f"{amt:.2f}", "Payment Currency": "USD",
            "Payment Format": "Wire", "Is Laundering": "1"
        })
        rows.append({
            "Timestamp": (t0 + timedelta(hours=1, minutes=15)).strftime("%Y/%m/%d %H:%M"),
            "From Bank": b_ring, "Account": b, "To Bank": b_ring, "Account.1": c_node,
            "Amount Received": f"{amt * 0.98:.2f}", "Receiving Currency": "USD",
            "Amount Paid": f"{amt * 0.98:.2f}", "Payment Currency": "USD",
            "Payment Format": "Wire", "Is Laundering": "1"
        })
        rows.append({
            "Timestamp": (t0 + timedelta(hours=2, minutes=45)).strftime("%Y/%m/%d %H:%M"),
            "From Bank": b_ring, "Account": c_node, "To Bank": b_ring, "Account.1": a,
            "Amount Received": f"{amt * 0.96:.2f}", "Receiving Currency": "USD",
            "Amount Paid": f"{amt * 0.96:.2f}", "Payment Currency": "USD",
            "Payment Format": "Wire", "Is Laundering": "1"
        })

    # 3. Planted Fan-Out dispersion (Smurfing / Structuring)
    for f_idx in range(10):
        t0 = base_time + timedelta(days=f_idx + 2, hours=random.randint(6, 12))
        src_bank = f"BankFanOut_{f_idx}"
        src_acc = f"SmurfBoss_{f_idx}"
        for d in range(6):
            rows.append({
                "Timestamp": (t0 + timedelta(minutes=d * 35)).strftime("%Y/%m/%d %H:%M"),
                "From Bank": src_bank, "Account": src_acc,
                "To Bank": f"BankRecv_{f_idx}", "Account.1": f"Mule_{d}",
                "Amount Received": "9500.00", "Receiving Currency": "USD",
                "Amount Paid": "9500.00", "Payment Currency": "USD",
                "Payment Format": "Wire", "Is Laundering": "1"
            })

    # 4. Planted Pass-Through (Mule Chains)
    for p in range(10):
        t0 = base_time + timedelta(days=p + 3, hours=random.randint(8, 14))
        mules = [f"MuleNode_{p}_{k}" for k in range(5)]
        amt = 85000.0
        for k in range(4):
            t_hop = t0 + timedelta(minutes=k * 25)
            rows.append({
                "Timestamp": t_hop.strftime("%Y/%m/%d %H:%M"),
                "From Bank": f"BankMule_{p}", "Account": mules[k],
                "To Bank": f"BankMule_{p}", "Account.1": mules[k+1],
                "Amount Received": f"{amt * (0.97**k):.2f}", "Receiving Currency": "USD",
                "Amount Paid": f"{amt * (0.97**k):.2f}", "Payment Currency": "USD",
                "Payment Format": "Wire", "Is Laundering": "1"
            })

    # Sort strictly by timestamp
    rows.sort(key=lambda r: datetime.strptime(r["Timestamp"], "%Y/%m/%d %H:%M"))

    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=header)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Generated {len(rows)} realistic transactions with ground truth typologies at {out_path}")

if __name__ == "__main__":
    generate_sample_data()
