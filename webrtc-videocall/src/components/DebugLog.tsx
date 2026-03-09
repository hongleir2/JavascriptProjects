import { useRef, useEffect, useState } from 'react';
import { Box, Typography, IconButton, Collapse } from '@mui/material';
import { Terminal, ExpandMore, ExpandLess } from '@mui/icons-material';
import type { LogEntry } from '@/types';

interface DebugLogProps {
  logs: LogEntry[];
}

const SOURCE_COLORS: Record<string, string> = {
  ws: '#06b6d4',
  pc: '#a78bfa',
  ice: '#34d399',
  ui: '#f59e0b',
};

export function DebugLog({ logs }: DebugLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (scrollRef.current && expanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, expanded]);

  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: 120,
        right: 16,
        width: 380,
        maxHeight: expanded ? 280 : 40,
        borderRadius: '12px',
        background: 'rgba(10, 10, 15, 0.85)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        zIndex: 10,
        transition: 'max-height 0.3s ease',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 0.5,
          borderBottom: expanded ? '1px solid rgba(255,255,255,0.06)' : 'none',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        role="button"
        tabIndex={0}
        aria-label={expanded ? 'Collapse debug log' : 'Expand debug log'}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded); } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Terminal sx={{ fontSize: 16, color: 'rgba(255,255,255,0.4)' }} />
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Debug Log
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.65rem' }}>
            ({logs.length})
          </Typography>
        </Box>
        <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.3)' }}>
          {expanded ? <ExpandMore sx={{ fontSize: 16 }} /> : <ExpandLess sx={{ fontSize: 16 }} />}
        </IconButton>
      </Box>

      {/* Log entries */}
      <Collapse in={expanded}>
        <Box
          ref={scrollRef}
          sx={{
            overflow: 'auto',
            maxHeight: 240,
            px: 1.5,
            py: 1,
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            fontSize: '0.72rem',
            lineHeight: 1.7,
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.1)', borderRadius: 2 },
          }}
        >
          {logs.map((entry, i) => {
            const time = new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const arrow = entry.direction === 'send' ? '→' : entry.direction === 'recv' ? '←' : '•';
            const color = SOURCE_COLORS[entry.source] || '#888';

            return (
              <Box key={i} sx={{ display: 'flex', gap: 0.8, color: 'rgba(255,255,255,0.5)' }}>
                <span style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>{time}</span>
                <span style={{ color, flexShrink: 0, fontWeight: 600 }}>[{entry.source}]</span>
                <span style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{arrow}</span>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>{entry.message}</span>
              </Box>
            );
          })}
          {logs.length === 0 && (
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.15)' }}>
              Waiting for events...
            </Typography>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
