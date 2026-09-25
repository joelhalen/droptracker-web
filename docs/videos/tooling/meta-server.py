"""Stand-in Web API for filming in mock mode. Answers the few reads the web
app's mocks leave empty on camera: the task form's item / NPC autocomplete and
the event page's completion history, and event 1's prize pot and clan-point
payout (manager tabs), and the "What counts" answer for its five tasks.
Everything else gets a 503, so the web
app's `withFallback` serves its normal mock data.

    python3 meta-server.py meta.json          # listens on :31325

meta.json = {"items": {name: id}, "npcs": {name: id}}; build it from the
osrsbox package's items-complete.json / monsters-complete.json (see PLAN.md).
"""
import json
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

META = json.load(open(sys.argv[1] if len(sys.argv) > 1 else "meta.json"))


def search(table, q, limit=12):
    q = q.strip().lower()
    if len(q) < 2:
        return []
    hits = [(n, i) for n, i in table.items() if q in n.lower()]
    hits.sort(key=lambda h: (not h[0].lower().startswith(q), len(h[0]), h[0]))
    return [{"id": i, "name": n, "tracked": True} for n, i in hits[:limit]]


# Receipts for the mock bingo (event 1: tasks 11-15, teams 21-23), newest first.
def history(team_id=None, mode="completions"):
    now = int(time.time())
    T = {11: ("Vorkath 50 KC", "kc_target", 10), 12: ("Obtain a Twisted bow", "item_collection", 50),
         13: ("Reach 99 Slayer", "skill_target", 25), 14: ("Gain 10M Ranged XP", "xp_target", 15),
         15: ("Collect any 2 godsword hilts", "item_collection", 30)}
    teams = {21: "Team Red", 22: "Team Blue", 23: "Team Green"}
    rows = [  # (task, team, player_id, player, target, qty, points, status, age_min, progress?)
        (15, 22, 1402, "Settled", "Zamorak hilt", 1, 15, "auto", 38, False),
        (12, 21, 1337, "Zezima", "Twisted bow", 1, 50, "confirmed", 95, False),
        (11, 22, 1401, "Framed", "Vorkath", 50, 10, "auto", 180, False),
        (15, 22, 1401, "Framed", "Bandos hilt", 1, 15, "auto", 260, False),
        (15, 21, 1338, "Woox", "Armadyl hilt", 1, 0, "auto", 400, True),
        (11, 21, 1339, "B0aty", "Vorkath", 12, 0, "auto", 45, True),
        (14, 22, 1402, "Settled", "Ranged", 4250000, 0, "auto", 70, True),
    ]
    out = []
    for n, (task, team, pid, pname, target, qty, pts, status, age, prog) in enumerate(rows):
        if team_id and team != team_id:
            continue
        if mode == "completions" and prog:
            continue
        label, ttype, tpts = T[task]
        out.append({"completion_id": 900 + n, "task_id": task, "task_label": label, "task_type": ttype,
                    "task_points": tpts, "team_id": team, "team_name": teams[team], "player_id": pid,
                    "player_name": pname, "hidden": False, "matched_target": target, "quantity": qty,
                    "points": pts, "source_type": "drop" if ttype == "item_collection" else ttype.split("_")[0],
                    "status": status, "proof_url": None, "note": None, "created_at": now - age * 60})
    out.sort(key=lambda r: -r["created_at"])
    done = sum(1 for r in rows if not r[9] and (not team_id or r[1] == team_id))
    prog = sum(1 for r in rows if r[9] and (not team_id or r[1] == team_id))
    return {"event_id": 1, "kind": "bingo", "is_admin": False, "entries": out,
            "meta": {"page": 1, "limit": 50, "total": len(out), "mode": mode,
                     "completions_total": done, "progress_total": prog}}


def gp(v):
    return {"value": v, "value_formatted": f"{v / 1e6:g}M" if v >= 1e6 else f"{v:,}"}


def pot():
    now = int(time.time())
    buy = [(1337, "Zezima", 21, "buyin", 5_000_000, "paid"), (1338, "Woox", 21, "buyin", 5_000_000, "paid"),
           (1339, "B0aty", 21, "buyin", 5_000_000, "pledged"), (1401, "Framed", 22, "buyin", 5_000_000, "paid"),
           (1402, "Settled", 22, "buyin", 5_000_000, "paid"), (None, "Clan bank", None, "donation", 25_000_000, "paid")]
    rows = [{"id": 700 + i, "player_id": pid, "rsn": rsn, "team_id": t, "kind": k, "amount": gp(a), "status": st,
             "note": None, "proof_url": None, "created_at": now - 86400 * (6 - i)} for i, (pid, rsn, t, k, a, st) in enumerate(buy)]
    paid = [b for b in buy if b[5] == "paid"]
    return {"enabled": True, "total": gp(sum(b[4] for b in paid)),
            "buyin_total": gp(sum(b[4] for b in paid if b[3] == "buyin")),
            "donation_total": gp(sum(b[4] for b in paid if b[3] == "donation")),
            "config": {"default_buyin": gp(5_000_000), "distribution": "custom_split", "top_n": 2, "splits": [70, 30],
                       "advertise": True, "show_contributors": True, "allow_leader_mark": False},
            "per_team": [{"team_id": 21, "name": "Team Red", "total": gp(10_000_000), "paid_count": 2, "member_count": 3},
                         {"team_id": 22, "name": "Team Blue", "total": gp(10_000_000), "paid_count": 2, "member_count": 2},
                         {"team_id": 23, "name": "Team Green", "total": gp(0), "paid_count": 0, "member_count": 0}],
            "contributors": rows, "can_manage": True}


def clan_points():
    rows = [(1338, "Woox", 21, "Team Red", 1, 500, 170, 17.0), (1337, "Zezima", 21, "Team Red", 1, 500, 32, 3.2),
            (1401, "Framed", 22, "Team Blue", 2, 250, 40, 4.0), (1402, "Settled", 22, "Team Blue", 2, 250, 25, 2.5)]
    prow = [{"player_id": pid, "player_name": n, "team_id": t, "team_name": tn, "place": pl, "placement": pa,
             "participation": pp, "hours": h, "total": pa + pp} for pid, n, t, tn, pl, pa, pp, h in rows]
    cfg = {"enabled": True, "award_mode": "review", "placement": [500, 250, 100], "placement_active_only": True,
           "participation": {"flat": 0, "per_hour": 10, "min_hours": 1, "max": 200}}
    preview = {"total_points": sum(r["total"] for r in prow), "players": 4, "placement_points": 1500,
               "participation_points": 267, "participation_players": 4, "rows": prow,
               "skipped": [{"player_id": 1339, "player_name": "B0aty", "team_id": 21, "team_name": "Team Red", "reason": "inactive"}],
               "placements": [{"place": 1, "team_id": 21, "label": "Team Red", "amount": 500, "players": 2, "team": True},
                              {"place": 2, "team_id": 22, "label": "Team Blue", "amount": 250, "players": 2, "team": True},
                              {"place": 3, "team_id": 23, "label": "Team Green", "amount": 100, "players": 0, "team": True}],
               "competition": False, "ehe_supported": True, "rates_known": True, "roster_size": 5,
               "blocker": None, "changes": None, "out_of_sync": False}
    return {"event_id": 1, "status": "pending", "kind": "bingo",
            "scopes": [{"group_id": 101, "group_name": "Clan 101", "available": True, "can_manage": True, "config": cfg,
                        "status": "pending", "awarded_at": None, "last_error": None, "awarded": None, "preview": preview}]}


# Shaped like web_api/task_requirements.py's output for the mock tasks.
def requirements(task_id):
    it = lambda name, iid: {"name": name, "icon": {"type": "item", "id": iid, "name": name}, "required": 1}
    base = {"task_id": task_id, "kind": None, "groups": [], "paths": [], "npcs": [], "notes": []}
    return {**base, **{
        11: {"label": "Vorkath 50 KC", "type": "kc_target", "summary": "50 kills at Vorkath",
             "npcs": [{"name": "Vorkath", "icon": {"type": "npc", "id": 8060, "name": "Vorkath"}}]},
        12: {"label": "Obtain a Twisted bow", "type": "item_collection", "summary": "Obtain Twisted bow",
             "groups": [{"mode": "count", "need": 1, "items": [it("Twisted bow", 20997)]}]},
        13: {"label": "Reach 99 Slayer", "type": "skill_target", "summary": "Reach level 99 Slayer"},
        14: {"label": "Gain 10M Ranged XP", "type": "xp_target", "summary": "Gain 10,000,000 Ranged XP"},
        15: {"label": "Collect any 2 godsword hilts", "type": "item_collection",
             "summary": "Collect any 2 from these 4 items",
             "groups": [{"mode": "any_of", "need": 2, "label": "Any 2 of",
                         "items": [it("Armadyl hilt", 11810), it("Bandos hilt", 11812),
                                   it("Saradomin hilt", 11814), it("Zamorak hilt", 11816)]}]},
    }.get(task_id, {"label": None, "type": "custom", "summary": ""})}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query).get("q", [""])[0]
        if u.path.endswith("/events/meta/items"):
            return self.reply(200, search(META["items"], q))
        if u.path.endswith("/events/meta/npcs"):
            return self.reply(200, search(META["npcs"], q))
        if u.path.endswith("/events/1/completions/history"):
            qs = parse_qs(u.query)
            team = int(qs["teamId"][0]) if "teamId" in qs else None
            return self.reply(200, history(team, qs.get("mode", ["completions"])[0]))
        if u.path.startswith("/api/v1/events/1/tasks/") and u.path.endswith("/requirements"):
            return self.reply(200, requirements(int(u.path.split("/")[-2])))
        if u.path.endswith("/events/1/pot"):
            return self.reply(200, pot())
        if u.path.endswith("/events/1/clan-points"):
            return self.reply(200, clan_points())
        self.reply(503, {"error": "stand-in: not served"})

    do_POST = do_PUT = do_PATCH = do_DELETE = lambda self: self.reply(503, {"error": "stand-in"})

    def reply(self, code, body):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 31325), Handler).serve_forever()
