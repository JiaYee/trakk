#!/usr/bin/env python3
"""Convert commit-effort-estimates.md into trakk monthly log files."""

import re
from pathlib import Path

SRC = Path(r"C:\Users\Tai\katyworld\fos-system-mobile\commit-effort-estimates.md")
OUT_DIR = Path(__file__).resolve().parent.parent / "docs" / "projects" / "fos-system-mobile"

MONTH_NAMES = {
    "01": "January",
    "02": "February",
    "03": "March",
    "04": "April",
    "05": "May",
    "06": "June",
    "07": "July",
    "08": "August",
    "09": "September",
    "10": "October",
    "11": "November",
    "12": "December",
}


def month_label(ym: str) -> str:
    year, month = ym.split("-")
    return f"{MONTH_NAMES[month]} {year}"


def main() -> None:
    text = SRC.read_text(encoding="utf-8-sig")
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    summary_match = re.search(
        r"## Monthly Summary\n\n\| Month.*?\n\|[-| :]+\|\n(.*?)\n\n---",
        text,
        re.DOTALL,
    )
    summary_rows: list[tuple[str, str, str]] = []
    if summary_match:
        for line in summary_match.group(1).strip().split("\n"):
            if line.startswith("| **Total**"):
                continue
            match = re.match(r"\| (\d{4}-\d{2}) \| (\d+) \| ([\d.]+) \|", line)
            if match:
                summary_rows.append(match.groups())

    month_pattern = re.compile(
        r"^## (\d{4}-\d{2}) \((\d+) commits?, ([\d.]+)h\)\s*$", re.MULTILINE
    )
    sections = list(month_pattern.finditer(text))
    commits_by_month: dict[str, dict] = {}

    for index, match in enumerate(sections):
        ym = match.group(1)
        commit_count = match.group(2)
        total_hours = match.group(3)
        start = match.end()
        end = sections[index + 1].start() if index + 1 < len(sections) else len(text)
        body = text[start:end].strip()

        if "_No commits._" in body:
            commits_by_month[ym] = {
                "commits": [],
                "total": total_hours,
                "count": commit_count,
            }
            continue

        commits: list[tuple[str, str, str]] = []
        for line in body.split("\n"):
            if not line.startswith("| `"):
                continue
            parts = [part.strip() for part in line.split("|")]
            if len(parts) < 7 or parts[1].startswith("Hash"):
                continue
            short_hash = parts[1].strip("`")
            dt = parts[3]
            hours = parts[4]
            desc = parts[5].lstrip("\ufeff")
            date = dt.split()[0]
            task = f"{desc} (`{short_hash}`)"
            commits.append((date, task, hours))

        commits_by_month[ym] = {
            "commits": commits,
            "total": total_hours,
            "count": commit_count,
        }

    for ym, data in sorted(commits_by_month.items()):
        label = month_label(ym)
        lines = [f"# FOS System Mobile — {label}", ""]
        if not data["commits"]:
            lines.append("_No commits._")
            lines.append("")
        else:
            lines.append("| Date | Task | Hours |")
            lines.append("| ---- | ---- | ----- |")
            for date, task, hours in data["commits"]:
                task = task.replace("|", "\\|")
                lines.append(f"| {date} | {task} | {hours} |")
            lines.append("")
        lines.append(f"**Total Hours:** {data['total']}")
        lines.append("")
        (OUT_DIR / f"{ym}.md").write_text("\n".join(lines), encoding="utf-8")

    index_lines = [
        "# FOS System Mobile",
        "",
        "## Overview",
        "",
        "Mobile-first remittance and member management platform for FOS International — user dashboard, admin panel, agent portal, localization, and payment workflows.",
        "",
        "Branch: `develop` | Source: `.git/logs/refs/heads/develop` | Timezone: +0800",
        "",
        "> Estimates are developer hours (design + implementation + basic testing).",
        "> Treat totals as approximate (+/-20%). Version bumps = 0.25h; scope inferred from commit messages.",
        "",
        "## Monthly Summary",
        "",
        "| Month | Commits | Est. Hours |",
        "|-------|--------:|-----------:|",
    ]
    for ym, commits, hours in summary_rows:
        index_lines.append(f"| {ym} | {commits} | {hours} |")
    index_lines.append("| **Total** | **233** | **558.00** |")
    index_lines.append("")
    index_lines.append("## Monthly Logs")
    index_lines.append("")
    index_lines.append("| Month | Log |")
    index_lines.append("| ----- | --- |")
    for ym in sorted(commits_by_month.keys()):
        index_lines.append(f"| {month_label(ym)} | [{ym}]({ym}.md) |")
    index_lines.append("")

    (OUT_DIR / "index.md").write_text("\n".join(index_lines), encoding="utf-8")
    print(f"Created {len(commits_by_month)} monthly files + index in {OUT_DIR}")


if __name__ == "__main__":
    main()
