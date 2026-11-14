"""Synthetic AML pattern injector for ground truth validation."""
from __future__ import annotations

import argparse
import csv
from datetime import datetime, timedelta
import random

def inject(csv_path: str, out_path: str, n_cycles: int = 5, n_fanouts: int = 5, n_passthrough: int = 5):
    # Read existing rows or create new base
    rows = []
    header = [
        "Timestamp", "From Bank", "Account", "To Bank", "Account.1",
        "Amount Received", "Receiving Currency", "Amount Paid", "Payment Currency",
        "Payment Format", "Is Laundering"
    ]
    try:
        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
    except Exception:
        pass

    base_time = datetime(2022, 1, 1, 10, 0, 0)
    injected_rows = []

    # 1. Planted Cycles: A -> B -> C -> A
    for c in range(n_cycles):
        t0 = base_time + timedelta(days=c * 2)
        bank_a, acc_a = f"BankCycle{c}", "100"
        bank_b, acc_b = f"BankCycle{c}", "200"
        bank_c, acc_c = f"BankCycle{c}", "300"
        amt = 250000.0 + c * 1000

        # Hop 1: A -> B
        injected_rows.append({
            "Timestamp": (t0 + timedelta(hours=1)).strftime("%Y/%m/%d %H:%M"),
            "From Bank": bank_a, "Account": acc_a, "To Bank": bank_b, "Account.1": acc_b,
            "Amount Received": f"{amt}", "Receiving Currency": "USD",
            "Amount Paid": f"{amt}", "Payment Currency": "USD",
            "Payment Format": "Wire", "Is Laundering": "1"
        })
        # Hop 2: B -> C
        injected_rows.append({
            "Timestamp": (t0 + timedelta(hours=3)).strftime("%Y/%m/%d %H:%M"),
            "From Bank": bank_b, "Account": acc_b, "To Bank": bank_c, "Account.1": acc_c,
            "Amount Received": f"{amt * 0.98:.2f}", "Receiving Currency": "USD",
            "Amount Paid": f"{amt * 0.98:.2f}", "Payment Currency": "USD",
            "Payment Format": "Wire", "Is Laundering": "1"
        })
        # Hop 3: C -> A
        injected_rows.append({
            "Timestamp": (t0 + timedelta(hours=5)).strftime("%Y/%m/%d %H:%M"),
            "From Bank": bank_c, "Account": acc_c, "To Bank": bank_a, "Account.1": acc_a,
            "Amount Received": f"{amt * 0.95:.2f}", "Receiving Currency": "USD",
            "Amount Paid": f"{amt * 0.95:.2f}", "Payment Currency": "USD",
            "Payment Format": "Wire", "Is Laundering": "1"
        })

    # 2. Planted Fan-Out: 1 source -> 6 destinations within 10 hours
    for f_idx in range(n_fanouts):
        t0 = base_time + timedelta(days=20 + f_idx * 3)
        src_bank, src_acc = f"BankFan{f_idx}", "Master"
        for d in range(6):
            injected_rows.append({
                "Timestamp": (t0 + timedelta(hours=d)).strftime("%Y/%m/%d %H:%M"),
                "From Bank": src_bank, "Account": src_acc,
                "To Bank": f"BankFan{f_idx}", "Account.1": f"Dest{d}",
                "Amount Received": "50000.00", "Receiving Currency": "USD",
                "Amount Paid": "50000.00", "Payment Currency": "USD",
                "Payment Format": "Wire", "Is Laundering": "1"
            })

    # 3. Planted Pass-Through chains: 4 hops with 30 min dwell
    for p in range(n_passthrough):
        t0 = base_time + timedelta(days=40 + p * 3)
        hops = [f"Mule{p}_{i}" for i in range(5)]
        amt = 150000.0
        for i in range(4):
            t_hop = t0 + timedelta(minutes=i * 40)
            injected_rows.append({
                "Timestamp": t_hop.strftime("%Y/%m/%d %H:%M"),
                "From Bank": f"BankPass{p}", "Account": hops[i],
                "To Bank": f"BankPass{p}", "Account.1": hops[i+1],
                "Amount Received": f"{amt * (0.97**i):.2f}", "Receiving Currency": "USD",
                "Amount Paid": f"{amt * (0.97**i):.2f}", "Payment Currency": "USD",
                "Payment Format": "Wire", "Is Laundering": "1"
            })

    all_rows = rows + injected_rows
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=header)
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"Injected {len(injected_rows)} suspicious transactions into {out_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", default="data/HI-Small_Trans.csv")
    parser.add_argument("--out", default="data/HI-Small_Injected.csv")
    args = parser.parse_args()
    inject(args.csv, args.out)
