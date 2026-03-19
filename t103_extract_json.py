import json
import re
import sys

def extract_json_arrays(filepath):
    arrays = []
    with open(filepath) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except:
                continue
            if entry.get('type') != 'assistant':
                continue
            msg = entry.get('message', {})
            content = msg.get('content', [])
            for block in content:
                if block.get('type') == 'text':
                    text = block['text']
                    # Find ```json blocks
                    json_blocks = re.findall(r'```json\s*\n(.*?)```', text, re.DOTALL)
                    for jb in json_blocks:
                        try:
                            parsed = json.loads(jb)
                            if isinstance(parsed, list) and len(parsed) > 0:
                                arrays.append(parsed)
                        except:
                            pass
    return arrays

files = [
    '/tmp/claude-1000/-home-manuel-Documentos-github-vence/tasks/aaf984c.output',
    '/tmp/claude-1000/-home-manuel-Documentos-github-vence/tasks/a6d7470.output',
    '/tmp/claude-1000/-home-manuel-Documentos-github-vence/tasks/a1db0e6.output',
    '/tmp/claude-1000/-home-manuel-Documentos-github-vence/tasks/aa0535a.output',
]

all_corrections = []
for f in files:
    arrays = extract_json_arrays(f)
    for arr in arrays:
        all_corrections.extend(arr)
    print(f"File {f.split('/')[-1]}: found {sum(len(a) for a in arrays)} items", file=sys.stderr)

print(f"Total corrections: {len(all_corrections)}", file=sys.stderr)

# Summary
verdicts = {}
for c in all_corrections:
    v = c.get('verdict', 'unknown')
    verdicts[v] = verdicts.get(v, 0) + 1
print(f"Verdicts: {json.dumps(verdicts)}", file=sys.stderr)

# Write consolidated file
with open('t103_corrections.json', 'w') as out:
    json.dump(all_corrections, out, indent=2, ensure_ascii=False)
print("Saved to t103_corrections.json", file=sys.stderr)
