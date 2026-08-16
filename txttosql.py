from pathlib import Path
import re

RULE_RE = re.compile(r"^([12]{16})(?:\s*-\s*.*)?$")

rules_file = Path("rules.txt")
output_file = Path("import_rules.sql")

if not rules_file.exists():
    raise SystemExit("ERROR: rules.txt was not found.")

rules = []
seen = set()

for line_number, raw in enumerate(
    rules_file.read_text(encoding="utf-8").splitlines(),
    start=1
):
    line = raw.strip()

    if not line or line.startswith("#"):
        continue

    match = RULE_RE.fullmatch(line)

    if not match:
        raise SystemExit(
            f"ERROR: Invalid rule on line {line_number}: {raw!r}"
        )

    rule = match.group(1)

    if rule not in seen:
        rules.append(rule)
        seen.add(rule)

if not rules:
    raise SystemExit("ERROR: No rules were found.")

print(f"Found {len(rules):,} unique rules.")

sql_lines = [
    "-- Generated automatically from rules.txt",
    "-- Do not edit manually.",
    "",
    "insert into public.rules (rule)",
    "values",
]

values = []

for rule in rules:
    values.append(f"  ('{rule}')")

sql_lines.append(",\n".join(values))
sql_lines.append(
    "on conflict (rule) do nothing;"
)

output_file.write_text(
    "\n".join(sql_lines) + "\n",
    encoding="utf-8"
)

print(f"Created: {output_file}")