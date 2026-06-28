import { useState, useRef, useEffect } from 'react';

// Replace with your Railway server URL after deploying
const RUNNER_URL = import.meta.env.VITE_RUNNER_URL || 'http://localhost:3001';

function StatusDot({ status }) {
  const colors = {
    idle: '#6b7280',
    running: '#f59e0b',
    pass: '#22c55e',
    fail: '#ef4444',
  };
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: colors[status],
        boxShadow: status === 'running' ? `0 0 6px ${colors.running}` : 'none',
        transition: 'all 0.3s',
      }}
    />
  );
}

export default function PlaywrightDemo() {
  const [lines, setLines] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | running | pass | fail
  const [isRunning, setIsRunning] = useState(false);
  const terminalRef = useRef(null);
  const eventSourceRef = useRef(null);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  const addLine = (type, text) => {
    setLines(prev => [...prev, { type, text, id: Date.now() + Math.random() }]);
  };

  const runTests = async () => {
    if (isRunning) return;

    // Check server health first
    try {
      const health = await fetch(`${RUNNER_URL}/health`);
      const data = await health.json();
      if (data.running) {
        addLine('warn', 'A test run is already in progress. Try again in a moment.');
        return;
      }
    } catch {
      addLine('error', 'Could not reach the test runner server. Is it deployed?');
      return;
    }

    setLines([]);
    setIsRunning(true);
    setStatus('running');

    const es = new EventSource(`${RUNNER_URL}/run-tests`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      const { type, data } = JSON.parse(event.data);

      switch (type) {
        case 'log':
          addLine('log', data);
          break;
        case 'status':
          addLine('status', data);
          break;
        case 'divider':
          addLine('divider', data);
          break;
        case 'result':
          setStatus(data === 'PASS' ? 'pass' : 'fail');
          addLine('result', data);
          break;
        case 'done':
          setIsRunning(false);
          es.close();
          break;
        default:
          break;
      }
    };

    es.onerror = () => {
      addLine('error', 'Connection to test runner lost.');
      setIsRunning(false);
      setStatus('fail');
      es.close();
    };
  };

  const clearTerminal = () => {
    setLines([]);
    setStatus('idle');
  };

  const lineColor = (type) => {
    switch (type) {
      case 'status': return '#93c5fd';
      case 'divider': return '#374151';
      case 'error': return '#f87171';
      case 'warn': return '#fbbf24';
      case 'result': return 'inherit';
      default: return '#d1d5db';
    }
  };

  const statusLabel = {
    idle: 'Ready',
    running: 'Running...',
    pass: 'All tests passed',
    fail: 'Tests failed',
  };

  return (
    <div style={{
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
      background: '#0d1117',
      border: '1px solid #21262d',
      borderRadius: 8,
      overflow: 'hidden',
      maxWidth: 720,
      width: '100%',
      margin: '0 auto',
    }}>
      {/* Terminal header bar */}
      <div style={{
        background: '#161b22',
        borderBottom: '1px solid #21262d',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* macOS-style dots */}
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57', display: 'inline-block' }} />
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e', display: 'inline-block' }} />
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840', display: 'inline-block' }} />
        </div>

        <span style={{ color: '#8b949e', fontSize: 12 }}>playwright — smoke tests</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StatusDot status={status} />
          <span style={{ color: '#8b949e', fontSize: 12 }}>{statusLabel[status]}</span>
        </div>
      </div>

      {/* Terminal body */}
      <div
        ref={terminalRef}
        style={{
          padding: '16px',
          height: 340,
          overflowY: 'auto',
          fontSize: 13,
          lineHeight: 1.6,
          scrollbarWidth: 'thin',
          scrollbarColor: '#374151 transparent',
        }}
      >
        {lines.length === 0 && (
          <span style={{ color: '#4b5563' }}>
            {'>'} Press "Run Tests" to trigger a live Playwright smoke suite against the desk app.
          </span>
        )}

        {lines.map((line) => (
          <div key={line.id} style={{ color: lineColor(line.type) }}>
            {line.type === 'result' ? (
              <span style={{
                fontWeight: 700,
                color: line.text === 'PASS' ? '#22c55e' : '#ef4444',
                fontSize: 14,
              }}>
                {line.text === 'PASS' ? '✓ PASSED' : '✗ FAILED'}
              </span>
            ) : line.type === 'divider' ? (
              <span style={{ color: '#21262d' }}>{line.text}</span>
            ) : (
              <span>
                {line.type === 'status' && <span style={{ color: '#4b5563' }}>{'> '}</span>}
                {line.text}
              </span>
            )}
          </div>
        ))}

        {isRunning && (
          <span style={{ color: '#f59e0b', animation: 'pulse 1s infinite' }}>▊</span>
        )}
      </div>

      {/* Controls */}
      <div style={{
        borderTop: '1px solid #21262d',
        padding: '12px 16px',
        display: 'flex',
        gap: 8,
        background: '#161b22',
      }}>
        <button
          onClick={runTests}
          disabled={isRunning}
          style={{
            background: isRunning ? '#1f2937' : '#1d4ed8',
            color: isRunning ? '#6b7280' : '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '8px 20px',
            fontSize: 13,
            fontFamily: 'inherit',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            transition: 'background 0.2s',
          }}
        >
          {isRunning ? 'Running...' : '▶ Run Tests'}
        </button>

        <button
          onClick={clearTerminal}
          disabled={isRunning}
          style={{
            background: 'transparent',
            color: '#6b7280',
            border: '1px solid #21262d',
            borderRadius: 6,
            padding: '8px 16px',
            fontSize: 13,
            fontFamily: 'inherit',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            transition: 'color 0.2s',
          }}
        >
          Clear
        </button>

        <span style={{
          marginLeft: 'auto',
          color: '#4b5563',
          fontSize: 11,
          alignSelf: 'center',
        }}>
          @smoke suite · chromium
        </span>
      </div>
    </div>
  );
}
