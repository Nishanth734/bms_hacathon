import csv
import random
import time
from pathlib import Path

def generate_nft_dataset(output_path: str = "data/NFT_WashTrading_Sample.csv", n_rows: int = 1200):
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    random.seed(42)

    base_time = 1700000000.0  # Unix timestamp
    collections = [
        "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d", # BAYC
        "0x60e4d786628fea6478f785a6d7e704777c86a7c6", # MAYC
        "0xed5af388653567af2f388e6224dc7c31414744fd", # Azuki
        "0x8a90cab2b38dba80c64b7734e58ee1db38b8992e", # Doodles
    ]

    wallets = [f"0x{random.randint(1, 0xffffffffffff):012x}" for _ in range(120)]
    rows = []

    # 1. Organic Collector Transactions (~70%)
    current_time = base_time
    for i in range(800):
        current_time += random.uniform(60, 1800)
        seller = random.choice(wallets)
        buyer = random.choice([w for w in wallets if w != seller])
        token_id = str(random.randint(100, 9999))
        collection = random.choice(collections)
        price = round(random.uniform(0.5, 12.0), 3)
        tx_hash = f"0x{random.randint(1, 0xffffffffffffffff):016x}{i:04x}"

        rows.append({
            "tx_hash": tx_hash,
            "timestamp": current_time,
            "seller_address": seller,
            "buyer_address": buyer,
            "token_id": token_id,
            "collection_address": collection,
            "price_eth": price,
            "currency": "ETH",
            "is_wash_trade": 0
        })

    # 2. Planted Ring 1: Circular Floor Pumping (Token #4421)
    ring1_wallets = ["0x1111a1pha_wash_trader_01", "0x2222beta_wash_trader_02", "0x3333gamma_wash_trader_03", "0x4444delta_wash_trader_04"]
    ring1_token = "4421"
    ring1_col = collections[0]
    ring1_time = base_time + 86400.0
    prices = [8.5, 12.0, 16.5, 22.0, 8.5] # Escalates then returns to initiator
    
    for hop in range(4):
        ring1_time += random.uniform(300, 1200) # Short dwell time (5-20 min)
        s = ring1_wallets[hop]
        b = ring1_wallets[(hop + 1) % 4]
        rows.append({
            "tx_hash": f"0xwash1_{hop}_{int(ring1_time)}",
            "timestamp": ring1_time,
            "seller_address": s,
            "buyer_address": b,
            "token_id": ring1_token,
            "collection_address": ring1_col,
            "price_eth": prices[hop],
            "currency": "ETH",
            "is_wash_trade": 1
        })

    # 3. Planted Ring 2: Marketplace Fee & Volume Farming (Token #8809)
    # A to B to C to A repeatedly
    ring2_wallets = ["0xaaaa_farmer_sybil_01", "0xbbbb_farmer_sybil_02", "0xcccc_farmer_sybil_03"]
    ring2_token = "8809"
    ring2_col = collections[1]
    ring2_time = base_time + 172800.0

    for cycle in range(5):
        for hop in range(3):
            ring2_time += random.uniform(120, 600) # Dwell 2-10 min
            s = ring2_wallets[hop]
            b = ring2_wallets[(hop + 1) % 3]
            rows.append({
                "tx_hash": f"0xfarm_{cycle}_{hop}_{int(ring2_time)}",
                "timestamp": ring2_time,
                "seller_address": s,
                "buyer_address": b,
                "token_id": ring2_token,
                "collection_address": ring2_col,
                "price_eth": 15.0, # Churning at fixed 15 ETH
                "currency": "ETH",
                "is_wash_trade": 1
            })

    # 4. Planted Ring 3: Mule Pass-Through Chain
    mule_chain = ["0xmixer_illicit_source", "0xmule_relay_1", "0xmule_relay_2", "0xmule_relay_3", "0xcex_deposit_sink"]
    mule_time = base_time + 259200.0
    for hop in range(4):
        mule_time += random.uniform(180, 900)
        s = mule_chain[hop]
        b = mule_chain[hop + 1]
        rows.append({
            "tx_hash": f"0xmule_{hop}_{int(mule_time)}",
            "timestamp": mule_time,
            "seller_address": s,
            "buyer_address": b,
            "token_id": f"77{hop}",
            "collection_address": collections[2],
            "price_eth": 25.0 - (hop * 0.2), # Small retention leak
            "currency": "ETH",
            "is_wash_trade": 1
        })

    # Sort all by timestamp
    rows.sort(key=lambda r: r["timestamp"])

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "tx_hash", "timestamp", "seller_address", "buyer_address",
            "token_id", "collection_address", "price_eth", "currency", "is_wash_trade"
        ])
        writer.writeheader()
        writer.writerows(rows)

    print(f"Generated {len(rows)} NFT transactions to {output_path}")

if __name__ == "__main__":
    generate_nft_dataset()
