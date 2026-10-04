import { Knight } from "@/components/ui/knight";
import styles from "./auth-shell.module.css";

/** Habillage commun à la connexion, à la double authentification et à l'activation. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.shell}>
      <aside className={styles.brand} aria-label="Maison Cavalier">
        <div className={styles.wordmark}>
          <Knight size={27} color="currentColor" />
          <span>Maison Cavalier</span>
        </div>
        <svg className={styles.architecture} viewBox="0 0 600 520" fill="none" aria-hidden="true">
          <g stroke="currentColor" strokeWidth="1">
            <path d="M65 495V140L300 38l235 102v355M48 148 300 20l252 128M80 158h440M80 173h440M80 325h440M65 340h470M48 487h504M35 502h530" />
            <path d="M242 487V394a58 58 0 0 1 116 0v93M253 487V395a47 47 0 0 1 94 0v92M300 349v138M253 405h94M270 419h18v50h-18zM312 419h18v50h-18z" />
            {[112, 220, 328, 436].map((x) => (
              <g key={x}>
                <path d={`M${x} 297V224a26 26 0 0 1 52 0v73zM${x + 26} 198v99M${x} 237h52M${x - 7} 306h66M${x - 7} 311h66`} />
                <path d={`M${x - 3} 280h58M${x + 5} 280v25M${x + 16} 280v25M${x + 27} 280v25M${x + 38} 280v25M${x + 49} 280v25`} />
              </g>
            ))}
            {[112, 436].map((x) => (
              <g key={x}>
                <path d={`M${x} 452v-82h52v82zM${x + 26} 370v82M${x} 402h52M${x - 6} 460h64`} />
              </g>
            ))}
            <circle cx="300" cy="112" r="23" />
            <path d="M300 89v46M277 112h46M90 173v152M194 173v152M406 173v152M510 173v152M90 340v147M194 340v147M406 340v147M510 340v147" opacity=".5" />
          </g>
        </svg>
        <div className={styles.signature}>
          <p className={styles.headline}>L’attention à chaque détail.</p>
          <p className={styles.description}>
            Au service de vos immeubles.<br />
            Aux petits soins pour leurs résidents.
          </p>
        </div>
        <p className={styles.brandFooter}>L’Immeuble Haute Couture</p>
      </aside>
      <section className={styles.access} aria-label="Accès à votre espace">
        <div className={styles.topline}>Votre espace professionnel</div>
        <div className={styles.content}>{children}</div>
        <footer className={styles.footer}>Maison Cavalier · Conciergerie d’immeuble</footer>
      </section>
    </main>
  );
}
