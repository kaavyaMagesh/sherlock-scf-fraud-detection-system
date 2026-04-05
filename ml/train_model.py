"""
Sherlock SCF - Supplier Risk Clustering Model
==============================================
This script:
  1. Loads supplier_profiles.csv
  2. Normalizes features with StandardScaler
  3. Runs K-Means (k=3) to cluster suppliers into risk tiers
  4. Reduces to 2D using PCA for visualization
  5. Exports clustered_results.json for the React frontend

Run once: python train_model.py
No live server needed - output JSON is loaded directly by the UI.
"""

import pandas as pd
import json
import os
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA

# ── 1. Load Data ──────────────────────────────────────────────────────────────
print("📂 Loading supplier profiles...")
script_dir = os.path.dirname(os.path.abspath(__file__))
csv_path = os.path.join(script_dir, "data", "supplier_profiles.csv")
df = pd.read_csv(csv_path)
print(f"   Loaded {len(df)} suppliers with {len(df.columns)} columns.")

# ── 2. Select & Normalize Features ───────────────────────────────────────────
print("⚖️  Normalizing features...")
feature_cols = [
    "avg_invoice_amount",
    "invoice_frequency_per_month",
    "avg_days_to_deliver",
    "num_buyers",
    "pct_invoices_disputed",
    "relationship_age_months",
    "total_volume"
]

X = df[feature_cols].values
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)
print(f"   Features scaled to zero mean, unit variance.")

# ── 3. K-Means Clustering (k=3) ───────────────────────────────────────────────
print("🤖 Running K-Means clustering (k=3)...")
kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
cluster_labels = kmeans.fit_predict(X_scaled)
df["cluster_id"] = cluster_labels
print(f"   Cluster distribution: {pd.Series(cluster_labels).value_counts().to_dict()}")

# ── 4. Map Cluster IDs to Human-Readable Labels ───────────────────────────────
# Determine which cluster is which by looking at avg dispute rate per cluster
cluster_stats = df.groupby("cluster_id")["pct_invoices_disputed"].mean()

# Sort: lowest dispute % = Trusted, mid = New Entrant, highest = High Risk
sorted_clusters = cluster_stats.sort_values().index.tolist()
cluster_map = {
    sorted_clusters[0]: {"label": "Trusted Veteran",   "color": "#22c55e", "emoji": "🟢", "risk": "Low"},
    sorted_clusters[1]: {"label": "New Entrant",        "color": "#eab308", "emoji": "🟡", "risk": "Medium"},
    sorted_clusters[2]: {"label": "High Risk Actor",    "color": "#ef4444", "emoji": "🔴", "risk": "High"},
}

df["cluster_label"] = df["cluster_id"].map(lambda cid: cluster_map[cid]["label"])
df["cluster_color"] = df["cluster_id"].map(lambda cid: cluster_map[cid]["color"])
df["cluster_risk"]  = df["cluster_id"].map(lambda cid: cluster_map[cid]["risk"])
print("   Cluster labels assigned based on dispute rate ranking.")

# ── 5. PCA — Reduce to 2D for Scatter Plot ────────────────────────────────────
print("📉 Running PCA to reduce to 2D...")
pca = PCA(n_components=2, random_state=42)
X_pca = pca.fit_transform(X_scaled)
df["pca_x"] = X_pca[:, 0].round(4)
df["pca_y"] = X_pca[:, 1].round(4)
explained = pca.explained_variance_ratio_
print(f"   PCA explains {(explained.sum()*100):.1f}% of variance ({explained[0]*100:.1f}% + {explained[1]*100:.1f}%)")

# ── 6. Compute Cluster-Level Stats for Summary Cards ─────────────────────────
print("📊 Computing cluster summary statistics...")
cluster_summary = []
for cid, meta in cluster_map.items():
    subset = df[df["cluster_id"] == cid]
    cluster_summary.append({
        "cluster_id": int(cid),
        "label": meta["label"],
        "color": meta["color"],
        "risk": meta["risk"],
        "count": int(len(subset)),
        "avg_invoice_amount": round(float(subset["avg_invoice_amount"].mean()), 0),
        "avg_dispute_rate": round(float(subset["pct_invoices_disputed"].mean()) * 100, 1),
        "avg_relationship_age": round(float(subset["relationship_age_months"].mean()), 1),
        "avg_num_buyers": round(float(subset["num_buyers"].mean()), 1),
        "total_volume": round(float(subset["total_volume"].sum()), 0),
    })

# ── 7. Build Output Records for Each Supplier ─────────────────────────────────
print("🗂️  Building supplier records...")
suppliers_output = []
for _, row in df.iterrows():
    cid = int(row["cluster_id"])
    suppliers_output.append({
        "supplier_id": row["supplier_id"],
        "supplier_name": row["supplier_name"],
        "pca_x": float(row["pca_x"]),
        "pca_y": float(row["pca_y"]),
        "cluster_id": cid,
        "cluster_label": cluster_map[cid]["label"],
        "cluster_color": cluster_map[cid]["color"],
        "cluster_risk": cluster_map[cid]["risk"],
        "features": {
            "avg_invoice_amount": int(row["avg_invoice_amount"]),
            "invoice_frequency_per_month": round(float(row["invoice_frequency_per_month"]), 1),
            "avg_days_to_deliver": int(row["avg_days_to_deliver"]),
            "num_buyers": int(row["num_buyers"]),
            "pct_invoices_disputed": round(float(row["pct_invoices_disputed"]) * 100, 1),
            "relationship_age_months": int(row["relationship_age_months"]),
            "total_volume": int(row["total_volume"]),
        }
    })

# ── 8. Export Final JSON ──────────────────────────────────────────────────────
output = {
    "metadata": {
        "model": "KMeans (k=3) + PCA",
        "features_used": feature_cols,
        "pca_variance_explained": round(float(explained.sum()) * 100, 1),
        "total_suppliers": len(df),
    },
    "cluster_summary": sorted(cluster_summary, key=lambda x: x["cluster_id"]),
    "suppliers": suppliers_output,
}

output_path = os.path.join(script_dir, "data", "clustered_results.json")
with open(output_path, "w") as f:
    json.dump(output, f, indent=2)

print(f"\n✅ Done! Results exported to: {output_path}")
print(f"   Total suppliers clustered: {len(suppliers_output)}")
for cs in cluster_summary:
    print(f"   {cs['label']:20s}: {cs['count']} suppliers | avg dispute: {cs['avg_dispute_rate']}% | avg amount: ₹{cs['avg_invoice_amount']:,.0f}")
