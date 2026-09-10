from pathlib import Path

path = Path('src/engine/assessmentAnalysisEvidenceEngine.js')
text = path.read_text(encoding='utf-8')

old = '''        const executions = getRecordedExecutionTotal(movement);\n        const attemptTotals = getAttemptSuccessTotals(movement);\n        const bestScore = getBestScore(movement);'''
new = '''        const trackingMethod = cleanText(\n          valueOf(movement, "trackingMethod", "tracking_method", ""),\n          ""\n        );\n        const executions =\n          trackingMethod === "attempts_successes"\n            ? 0\n            : getRecordedExecutionTotal(movement);\n        const attemptTotals = getAttemptSuccessTotals(movement);\n        const bestScore = getBestScore(movement);'''

if old not in text:
    if new in text:
        print('Phase 4 execution separation already applied')
    else:
        raise SystemExit('Expected Phase 4 execution aggregation anchor not found')
else:
    text = text.replace(old, new, 1)
    path.write_text(text, encoding='utf-8')
    print('Separated attempts/successes from recorded execution totals')
