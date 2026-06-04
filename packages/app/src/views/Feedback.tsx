import { useEffect, useRef, useState } from "react";
import { Ic } from "../components/Ic";
import { Button } from "../components/Button";
import { isSyncConfigured, getPca, getAccount } from "../sync/msal";
import { sendFeedbackMail, FEEDBACK_TO, type FeedbackType } from "../feedback/sendFeedback";

const MAX_IMAGES = 3;

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line)",
  background: "var(--surface)", color: "var(--ink)", fontSize: 14, marginTop: 8,
};

/* Een gekozen afbeelding + een object-URL voor de preview (apart vrijgegeven). */
interface Picked { file: File; url: string }

export function Feedback() {
  const configured = isSyncConfigured();
  const [type, setType] = useState<FeedbackType>("idee");
  const [onderwerp, setOnderwerp] = useState("");
  const [beschrijving, setBeschrijving] = useState("");
  const [images, setImages] = useState<Picked[]>([]);
  const [status, setStatus] = useState<"idle" | "sending" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Login-status bepalen voor de knoptekst (niet ingelogd → "Inloggen en versturen").
  useEffect(() => {
    if (!configured) return;
    (async () => {
      try { await getPca(); setSignedIn(!!getAccount()); } catch { /* genegeerd */ }
    })();
  }, [configured]);

  // Resterende object-URL's vrijgeven bij unmount (verwijderen/reset doet dat al per stuk).
  // Een ref houdt de laatste lijst bij zodat de unmount-cleanup geen actieve URL's intrekt.
  const imagesRef = useRef(images);
  imagesRef.current = images;
  useEffect(() => () => { imagesRef.current.forEach((p) => URL.revokeObjectURL(p.url)); }, []);

  function addFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // reset zodat hetzelfde bestand opnieuw te kiezen is
    if (!files.length) return;
    setImages((prev) => {
      const room = MAX_IMAGES - prev.length;
      const next = files.slice(0, room).map((file) => ({ file, url: URL.createObjectURL(file) }));
      return [...prev, ...next];
    });
  }

  function removeImage(idx: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  }

  function reset() {
    images.forEach((p) => URL.revokeObjectURL(p.url));
    setType("idee"); setOnderwerp(""); setBeschrijving(""); setImages([]);
  }

  const canSubmit = onderwerp.trim().length > 0 && beschrijving.trim().length > 0 && status !== "sending";

  async function submit() {
    if (!canSubmit) return;
    setStatus("sending"); setError(null);
    try {
      await sendFeedbackMail({ type, onderwerp, beschrijving, images: images.map((p) => p.file) });
      setSignedIn(true);
      reset();
      setStatus("success");
    } catch (e) {
      // Login-/consent-popup geannuleerd: geen rode foutmelding tonen.
      const msg = e instanceof Error ? e.message : String(e);
      const cancelled = /user_cancelled|user_cancel|popup_window_error|cancelled|geannuleerd/i.test(msg)
        || (e as { errorCode?: string })?.errorCode === "user_cancelled";
      setStatus("idle");
      if (!cancelled) setError(msg);
    }
  }

  // Build zonder Microsoft-client-ID: Graph-verzending kan niet → mailto-fallback.
  if (!configured) {
    return (
      <div className="content-inner fade-in" style={{ maxWidth: 640 }}>
        <div className="card card-pad">
          <div className="card-h" style={{ marginBottom: 10 }}><h3>Feedback &amp; bugs</h3></div>
          <p style={{ color: "var(--body)", fontSize: 14, lineHeight: 1.6 }}>
            Het versturen vanuit de app vereist een Microsoft-account, dat in deze versie niet is
            geconfigureerd. Mail je idee of bug gerust rechtstreeks:
          </p>
          <a className="btn btn-primary" style={{ textDecoration: "none" }}
            href={`mailto:${FEEDBACK_TO}?subject=${encodeURIComponent("BOKKIEP - ")}`}>
            <Ic name="feedback" size={18} /> Mail naar {FEEDBACK_TO}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="content-inner fade-in" style={{ maxWidth: 640 }}>
      {status === "success" && (
        <div className="notice" role="status" onClick={() => setStatus("idle")} title="Verbergen"
          style={{ marginBottom: 18, cursor: "pointer", background: "var(--pos-soft)", borderColor: "#CFE6DD" }}>
          <span className="ni" style={{ color: "var(--pos)" }}><Ic name="check" size={20} /></span>
          <div className="nt">Bedankt! Je melding is verstuurd. Je kunt meteen een nieuwe sturen.</div>
        </div>
      )}
      {error && (
        <div className="notice" role="status" onClick={() => setError(null)} title="Verbergen"
          style={{ marginBottom: 18, cursor: "pointer", background: "var(--over-soft)", borderColor: "#F3D9D5" }}>
          <span className="ni" style={{ color: "var(--over)" }}><Ic name="info" size={20} /></span>
          <div className="nt">Versturen lukte niet: {error}</div>
        </div>
      )}

      <div className="card card-pad">
        <div className="card-h" style={{ marginBottom: 6 }}>
          <h3>Feedback &amp; bugs</h3>
        </div>
        <p style={{ color: "var(--muted)", margin: "0 0 16px", fontSize: 13.5, lineHeight: 1.6 }}>
          {type === "bug" ? (
            <>
              Liep je tegen een bug aan? Het kan altijd gebeuren dat er iets niet helemaal lekker doorkomt of
              misgaat — fijn dat je het laat weten. We houden onze mail in de gaten en proberen zo snel mogelijk
              te schakelen. Je melding gaat per e-mail rechtstreeks naar de maker, vanuit je eigen
              Microsoft-account zodat je ook een antwoord kunt krijgen. Beschrijf vooral wat er gebeurde en
              voeg gerust een schermafbeelding toe — dat helpt enorm bij het oplossen.
            </>
          ) : (
            <>
              Heb je een idee om bokkiep beter te maken? We horen het graag! Grote of kleine ideeën zijn allemaal
              welkom — bokkiep groeit juist dankzij input zoals die van jou, en wie weet zie je jouw idee
              binnenkort terug in de app. Je melding gaat per e-mail rechtstreeks naar de maker, vanuit je eigen
              Microsoft-account zodat je ook een antwoord kunt krijgen. Voeg gerust een schermafbeelding toe.
            </>
          )}
        </p>

        {/* Type: idee / bug */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <Button variant={type === "idee" ? "primary" : "default"} icon="sparkle"
            onClick={() => setType("idee")}>Idee</Button>
          <Button variant={type === "bug" ? "primary" : "default"} icon="bug"
            onClick={() => setType("bug")}>Bug</Button>
        </div>

        <label className="prof-field-lbl" htmlFor="fb-subject">Onderwerp</label>
        <input id="fb-subject" style={inputStyle} type="text" maxLength={120}
          placeholder={type === "bug" ? "Korte omschrijving van de bug" : "Korte titel van je idee"}
          value={onderwerp} onChange={(e) => setOnderwerp(e.target.value)} />

        <label className="prof-field-lbl" htmlFor="fb-body" style={{ display: "block", marginTop: 16 }}>Beschrijving</label>
        <textarea id="fb-body" style={{ ...inputStyle, minHeight: 130, resize: "vertical", fontFamily: "inherit" }}
          placeholder={type === "bug"
            ? "Wat gebeurde er, wat verwachtte je, en hoe kan ik het nadoen?"
            : "Beschrijf je idee zo concreet mogelijk."}
          value={beschrijving} onChange={(e) => setBeschrijving(e.target.value)} />

        {/* Afbeeldingen */}
        <div style={{ marginTop: 18 }}>
          <span className="prof-field-lbl">Afbeeldingen <span style={{ color: "var(--faint)", fontWeight: 400 }}>(optioneel, max. {MAX_IMAGES})</span></span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
            {images.map((p, i) => (
              <div key={p.url} style={{ position: "relative", width: 84, height: 84, borderRadius: 10, overflow: "hidden", border: "1px solid var(--line)" }}>
                <img src={p.url} alt={p.file.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button type="button" aria-label="Verwijderen" onClick={() => removeImage(i)}
                  style={{ position: "absolute", top: 3, right: 3, width: 22, height: 22, borderRadius: "50%", border: "none", cursor: "pointer", background: "rgba(0,0,0,.55)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Ic name="x" size={14} />
                </button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <button type="button" onClick={() => fileRef.current?.click()}
                style={{ width: 84, height: 84, borderRadius: 10, border: "1px dashed var(--line)", background: "var(--surface)", color: "var(--muted)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                <Ic name="plus" size={20} />
                <span style={{ fontSize: 11.5 }}>Toevoegen</span>
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={addFiles} />
        </div>

        <div style={{ marginTop: 22 }}>
          <Button variant="primary" icon="feedback" disabled={!canSubmit} onClick={submit}>
            {status === "sending" ? "Versturen…" : signedIn ? "Versturen" : "Inloggen en versturen"}
          </Button>
        </div>
      </div>
    </div>
  );
}
