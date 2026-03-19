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

# Agent output files for batches 1-3
agent_files = [
    '/tmp/claude-1000/-home-manuel-Documentos-github-vence/tasks/a28eec2.output',  # batch 1
    '/tmp/claude-1000/-home-manuel-Documentos-github-vence/tasks/a5fb98a.output',  # batch 2
    '/tmp/claude-1000/-home-manuel-Documentos-github-vence/tasks/a095e20.output',  # batch 3
]

all_corrections = []

for f in agent_files:
    arrays = extract_json_arrays(f)
    count = sum(len(a) for a in arrays)
    for arr in arrays:
        all_corrections.extend(arr)
    print(f"File {f.split('/')[-1]}: found {count} items", file=sys.stderr)

# Batch 4: direct JSON file
batch4_file = '/home/manuel/Documentos/github/vence/t104_batch_4_reviewed.json'
with open(batch4_file) as f:
    batch4 = json.load(f)
all_corrections.extend(batch4)
print(f"File batch_4_reviewed.json: found {len(batch4)} items", file=sys.stderr)

# Deduplicate by id
seen = set()
unique = []
for c in all_corrections:
    qid = c.get('id')
    if qid not in seen:
        seen.add(qid)
        unique.append(c)
    else:
        print(f"  Duplicate skipped: {qid}", file=sys.stderr)

all_corrections = unique
print(f"Total corrections (after dedup): {len(all_corrections)}", file=sys.stderr)

# Summary
verdicts = {}
for c in all_corrections:
    v = c.get('verdict', 'unknown')
    verdicts[v] = verdicts.get(v, 0) + 1
print(f"Verdicts: {json.dumps(verdicts)}", file=sys.stderr)

# Write consolidated file
with open('t104_corrections.json', 'w') as out:
    json.dump(all_corrections, out, indent=2, ensure_ascii=False)
print("Saved to t104_corrections.json", file=sys.stderr)
