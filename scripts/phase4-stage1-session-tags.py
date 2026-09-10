from pathlib import Path

path = Path('src/engine/assessmentAnalysisEvidenceEngine.test.js')
text = path.read_text(encoding='utf-8')

bad = 'movement({ id: "receive-2", name: "Receive 2", resultData: { overall: { count: 30 } }),'
good = 'movement({ id: "receive-2", name: "Receive 2", resultData: { overall: { count: 30 } } }),' 

if bad not in text:
    if good in text:
        print('Evidence test syntax already corrected')
    else:
        raise SystemExit('Expected evidence test syntax anchor not found')
else:
    text = text.replace(bad, good, 1)
    path.write_text(text, encoding='utf-8')
    print('Corrected Stage 1 evidence test syntax')
