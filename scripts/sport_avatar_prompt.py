#!/usr/bin/env python3
"""Print one approved avatar prompt or the asset checklist; makes no image/API calls."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BRIEF = ROOT / "docs/avatar-production/paired-sport-avatar-briefs.json"


def render_prompt(data, sport_key, tier, variant):
    sport = data["sports"][sport_key]
    row = next(item for item in sport["tiers"] if item["tier"] == tier)
    award = row.get("award_variants", {}).get(variant, row["award"])
    return data["shared_prompt"].format(
        variant=variant, sport_label=sport["label"], tier_label=tier.title(),
        identity="Character identity: " + sport["identities"][variant] + ".",
        stage=data["stages"][tier],
        palette="Collection palette: " + sport["palette"] + ". This tier's outfit below determines the current colours.",
        kit=row["kit"], equipment=row.get("equipment", sport["equipment"]), award=award, pose=row["pose"],
        pose_direction=data["pose_directions"][tier],
        framing=data["framing"]["unreal" if tier == "unreal" else "default"],
    ) + "\n\nSport-specific constraints: " + sport["notes"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--brief", type=Path, default=BRIEF, help="Canonical brief JSON; defaults to the original released batch")
    preliminary, _ = parser.parse_known_args()
    brief = preliminary.brief if preliminary.brief.is_absolute() else ROOT / preliminary.brief
    data = json.loads(brief.read_text())
    parser.add_argument("--sport", choices=list(data["sports"]))
    parser.add_argument("--tier", choices=data["tier_order"])
    parser.add_argument("--variant", choices=data["variants"])
    parser.add_argument("--manifest", action="store_true")
    parser.add_argument("--out", type=Path, help="Optional text/JSON output file; never generates images")
    args = parser.parse_args()
    if args.manifest:
        content = json.dumps([
            {"sport": sport, "tier": tier, "variant": variant,
             "path": data["asset_template"].format(sport=sport, tier=tier, variant=variant)}
            for sport in data["sports"] for tier in data["tier_order"] for variant in data["variants"]
        ], indent=2)
    else:
        if not all([args.sport, args.tier, args.variant]):
            parser.error("Choose --sport, --tier and --variant, or use --manifest")
        content = render_prompt(data, args.sport, args.tier, args.variant)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(content + "\n")
    else:
        print(content)


if __name__ == "__main__":
    main()
