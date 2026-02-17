import os
import json
import requests
from datetime import datetime, timezone

def must_env(name: str) -> str:
    v = os.getenv(name)
    if not v:
        raise SystemExit(f"Missing env var: {name}")
    return v

def get(d: dict, key: str, default=None):
    return d.get(key, default)

def main():
    base_url = must_env("KOBO_BASE_URL").rstrip("/")
    asset_uid = must_env("KOBO_ASSET_UID")
    token = must_env("KOBO_TOKEN")

    url = f"{base_url}/api/v2/assets/{asset_uid}/data.json"
    headers = {"Authorization": f"Token {token}"}

    r = requests.get(url, headers=headers, timeout=60)
    r.raise_for_status()
    payload = r.json()

    rows = []
    for sub in payload.get("results", []):
        base = {
            "date": get(sub, "grp_main/date_jour"),
            "bureau": get(sub, "grp_main/bureau"),
            "agent_id": get(sub, "grp_main/agent_id"),
            "agent": get(sub, "grp_main/agent"),
            "submission_time": get(sub, "_submission_time"),
            "_id": get(sub, "_id"),
            "_uuid": get(sub, "_uuid"),
            "_status": get(sub, "_status"),
        }

        repeats = sub.get("grp_main/rep_taches", []) or []
        if not repeats:
            # au cas où une soumission n'a pas de repeat, on garde une ligne minimale
            rows.append({
                **base,
                "tache": None,
                "lien_activite": None,
                "code_activite": None,
                "resultat": None,
                "commentaire": None,
                "task_timestamp": None,
            })
            continue

        for t in repeats:
            rows.append({
                **base,
                "tache": get(t, "grp_main/rep_taches/tache"),
                "lien_activite": get(t, "grp_main/rep_taches/lien_activite"),
                "code_activite": get(t, "grp_main/rep_taches/code_activite"),
                "resultat": get(t, "grp_main/rep_taches/resultat"),
                "commentaire": get(t, "grp_main/rep_taches/commentaire"),
                "task_timestamp": get(t, "grp_main/rep_taches/timestamp"),
            })

    # Tri simple: date desc puis bureau puis agent
    def sort_key(x):
        return (x.get("date") or "", x.get("bureau") or "", x.get("agent") or "")

    rows.sort(key=sort_key, reverse=True)

    # Ecrit data.json (consommé par app.js)
    with open("data.json", "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)

    # Petit log utile actions
    refreshed = datetime.now(timezone.utc).isoformat()
    print(f"Refreshed at {refreshed}. Rows={len(rows)} from submissions={payload.get('count')}")

if __name__ == "__main__":
    main()
