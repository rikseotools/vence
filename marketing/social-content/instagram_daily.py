#!/usr/bin/env python3
"""
Pregunta del día → Instagram (@vence.es). Job diario.

Flujo: elige una pregunta fiable de la BD → genera imagen 1080x1080 →
sube a S3 (bucket público) → publica en Instagram vía Graph API →
registra en `instagram_posts` (anti-repetición).

Pensado para correr en GitHub Actions (1/día). Variables de entorno:
  DATABASE_URL                  (Postgres)
  META_ADS_ACCESS_TOKEN         (token System User con instagram_content_publish)
  META_IG_USER_ID               (id de la cuenta IG, ej. 17841460897412178)
  AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
  AWS_S3_REGION  (def: eu-west-2)   AWS_S3_BUCKET (def: vence-uploads)
  DRY_RUN=1  → elige pregunta y genera imagen, pero NO sube ni publica.

Criterios de pregunta (lo pedido por Manuel):
  fácil + ya respondida (≥40) + fiable (≥80% acierto) + SIN impugnaciones +
  activa (lifecycle approved/tech_approved) + leyes transversales (CE/EBEP/39/40) +
  no publicada antes.
"""
import os, sys, io, time, datetime, random
import psycopg2
import psycopg2.extras
import boto3
import requests
from PIL import Image, ImageDraw, ImageFont, ImageFilter

GRAPH = "https://graph.facebook.com/v21.0"
LAWS = ("constitucion-espanola", "rdl-5-2015", "ley-39-2015", "ley-40-2015")
FONT_DIR = "/usr/share/fonts"
# rutas de fuentes (GitHub Actions ubuntu trae DejaVu; instalamos Open Sans en el workflow)
def _font_path(*cands):
    for c in cands:
        if os.path.exists(c):
            return c
    return None
FB = _font_path(f"{FONT_DIR}/open-sans/OpenSans-Bold.ttf", f"{FONT_DIR}/truetype/dejavu/DejaVuSans-Bold.ttf")
FX = _font_path(f"{FONT_DIR}/open-sans/OpenSans-ExtraBold.ttf", FB)
FS = _font_path(f"{FONT_DIR}/open-sans/OpenSans-Semibold.ttf", FB)

NAVY = (8, 21, 56); BLUE = (20, 86, 160); GREEN = (46, 213, 115)
WHITE = (255, 255, 255); LIGHT = (176, 205, 236)
W = H = 1080


# ---------- selección de pregunta ----------
def pick_question(conn):
    sql = """
      SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
             q.correct_option, a.article_number, l.short_name, l.slug,
             q.difficulty_sample_size, q.first_attempts_correct_sum
      FROM questions q
      JOIN articles a ON a.id = q.primary_article_id
      JOIN laws l ON l.id = a.law_id
      WHERE q.lifecycle_state IN ('approved','tech_approved')
        AND l.slug = ANY(%s)
        AND q.difficulty_sample_size >= 40
        AND q.option_a IS NOT NULL AND q.option_b IS NOT NULL
        AND q.option_c IS NOT NULL AND q.option_d IS NOT NULL
        AND q.option_e IS NULL
        AND q.correct_option BETWEEN 0 AND 3
        AND length(q.question_text) <= 160
        AND (q.first_attempts_correct_sum::float / NULLIF(q.difficulty_sample_size,0)) >= 0.80
        AND NOT EXISTS (SELECT 1 FROM instagram_posts ip WHERE ip.question_id = q.id)
        AND NOT EXISTS (SELECT 1 FROM question_disputes qd WHERE qd.question_id = q.id)
      ORDER BY (q.first_attempts_correct_sum::float / q.difficulty_sample_size) DESC,
               q.difficulty_sample_size DESC
      LIMIT 60;
    """
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, (list(LAWS),))
        rows = cur.fetchall()
    if not rows:
        raise SystemExit("No hay preguntas candidatas (¿agotadas? revisar criterios).")
    # variedad: aleatoria entre las mejores, sesgando a las más fáciles (primeras)
    pool = rows[:40]
    return random.choice(pool)


# ---------- imagen ----------
def _font(sz, path): return ImageFont.truetype(path, sz)

def _wrap(d, txt, fnt, maxw):
    words, lines, cur = txt.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if d.textbbox((0, 0), t, font=fnt)[2] <= maxw:
            cur = t
        else:
            lines.append(cur); cur = w
    if cur:
        lines.append(cur)
    return lines

def render(q):
    img = Image.new("RGB", (W, H), NAVY); px = img.load()
    top, bot = (7, 18, 50), (17, 72, 140)
    for y in range(H):
        t = y / H
        row = (int(top[0]*(1-t)+bot[0]*t), int(top[1]*(1-t)+bot[1]*t), int(top[2]*(1-t)+bot[2]*t))
        for x in range(W):
            px[x, y] = row
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse([W//2-460, 120, W//2+460, 1040], fill=60)
    glow = glow.filter(ImageFilter.GaussianBlur(180))
    img = Image.composite(Image.new("RGB", (W, H), (40, 120, 200)), img, glow)
    d = ImageDraw.Draw(img)

    def ctext(y, txt, fnt, fill):
        b = d.textbbox((0, 0), txt, font=fnt); w = b[2]-b[0]
        d.text(((W-w)//2, y-b[1]), txt, font=fnt, fill=fill)

    # badge
    badge = "PREGUNTA DEL DÍA"; bf = _font(34, FX); bb = d.textbbox((0, 0), badge, font=bf)
    bw, bh = bb[2]-bb[0], bb[3]-bb[1]; bx = (W-bw-64)//2
    d.rounded_rectangle([bx, 56, bx+bw+64, 56+bh+38], radius=34, fill=GREEN)
    d.text((bx+32, 56+19-bb[1]), badge, font=bf, fill=NAVY)
    # ley + art
    ley = q["short_name"] or "Ley"
    ctext(150, f"{ley} · Art. {q['article_number']}", _font(34, FS), LIGHT)

    # pregunta (font adaptable)
    qtext = q["question_text"].strip()
    qsize = 46
    while qsize >= 34:
        qf = _font(qsize, FB); lines = _wrap(d, qtext, qf, 920)
        if len(lines) <= 4:
            break
        qsize -= 4
    y = 235
    for ln in lines:
        ctext(y, ln, qf, WHITE); y += qsize + 14

    # opciones
    opts = [("A", q["option_a"]), ("B", q["option_b"]), ("C", q["option_c"]), ("D", q["option_d"])]
    of, lf = _font(38, FS), _font(40, FX); oy = y + 36
    for letter, txt in opts:
        d.rounded_rectangle([110, oy, 970, oy+92], radius=22, fill=WHITE)
        d.ellipse([135, oy+20, 187, oy+72], fill=BLUE)
        lb = d.textbbox((0, 0), letter, font=lf)
        d.text((161-(lb[2]-lb[0])//2, oy+46-(lb[3]-lb[1])//2-lb[1]), letter, font=lf, fill=WHITE)
        # recortar opción larga
        ot = txt.strip()
        while d.textbbox((0, 0), ot, font=of)[2] > 720 and len(ot) > 8:
            ot = ot[:-2]
        if ot != txt.strip():
            ot = ot.rstrip() + "…"
        tb = d.textbbox((0, 0), ot, font=of)
        d.text((215, oy+46-(tb[3]-tb[1])//2-tb[1]), ot, font=of, fill=NAVY)
        oy += 112

    ctext(oy + 20, "¿Sabes la respuesta?  Practica gratis en vence.es", _font(34, FS), GREEN)
    # wordmark esquina
    wf = _font(30, FX); d.text((W-150, 50), "VENCE", font=wf, fill=WHITE)

    buf = io.BytesIO(); img.save(buf, format="JPEG", quality=92); buf.seek(0)
    return buf


# ---------- caption ----------
def build_caption(q):
    letter = ["A", "B", "C", "D"][q["correct_option"]]
    correct_txt = [q["option_a"], q["option_b"], q["option_c"], q["option_d"]][q["correct_option"]]
    ley = q["short_name"] or "Ley"
    tags = {
        "constitucion-espanola": "#constituciónespañola",
        "rdl-5-2015": "#ebep #empleadopúblico",
        "ley-39-2015": "#ley392015 #procedimientoadministrativo",
        "ley-40-2015": "#ley402015 #sectorpúblico",
    }.get(q["slug"], "")
    return (
        f"📚 PREGUNTA DEL DÍA — {ley}\n\n"
        f"{q['question_text'].strip()} 🤔\n\n"
        f"A) {q['option_a']}\nB) {q['option_b']}\nC) {q['option_c']}\nD) {q['option_d']}\n\n"
        f"👉 ¿Cuál crees que es? Déjalo en comentarios 👇\n\n"
        f"✅ Respuesta: {letter}) {correct_txt} ({ley} art. {q['article_number']})\n\n"
        f"Practica miles de preguntas de oposiciones GRATIS en vence.es 🔗 (link en la bio)\n\n"
        f"#oposiciones #oposicion2026 #auxiliaradministrativo #funcionario "
        f"#estudiaroposiciones {tags} #vence"
    )


# ---------- S3 ----------
def upload_s3(buf):
    region = os.environ.get("AWS_S3_REGION", "eu-west-2")
    bucket = os.environ.get("AWS_S3_BUCKET", "vence-uploads")
    key = "social/pregunta-dia-" + datetime.datetime.utcnow().strftime("%Y%m%d-%H%M%S") + ".jpg"
    boto3.client("s3", region_name=region).put_object(
        Bucket=bucket, Key=key, Body=buf.getvalue(), ContentType="image/jpeg"
    )
    return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"


# ---------- Instagram ----------
def publish_ig(image_url, caption):
    tok = os.environ["META_ADS_ACCESS_TOKEN"]; ig = os.environ["META_IG_USER_ID"]
    r = requests.post(f"{GRAPH}/{ig}/media",
                      data={"image_url": image_url, "caption": caption, "access_token": tok}, timeout=60)
    r.raise_for_status(); cid = r.json()["id"]
    # IG procesa la imagen de forma asíncrona: hay que esperar a FINISHED antes de
    # publicar, o media_publish devuelve 400 (Media ID is not available).
    for _ in range(12):
        st = requests.get(f"{GRAPH}/{cid}", params={"fields": "status_code", "access_token": tok},
                          timeout=30).json()
        if st.get("status_code") == "FINISHED":
            break
        if st.get("status_code") == "ERROR":
            raise SystemExit(f"IG falló al procesar el contenedor: {st}")
        time.sleep(5)
    r = requests.post(f"{GRAPH}/{ig}/media_publish",
                      data={"creation_id": cid, "access_token": tok}, timeout=60)
    r.raise_for_status(); mid = r.json()["id"]
    meta = requests.get(f"{GRAPH}/{mid}",
                        params={"fields": "permalink", "access_token": tok}, timeout=60).json()
    return mid, meta.get("permalink")


def main():
    dry = os.environ.get("DRY_RUN") == "1"
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    q = pick_question(conn)
    cr = round(q["first_attempts_correct_sum"] / q["difficulty_sample_size"] * 100)
    print(f"Elegida: [{q['short_name']} art.{q['article_number']}] {cr}% acierto · {q['question_text'][:70]}")
    buf = render(q)
    caption = build_caption(q)
    if dry:
        with open("/tmp/ig_preview.jpg", "wb") as f:
            f.write(buf.getvalue())
        print("DRY_RUN: imagen en /tmp/ig_preview.jpg, NO se publica.\n--- caption ---\n" + caption)
        return
    image_url = upload_s3(buf)
    print("Imagen en:", image_url)
    mid, permalink = publish_ig(image_url, caption)
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO instagram_posts (question_id, media_id, permalink, caption, image_url) "
            "VALUES (%s,%s,%s,%s,%s)",
            (q["id"], mid, permalink, caption, image_url),
        )
    print(f"✅ Publicado: {permalink} (media {mid})")


if __name__ == "__main__":
    main()
