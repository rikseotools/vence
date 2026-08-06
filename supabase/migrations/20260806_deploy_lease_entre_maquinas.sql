-- T-485 — el candado de deploy pasa a cruzar máquinas.
--
-- Hasta ahora la exclusión mutua la daba `flock` sobre /tmp/vence-deploy.lock, que es PER-MÁQUINA:
-- dos deploys desde máquinas distintas no se veían. `deploy_runs` ya registraba quién desplegaba
-- (telemetría, fail-open) pero no impedía nada.
--
-- Se añade el ARRIENDO, no un lock: si el proceso muere, la fila caduca sola. Un lock eterno en
-- una tabla es peor que ninguno — obliga a borrar filas a mano y así es como se aprende a no usar
-- el candado.

ALTER TABLE public.deploy_runs
  ADD COLUMN IF NOT EXISTS lease_until timestamptz;

COMMENT ON COLUMN public.deploy_runs.lease_until IS
  'T-485: hasta cuándo vale el arriendo del candado de deploy. NULL = esta fila es solo telemetría '
  '(no reclama el candado). El deploy lo renueva mientras vive; si muere, caduca solo.';

-- Índice parcial: la pregunta que se hace en CADA adquisición es «¿hay alguna fila abierta con
-- arriendo vivo?». Sin él, un secuencial sobre el histórico entero en el punto más caliente.
CREATE INDEX IF NOT EXISTS deploy_runs_lease_vivo_idx
  ON public.deploy_runs (lease_until)
  WHERE finished_at IS NULL AND lease_until IS NOT NULL;

-- Al cerrar un run se suelta el arriendo. Va en la BD y no solo en el script porque el `trap` del
-- shell no cubre un `kill -9`: aquí, cualquier cierre —venga de donde venga— libera.
CREATE OR REPLACE FUNCTION public.tg_deploy_runs_soltar_lease()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.finished_at IS NOT NULL AND OLD.finished_at IS NULL THEN
    NEW.lease_until := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_deploy_runs_soltar_lease ON public.deploy_runs;
CREATE TRIGGER tg_deploy_runs_soltar_lease
  BEFORE UPDATE ON public.deploy_runs
  FOR EACH ROW EXECUTE FUNCTION public.tg_deploy_runs_soltar_lease();

-- La simulación (`npm run sim:candado-deploy`) ejerce el mecanismo REAL —dos adquisiciones de
-- verdad— porque lo que se afirma es exclusión mutua y eso no lo demuestra leer el SQL. Necesita
-- por tanto una superficie propia: `sim` cuenta para el candado igual que las demás (si no, no
-- probaría nada), pero deja sus filas identificables en el histórico.
ALTER TABLE public.deploy_runs DROP CONSTRAINT IF EXISTS deploy_runs_surface_check;
ALTER TABLE public.deploy_runs ADD CONSTRAINT deploy_runs_surface_check
  CHECK (surface = ANY (ARRAY['frontend'::text, 'backend'::text, 'sim'::text]));
