import Link from 'next/link'
import { useRouter } from 'next/router'
import styles from './Layout.module.scss'

export function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  return (
    <div className={styles.container}>
      <nav className={styles.nav}>
        <div className={styles.logo}>YangClaw</div>
        <div className={styles.links}>
          <Link href="/" className={router.pathname === '/' ? styles.active : ''}>Home</Link>
          <Link href="/agent" className={router.pathname === '/agent' ? styles.active : ''}>Agent</Link>
          <Link href="/test/tools" className={router.pathname === '/test/tools' ? styles.active : ''}>Test</Link>
        </div>
      </nav>
      <main className={styles.main}>{children}</main>
    </div>
  )
}
