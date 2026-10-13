import TankGame from "@/components/TankGame";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>坦克大战</h1>
        <span className={styles.subtitle}>Next.js · Canvas · 60FPS</span>
      </div>
      <TankGame />
    </main>
  );
}
