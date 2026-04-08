import Head from 'next/head'
import Link from 'next/link'
import styles from './index.module.scss'

export default function Home() {
  return (
    <>
      <Head>
        <title>YangClaw</title>
      </Head>
      <div className={styles.home}>
        <h1>Welcome to YangClaw</h1>
        <p>A simple chat application powered by AI.</p>
        <div className={styles.cards}>
          <Link href="/agent" className={styles.card}>
            <h2>Agent</h2>
            <p>Start a conversation with AI</p>
          </Link>
          <Link href="/test/tools" className={styles.card}>
            <h2>Test</h2>
            <p>API testing tools</p>
          </Link>
        </div>
      </div>
    </>
  )
}