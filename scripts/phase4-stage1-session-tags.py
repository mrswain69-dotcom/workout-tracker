from pathlib import Path

path = Path('src/engine/sessionEngine.js')
text = path.read_text(encoding='utf-8')

old_version = 'export const SESSION_SNAPSHOT_SCHEMA_VERSION = 1;'
new_version = 'export const SESSION_SNAPSHOT_SCHEMA_VERSION = 2;'
if old_version not in text:
    raise SystemExit('Expected Session snapshot schema version 1 anchor not found')
text = text.replace(old_version, new_version, 1)

anchor = '''function movementIdOf(definition) {\n  return cleanText(valueOf(definition, "movementId", "movement_id"), "");\n}\n'''
insert = '''function movementIdOf(definition) {\n  return cleanText(valueOf(definition, "movementId", "movement_id"), "");\n}\n\nfunction movementDevelopmentTagIds(library = {}, movementId = "") {\n  const target = cleanText(movementId, "");\n  if (!target) return [];\n  const relations = Array.isArray(library.movementDevelopmentTags)\n    ? library.movementDevelopmentTags\n    : Array.isArray(library.movement_development_tags)\n    ? library.movement_development_tags\n    : [];\n  return Array.from(\n    new Set(\n      relations\n        .filter(\n          (row) =>\n            cleanText(valueOf(row, "movementId", "movement_id"), "") === target\n        )\n        .map((row) =>\n          cleanText(valueOf(row, "developmentTagId", "development_tag_id"), "")\n        )\n        .filter(Boolean)\n    )\n  ).sort();\n}\n'''
if anchor not in text:
    raise SystemExit('Expected movementIdOf anchor not found')
text = text.replace(anchor, insert, 1)

movement_anchor = '''      movementId,\n      position: Math.max(1, Number(valueOf(definition, "position", "position", index + 1)) || index + 1),'''
movement_replace = '''      movementId,\n      developmentTagIds: movementDevelopmentTagIds(library, movementId),\n      position: Math.max(1, Number(valueOf(definition, "position", "position", index + 1)) || index + 1),'''
if movement_anchor not in text:
    raise SystemExit('Expected Movement snapshot anchor not found')
text = text.replace(movement_anchor, movement_replace, 1)

path.write_text(text, encoding='utf-8')
print('Patched Session snapshot schema to v2 with frozen Movement Development Tag IDs')
