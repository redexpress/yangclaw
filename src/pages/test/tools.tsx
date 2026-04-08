'use client'

import { useState, useEffect, useCallback } from 'react'
import styles from './tools.module.scss'

// Types
interface ToolInfo {
  name: string
  description: string
  schema: {
    type: 'object'
    properties: Record<string, { type: string; description?: string; default?: unknown }>
    required?: string[]
  }
  supportsBackground?: boolean
}

interface TestCase {
  name: string
  args: Record<string, unknown>
  expectedSuccess?: boolean
}

interface TestResult {
  name: string
  success: boolean
  output?: string
  error?: string
  durationMs?: number
  actualSuccess?: boolean
  passed?: boolean
  expectedSuccess?: boolean
}

// Predefined test cases for each tool
const TEST_CASES: Record<string, TestCase[]> = {
  exec: [
    {
      name: 'echo test',
      args: { command: 'echo hello' },
      expectedSuccess: true,
    },
    {
      name: 'list files',
      args: { command: 'ls', workdir: '.' },
      expectedSuccess: true,
    },
    {
      name: 'invalid command',
      args: { command: 'nonexistent_cmd_12345' },
      expectedSuccess: false,
    },
  ],
  read: [
    {
      name: 'read package.json',
      args: { path: 'package.json' },
      expectedSuccess: true,
    },
    {
      name: 'read non-existent file',
      args: { path: './non_existent_file_xyz.txt' },
      expectedSuccess: false,
    },
  ],
  write: [
    {
      name: 'write and read file',
      args: { path: './test_output.txt', content: 'Hello from test!' },
      expectedSuccess: true,
    },
  ],
}

export default function TestTools() {
  const [tools, setTools] = useState<ToolInfo[]>([])
  const [selectedTool, setSelectedTool] = useState<string>('')
  const [args, setArgs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string>('')
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [runningTests, setRunningTests] = useState(false)

  // Load tools
  useEffect(() => {
    fetch('/api/tools/list')
      .then((r) => r.json())
      .then((data) => {
        setTools(data.tools || [])
        if (data.tools?.length > 0) {
          setSelectedTool(data.tools[0].name)
        }
      })
      .catch(() => {
        setResult('Failed to load tools')
      })
  }, [])

  // Update args when selected tool changes
  useEffect(() => {
    if (!selectedTool) return
    const tool = tools.find((t) => t.name === selectedTool)
    if (!tool) return

    const newArgs: Record<string, string> = {}
    for (const [key, param] of Object.entries(tool.schema.properties)) {
      if (param.default !== undefined) {
        newArgs[key] = String(param.default)
      } else if (param.type === 'boolean') {
        newArgs[key] = 'false'
      } else {
        newArgs[key] = ''
      }
    }
    setArgs(newArgs)
    setResult('')
    setTestResults([])
  }, [selectedTool, tools])

  // Execute single tool
  const executeTool = useCallback(async () => {
    if (!selectedTool) return
    setLoading(true)
    setResult('')

    try {
      const parsedArgs: Record<string, unknown> = {}
      const tool = tools.find((t) => t.name === selectedTool)
      if (!tool) return

      for (const [key, param] of Object.entries(tool.schema.properties)) {
        const value = args[key]
        if (param.type === 'number') {
          parsedArgs[key] = value ? Number(value) : undefined
        } else if (param.type === 'boolean') {
          parsedArgs[key] = value === 'true'
        } else {
          parsedArgs[key] = value || undefined
        }
      }

      const start = Date.now()
      const response = await fetch('/api/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: selectedTool, args: parsedArgs }),
      })
      const data = await response.json()
      const duration = Date.now() - start

      if (data.success) {
        setResult(`✅ Success (${duration}ms)\n${data.output || ''}`)
      } else {
        setResult(`❌ Failed (${duration}ms)\n${data.error || ''}`)
      }
    } catch (err) {
      setResult(`❌ Error: ${String(err)}`)
    } finally {
      setLoading(false)
    }
  }, [selectedTool, args, tools])

  // Run unit tests
  const runUnitTests = useCallback(async () => {
    if (!selectedTool || !TEST_CASES[selectedTool]) {
      setResult('No test cases defined for this tool')
      return
    }

    setRunningTests(true)
    setTestResults([])
    setResult('Running tests...')

    const tests = TEST_CASES[selectedTool]
    const results: TestResult[] = []

    for (const test of tests) {
      try {
        const parsedArgs: Record<string, unknown> = { ...test.args }
        // Convert numeric/boolean strings if needed
        for (const [key, value] of Object.entries(parsedArgs)) {
          const tool = tools.find((t) => t.name === selectedTool)
          const param = tool?.schema.properties[key]
          if (param?.type === 'number' && typeof value === 'string') {
            parsedArgs[key] = Number(value)
          } else if (param?.type === 'boolean' && typeof value === 'string') {
            parsedArgs[key] = value === 'true'
          }
        }

        const start = Date.now()
        const response = await fetch('/api/tools/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool: selectedTool, args: parsedArgs }),
        })
        const data = await response.json()
        const duration = Date.now() - start

        const actualSuccess = data.success === true
        const passed = actualSuccess === test.expectedSuccess

        results.push({
          name: test.name,
          success: data.success,
          output: data.output,
          error: data.error,
          durationMs: duration,
          actualSuccess,
          passed,
        })
      } catch (err) {
        results.push({
          name: test.name,
          success: false,
          error: String(err),
          actualSuccess: false,
          passed: test.expectedSuccess === false,
        })
      }
      setTestResults([...results])
    }

    setRunningTests(false)

    const passed = results.filter((r) => r.passed).length
    setResult(`Tests complete: ${passed}/${results.length} passed`)
  }, [selectedTool, tools])

  const selectedToolInfo = tools.find((t) => t.name === selectedTool)

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Tools Test</h1>
      </div>

      <div className={styles.content}>
        {/* Left: Tool Selection */}
        <div className={styles.left}>
          <div className={styles.section}>
            <h2>Available Tools ({tools.length})</h2>
            <div className={styles.toolList}>
              {tools.map((tool) => (
                <button
                  key={tool.name}
                  className={`${styles.toolItem} ${selectedTool === tool.name ? styles.selected : ''}`}
                  onClick={() => setSelectedTool(tool.name)}
                >
                  {tool.name}
                </button>
              ))}
            </div>
          </div>

          {selectedToolInfo && (
            <div className={styles.section}>
              <h2>Tool Info</h2>
              <div className={styles.info}>
                <p><strong>Name:</strong> {selectedToolInfo.name}</p>
                <p><strong>Description:</strong> {selectedToolInfo.description}</p>
                {selectedToolInfo.supportsBackground && (
                  <p><strong>Background:</strong> Supported</p>
                )}
              </div>
            </div>
          )}

          {selectedToolInfo && (
            <div className={styles.section}>
              <h2>Parameters</h2>
              <div className={styles.params}>
                {Object.entries(selectedToolInfo.schema.properties).map(([key, param]) => (
                  <div key={key} className={styles.param}>
                    <label htmlFor={`arg-${key}`}>
                      {key}
                      {selectedToolInfo.schema.required?.includes(key) && <span className={styles.required}>*</span>}
                      <span className={styles.type}>({param.type})</span>
                    </label>
                    {param.type === 'boolean' ? (
                      <select
                        id={`arg-${key}`}
                        className={styles.input}
                        value={args[key] || 'false'}
                        onChange={(e) => setArgs({ ...args, [key]: e.target.value })}
                      >
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : param.type === 'number' ? (
                      <input
                        id={`arg-${key}`}
                        type="number"
                        className={styles.input}
                        value={args[key] || ''}
                        onChange={(e) => setArgs({ ...args, [key]: e.target.value })}
                        placeholder={param.description}
                      />
                    ) : (
                      <textarea
                        id={`arg-${key}`}
                        className={styles.input}
                        value={args[key] || ''}
                        onChange={(e) => setArgs({ ...args, [key]: e.target.value })}
                        placeholder={param.description}
                        rows={param.type === 'string' && key === 'content' ? 4 : 1}
                      />
                    )}
                    {param.description && <span className={styles.desc}>{param.description}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={styles.actions}>
            <button
              className={styles.executeBtn}
              onClick={executeTool}
              disabled={loading || !selectedTool}
            >
              {loading ? 'Executing...' : 'Execute'}
            </button>
            {TEST_CASES[selectedTool] && (
              <button
                className={styles.testBtn}
                onClick={runUnitTests}
                disabled={runningTests || !selectedTool}
              >
                {runningTests ? 'Testing...' : `Unit Tests (${TEST_CASES[selectedTool].length})`}
              </button>
            )}
          </div>
        </div>

        {/* Right: Results */}
        <div className={styles.right}>
          <div className={styles.section}>
            <h2>Test Results</h2>
            {testResults.length > 0 && (
              <div className={styles.testList}>
                {testResults.map((tr, i) => (
                  <div
                    key={i}
                    className={`${styles.testItem} ${tr.passed ? styles.passed : styles.failed}`}
                  >
                    <div className={styles.testHeader}>
                      <span className={styles.testStatus}>{tr.passed ? '✅' : '❌'}</span>
                      <span className={styles.testName}>{tr.name}</span>
                      {tr.durationMs && <span className={styles.testDuration}>{tr.durationMs}ms</span>}
                    </div>
                    {tr.output && <pre className={styles.testOutput}>{tr.output}</pre>}
                    {tr.error && <pre className={styles.testError}>{tr.error}</pre>}
                    <div className={styles.testMeta}>
                      Expected: {tr.expectedSuccess ? 'success' : 'failure'} | Actual: {tr.actualSuccess ? 'success' : 'failure'}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {result && (
              <div className={styles.resultBox}>
                <pre>{result}</pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}