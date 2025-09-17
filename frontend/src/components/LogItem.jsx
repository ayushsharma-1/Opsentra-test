/**
 * Phase 5: Frontend-Client - LogItem Component - Generated September 2025
 * 
 * Expandable accordion-style log entry component
 * Features:
 * - Material-UI Accordion with custom styling
 * - Syntax highlighting for structured log content
 * - Metadata display with copy functionality
 * - Log level color coding and icons
 * - Timestamp formatting with relative time
 * - Accessibility features and ARIA support
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Box,
  Chip,
  IconButton,
  Tooltip,
  Paper,
  Divider,
  Grid,
  Collapse
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ContentCopy as CopyIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  BugReport as DebugIcon,
  Timeline as TraceIcon,
  CheckCircle as SuccessIcon
} from '@mui/icons-material';

import { getLogLevelColor } from '../theme/theme';

/**
 * Get icon for log level
 */
const getLogLevelIcon = (level) => {
  switch (level?.toLowerCase()) {
    case 'error': return ErrorIcon;
    case 'warning': return WarningIcon;
    case 'info': return InfoIcon;
    case 'debug': return DebugIcon;
    case 'trace': return TraceIcon;
    case 'success': return SuccessIcon;
    default: return InfoIcon;
  }
};

/**
 * Format timestamp with relative time
 */
const formatTimestamp = (timestamp) => {
  const now = new Date();
  const logTime = new Date(timestamp);
  const diff = now - logTime;
  
  // Relative time formatting
  if (diff < 60000) { // Less than 1 minute
    return `${Math.floor(diff / 1000)}s ago`;
  } else if (diff < 3600000) { // Less than 1 hour
    return `${Math.floor(diff / 60000)}m ago`;
  } else if (diff < 86400000) { // Less than 1 day
    return `${Math.floor(diff / 3600000)}h ago`;
  } else {
    return logTime.toLocaleDateString();
  }
};

/**
 * Format full timestamp for detailed view
 */
const formatFullTimestamp = (timestamp) => {
  return new Date(timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  });
};

/**
 * Syntax highlight JSON content
 */
const SyntaxHighlighter = ({ content, maxHeight = 200 }) => {
  const [expanded, setExpanded] = useState(false);
  
  const formattedContent = useMemo(() => {
    try {
      if (typeof content === 'string') {
        // Try to parse as JSON for better formatting
        const parsed = JSON.parse(content);
        return JSON.stringify(parsed, null, 2);
      }
      return JSON.stringify(content, null, 2);
    } catch {
      return String(content);
    }
  }, [content]);

  const shouldTruncate = formattedContent.split('\n').length > 10;

  return (
    <Paper
      variant="outlined"
      sx={{
        bgcolor: 'grey.50',
        p: 1,
        fontFamily: 'monospace',
        fontSize: '0.8rem',
        maxHeight: expanded ? 'none' : maxHeight,
        overflow: 'auto',
        position: 'relative'
      }}
    >
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {formattedContent}
      </pre>
      {shouldTruncate && (
        <Box sx={{ mt: 1, textAlign: 'center' }}>
          <Typography
            variant="caption"
            sx={{
              color: 'primary.main',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Show less' : 'Show more'}
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

/**
 * Metadata display component
 */
const MetadataDisplay = ({ metadata }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, []);

  if (!metadata || Object.keys(metadata).length === 0) {
    return (
      <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic' }}>
        No metadata available
      </Typography>
    );
  }

  return (
    <Grid container spacing={2}>
      {Object.entries(metadata).map(([key, value]) => (
        <Grid item xs={12} sm={6} md={4} key={key}>
          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 500 }}>
              {key}:
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: typeof value === 'object' ? 'monospace' : 'inherit',
                  flex: 1,
                  wordBreak: 'break-word'
                }}
              >
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </Typography>
              <Tooltip title={copied ? 'Copied!' : 'Copy value'}>
                <IconButton
                  size="small"
                  onClick={() => handleCopy(typeof value === 'object' ? JSON.stringify(value) : String(value))}
                  sx={{ ml: 1 }}
                >
                  <CopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Grid>
      ))}
    </Grid>
  );
};

/**
 * Main LogItem Component
 */
const LogItem = React.memo(({ 
  log, 
  expanded = false, 
  onToggle,
  showTimestamp = true,
  compact = false 
}) => {
  const [isExpanded, setIsExpanded] = useState(expanded);
  const [messageCopied, setMessageCopied] = useState(false);

  // Memoized values
  const logLevelColor = useMemo(() => getLogLevelColor(log.level), [log.level]);
  const LogLevelIcon = useMemo(() => getLogLevelIcon(log.level), [log.level]);
  const relativeTime = useMemo(() => formatTimestamp(log.timestamp), [log.timestamp]);
  const fullTimestamp = useMemo(() => formatFullTimestamp(log.timestamp), [log.timestamp]);

  // Handle expansion toggle
  const handleExpansionToggle = useCallback((event, expanded) => {
    setIsExpanded(expanded);
    onToggle?.(log.id, expanded);
  }, [log.id, onToggle]);

  // Handle message copy
  const handleCopyMessage = useCallback(async (event) => {
    event.stopPropagation(); // Prevent accordion toggle
    try {
      await navigator.clipboard.writeText(log.message);
      setMessageCopied(true);
      setTimeout(() => setMessageCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  }, [log.message]);

  // Truncate long messages for summary
  const truncatedMessage = useMemo(() => {
    if (log.message.length > 150) {
      return log.message.substring(0, 150) + '...';
    }
    return log.message;
  }, [log.message]);

  return (
    <Accordion
      expanded={isExpanded}
      onChange={handleExpansionToggle}
      sx={{
        '&:before': {
          display: 'none' // Remove default divider
        },
        border: `1px solid transparent`,
        borderLeftColor: logLevelColor,
        borderLeftWidth: 4,
        mb: 1,
        '&.Mui-expanded': {
          borderColor: logLevelColor,
          boxShadow: `0 2px 8px ${logLevelColor}20`
        }
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{
          '& .MuiAccordionSummary-content': {
            alignItems: 'center',
            gap: 1
          }
        }}
      >
        {/* Log Level Icon and Chip */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <LogLevelIcon
            sx={{
              color: logLevelColor,
              fontSize: '1.25rem',
              flexShrink: 0
            }}
          />
          <Chip
            label={log.level.toUpperCase()}
            size="small"
            sx={{
              bgcolor: `${logLevelColor}15`,
              color: logLevelColor,
              fontWeight: 600,
              minWidth: 60,
              flexShrink: 0
            }}
          />
        </Box>

        {/* Message Preview */}
        <Typography
          variant="body2"
          sx={{
            flex: 1,
            mx: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: compact ? 'nowrap' : 'normal',
            fontFamily: log.message.includes('{') || log.message.includes('[') ? 'monospace' : 'inherit'
          }}
        >
          {isExpanded ? log.message : truncatedMessage}
        </Typography>

        {/* Timestamp and Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          {showTimestamp && (
            <Tooltip title={fullTimestamp}>
              <Typography
                variant="caption"
                color="textSecondary"
                sx={{
                  minWidth: 60,
                  textAlign: 'right',
                  fontFamily: 'monospace'
                }}
              >
                {relativeTime}
              </Typography>
            </Tooltip>
          )}

          <Tooltip title={messageCopied ? 'Copied!' : 'Copy message'}>
            <IconButton
              size="small"
              onClick={handleCopyMessage}
              sx={{
                opacity: 0.6,
                '&:hover': { opacity: 1 }
              }}
            >
              <CopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </AccordionSummary>

      <AccordionDetails sx={{ pt: 0 }}>
        <Box>
          {/* Full Message */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
              Message
            </Typography>
            {log.message.length > 100 || log.message.includes('\n') ? (
              <SyntaxHighlighter content={log.message} />
            ) : (
              <Typography
                variant="body2"
                sx={{
                  p: 1,
                  bgcolor: 'grey.50',
                  borderRadius: 1,
                  fontFamily: log.message.includes('{') || log.message.includes('[') ? 'monospace' : 'inherit'
                }}
              >
                {log.message}
              </Typography>
            )}
          </Box>

          {/* Metadata */}
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
            Metadata
          </Typography>
          <MetadataDisplay metadata={{
            timestamp: fullTimestamp,
            service: log.service,
            level: log.level,
            id: log.id,
            ...log.metadata
          }} />
        </Box>
      </AccordionDetails>
    </Accordion>
  );
});

LogItem.displayName = 'LogItem';

export default LogItem;