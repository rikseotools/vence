#!/usr/bin/env bash
# ¿Baraja producción para esta oposición? Se pide el MISMO tema dos veces y se mira si el serve
# adjunta `option_order` (la permutación aplicada). null en todas = orden natural.
PT="$1"
for i in 1 2; do
  curl -s -X POST "https://www.vence.es/api/questions/filtered" \
    -H 'Content-Type: application/json' -H 'User-Agent: Mozilla/5.0 Chrome/126' \
    -d "{\"positionType\":\"$PT\",\"topicNumber\":1,\"numQuestions\":15,\"shuffleOptions\":true}" \
  | python3 -c "
import sys,json
try: d=json.load(sys.stdin)
except Exception: print('   respuesta no-JSON'); sys.exit()
qs = d.get('questions') or d.get('data') or []
if not qs: print('   sin preguntas:', str(d)[:120]); sys.exit()
con = [q for q in qs if q.get('option_order')]
print(f'   intento: {len(qs)} preguntas · con option_order: {len(con)}')
"
done
