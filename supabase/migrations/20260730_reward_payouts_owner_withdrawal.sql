-- 20260730_reward_payouts_owner_withdrawal.sql
--
-- Separar la RETIRADA DEL PROPIETARIO de las recompensas a embajadores.
--
-- ## Por qué (30/07/2026)
--
-- Manuel compra vales de Amazon con el saldo de Bitrefill para sí mismo. Es legítimo —es su
-- cuenta y su dinero—, pero hasta hoy **no había forma de registrarlo como lo que es**: el CHECK
-- de `reason` solo admitía 'referral' | 'bug' | 'ugc' | 'accumulated', así que se anotaba como
-- `accumulated`, es decir, **indistinguible del pago de una recompensa ganada por un embajador**.
--
-- Consecuencia medida: los 210 € que ya figuraban a su nombre (3 pagos del 28/07: 100+100+10)
-- entraban en el escaparate del programa —`getReferralAdminStats`, que suma TODOS los payouts
-- pagados— inflando el coste declarado de las recompensas con dinero que nunca fue a un embajador.
--
-- ## Qué NO cambia
--
-- El saldo POR USUARIO sigue restando estas retiradas (`getUserOwedBalance`), que es justo lo que
-- Manuel quiere ver: su saldo en negativo refleja lo que se ha llevado. Lo que se separa es el
-- COSTE DEL PROGRAMA, que es otra pregunta y hasta ahora respondía mal.
--
-- Reversible: `owner_withdrawal` es un valor más del CHECK; quitarlo exige antes reclasificar.

BEGIN;

ALTER TABLE public.reward_payouts DROP CONSTRAINT IF EXISTS reward_payouts_reason_chk;

ALTER TABLE public.reward_payouts
  ADD CONSTRAINT reward_payouts_reason_chk
  CHECK (reason = ANY (ARRAY['referral'::text, 'bug'::text, 'ugc'::text, 'accumulated'::text, 'owner_withdrawal'::text]));

-- Reclasificar los 3 pagos históricos del 28/07 a la cuenta del propietario. NO es reescribir la
-- historia: el acto fue siempre una retirada del propietario; lo que estaba mal era la etiqueta,
-- porque no existía la correcta. Se acota por email para no tocar nada de ningún embajador.
UPDATE public.reward_payouts p
   SET reason = 'owner_withdrawal'
  FROM public.user_profiles u
 WHERE u.id = p.beneficiary_user_id
   AND u.email = 'manueltrader@gmail.com'
   AND p.reason = 'accumulated';

COMMIT;
