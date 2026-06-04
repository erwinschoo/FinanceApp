import { db } from "./schema";
import { DEFAULT_CATEGORIES } from "../categories";

/* Eén waarheidsbron voor "heeft de gebruiker écht data?" — de scheidslijn tussen
 * een vers, geseeded toestel en een toestel met betekenisvolle inhoud. Cruciaal
 * voor de sync-veiligheid: een vers/leeg toestel mag NOOIT een gevulde cloud-backup
 * overschrijven. Seeden zet deze vlag bewust NIET. */

const USER_TOUCHED_KEY = "userTouched";
const DEFAULT_CAT_IDS = new Set(DEFAULT_CATEGORIES.map((c) => c.id));

let touchedThisSession = false;

/* Markeer dat de gebruiker zelf iets heeft gewijzigd/geïmporteerd. Aangeroepen
 * vanuit elke datamutatie (via scheduleSync). Idempotent en goedkoop: schrijft
 * de meta-vlag hooguit één keer per sessie. Faalt geruisloos. */
export async function markUserTouched(): Promise<void> {
  if (touchedThisSession) return;
  touchedThisSession = true;
  try {
    await db.meta.put({ key: USER_TOUCHED_KEY, value: true });
  } catch {
    touchedThisSession = false; // bij fout opnieuw mogen proberen
  }
}

/* True zodra er betekenisvolle gebruikersinhoud bestaat. Eerst de expliciete
 * vlag; daarna defensief de feitelijke inhoud (zodat ook een vanuit de cloud
 * gevuld of geïmporteerd toestel zonder gezette vlag correct als "gevuld" telt). */
export async function hasUserContent(): Promise<boolean> {
  const flag = await db.meta.get(USER_TOUCHED_KEY);
  if ((flag?.value as boolean | undefined) === true) return true;

  if ((await db.transactions.count()) > 0) return true;
  if ((await db.goals.count()) > 0) return true;
  if ((await db.pots.count()) > 0) return true;
  if ((await db.payees.toArray()).some((p) => p.categoryId)) return true;
  if ((await db.budgets.toArray()).some((b) => b.amountCents > 0)) return true;
  if ((await db.categories.toArray()).some((c) => !DEFAULT_CAT_IDS.has(c.id))) return true;
  if ((await db.meta.get("profile"))?.value != null) return true;

  return false;
}
