#!/usr/bin/env python3
"""Generate SSC CGL geography question bank files.

Reads each source chapter from C:\Mockaroo\geography\ and writes
Question Bank\geography\NN - <Title> — Questions.md with 12 (or 10)
@q blocks at the specified difficulty mix (4 recall / 5 apply / 3 tricky,
or 3 / 4 / 3 for narrow 10-q files).
"""

from pathlib import Path
import textwrap

ROOT = Path(r"C:\Mockaroo")
SRC = ROOT / "geography"
OUT = ROOT / "Question Bank" / "geography"

CHAPTERS = [
    ("01", "Solar System",                       "solar_system",                      12),
    ("02", "Longitude and Latitude",             "longitude_latitude",                12),
    ("03", "Earth's Interior and Plate Tectonics","earth_interior",                   12),
    ("04", "Rocks, Continents and Ocean",        "rocks_continents_ocean",            12),
    ("05", "Geomorphology and Landforms",        "geomorphology",                     12),
    ("06", "Atmosphere",                         "atmosphere",                        12),
    ("07", "Wind, Ocean Current and Cyclone",    "wind_ocean_cyclone",                12),
    ("08", "India and Its Location",             "india_location",                    12),
    ("09", "Himalayas",                          "himalayas",                         12),
    ("10", "Peninsular Plateaus",                "peninsular_plateau",                12),
    ("11", "Northern Plain and Islands",         "northern_plain_islands",            12),
    ("12", "Himalayan River System",             "himalayan_rivers",                  12),
    ("13", "Peninsular Rivers",                  "peninsular_rivers",                 12),
    ("14", "Dams, Lakes and Waterfall",          "dams_lakes_waterfall",              12),
    ("15", "Monsoon",                            "monsoon",                           12),
    ("16", "Forest and Grassland",               "forest_grassland",                  12),
    ("17", "Soil and Agriculture",               "soil_agriculture",                  12),
    ("18", "Minerals",                           "minerals",                          12),
    ("19", "World Map",                          "world_map",                         12),
    ("20", "National Parks",                     "national_parks",                    12),
]


def make_block(qid, diff, stem, options, answer, explanation, trap, see_also):
    """Return a single @q block as a string."""
    bullets = "\n".join(f"- {k}) {v}" for k, v in options)
    return (
        f"@q{qid} difficulty={diff} subject=geography chapter={ch_n}\n"
        f"{stem.strip()}\n\n"
        f"{bullets}\n"
        f"@@\n\n"
        f"<details><summary>Answer & explanation</summary>\n\n"
        f"**Answer: {answer}**\n\n"
        f"{explanation.strip()}\n\n"
        f"**Trap:** {trap.strip()}\n\n"
        f"**See also:** {see_also.strip()}\n"
        f"</details>\n\n"
        f"---\n\n"
    )


def write_file(num, title, slug, n_q, questions, see_also_extra=""):
    filename = f"{num} - {title} — Questions.md"
    path = OUT / filename
    counts = {"recall": 0, "apply": 0, "tricky": 0}
    for q in questions:
        counts[q["diff"]] += 1

    body = (
        "---\n"
        f'title: "{title} — Questions"\n'
        "subject: geography\n"
        f"chapter: {int(num)}\n"
        f"tags: [question-bank, ssc, geography, {slug.replace('_','-')}]\n"
        f"topic_id: [geography.{slug}.questions]\n"
        "---\n\n"
        f"# {title} — Questions\n\n"
        f"> Source: [[../../geography/{num} - {title}|{title}]] | Subject: [[../../_MOCs/MOC - geography]]\n\n"
        f"A {n_q}-question MCQ set on {title.lower()} — calibrated to SSC CGL Tier-I standard.\n\n"
        "Scoring: SSC CGL rules — **+2 correct, -0.50 wrong, 0 unattempted**.\n\n"
        "---\n\n"
    )

    for q in questions:
        body += make_block(
            q["id"], q["diff"], q["stem"],
            q["options"], q["answer"], q["explanation"],
            q["trap"], q["see_also"]
        )

    body += (
        "## Difficulty mix\n\n"
        "| Tier | Count | Question IDs |\n"
        "| --- | --- | --- |\n"
        f"| Recall | {counts['recall']} | {', '.join(q['id'].split('.')[-1] for q in questions if q['diff']=='recall')} |\n"
        f"| Apply | {counts['apply']} | {', '.join(q['id'].split('.')[-1] for q in questions if q['diff']=='apply')} |\n"
        f"| Tricky / two-step | {counts['tricky']} | {', '.join(q['id'].split('.')[-1] for q in questions if q['diff']=='tricky')} |\n\n"
        "## Cross-references\n\n"
        f"- Source: [[../../geography/{num} - {title}]]\n"
        "- Subject MOC: [[../../_MOCs/MOC - geography]]\n"
        "- Vault index: [[../../Index]]\n\n"
        "## See also\n\n"
        + see_also_extra
    )

    path.write_text(body, encoding="utf-8")
    print(f"Wrote {filename}  ({n_q} questions: {counts})")


# ====  This is a TEMPLATE script.  Real questions are defined in
# ====  generate_data.py and imported by the runner.

if __name__ == "__main__":
    print("This is a template — see gen_data.py for the question definitions.")
