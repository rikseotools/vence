#!/usr/bin/env bash
# La capa que falta es Redis (`topic_data:…`, ventana de frescura de 5 min) y no se puede
# invalidar desde fuera de la VPC: ElastiCache es interno y no hay tag para esa clave.
# Así que se espera a que caduque sola, comprobando contra PRODUCCIÓN.
cd /home/manuel/vence-sessions/movil3 || exit 1
set -a; . ./.env.local; set +a

for i in $(seq 1 12); do
  n=$(curl -sS "https://www.vence.es/api/topics/7?oposicion=auxiliar-administrativo-canarias" \
        | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);console.log(j.totalQuestions??j.total_questions??j.questionCount??JSON.stringify(j).slice(0,80))}catch{console.log('?')}})")
  echo "intento $i · producción sirve: $n"
  [ "$n" = "45" ] && { echo "✅ propagado"; exit 0; }
  sleep 45
done
echo "⏳ sin propagar tras 9 minutos"
exit 1
