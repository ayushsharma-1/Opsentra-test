/**
 * Phase 5: Frontend-Client - ServiceTab Component - Generated September 2025
 * 
 * Service-specific log display and management component
 * Features:
 * - Real-time log streaming with virtual scrolling
 * - Advanced filtering and search functionality
 * - Log level statistics and service status indicators
 * - Export functionality and log management
 * - Responsive design with mobile-friendly controls
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Button,
  Badge,
  Toolbar,
  Divider,
  Grid,
  Card,
  CardContent,
  Fab,
  Collapse,
  Alert,
  LinearProgress,
  Tooltip,
  Stack
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  Download as DownloadIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  VerticalAlignBottom as ScrollDownIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';

import { getLogLevelColor, getStatusColor } from '../theme/theme';
import LogItem from './LogItem';

/**
 * Debounced search hook
 */
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Virtual scrolling hook for performance with large log lists
 */
const useVirtualScrolling = (items, containerHeight = 600, itemHeight = 80) => {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef(null);

  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(startIndex + visibleCount + 5, items.length); // Buffer of 5 items

  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex).map((item, index) => ({
      ...item,
      virtualIndex: startIndex + index
    }));
  }, [items, startIndex, endIndex]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  const scrollToTop = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, []);

  return {
    scrollRef,
    visibleItems,
    totalHeight: items.length * itemHeight,
    startIndex,
    scrollTop,
    setScrollTop,
    scrollToBottom,
    scrollToTop
  };
};

/**
 * Log level statistics component
 */
const LogLevelStats = ({ logs }) => {
  const stats = useMemo(() => {
    const counts = logs.reduce((acc, log) => {
      const level = log.level.toLowerCase();
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts).map(([level, count]) => ({
      level,
      count,
      color: getLogLevelColor(level)
    })).sort((a, b) => b.count - a.count);
  }, [logs]);

  if (stats.length === 0) {
    return null;
  }

  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
      {stats.map(({ level, count, color }) => (
        <Chip
          key={level}
          label={`${level.toUpperCase()}: ${count}`}
          size="small"
          sx={{
            bgcolor: `${color}15`,
            color: color,
            fontWeight: 600,
            '& .MuiChip-label': {
              fontSize: '0.75rem'
            }
          }}
        />
      ))}
    </Stack>
  );
};

/**
 * Filter controls component
 */
const FilterControls = ({ 
  searchTerm, 
  setSearchTerm, 
  selectedLevels, 
  setSelectedLevels, 
  availableLevels,
  onClear 
}) => {
  const [filterExpanded, setFilterExpanded] = useState(false);

  const handleLevelToggle = useCallback((level) => {
    setSelectedLevels(prev => {
      if (prev.includes(level)) {
        return prev.filter(l => l !== level);
      } else {
        return [...prev, level];
      }
    });
  }, [setSelectedLevels]);

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        {/* Search Field */}
        <TextField
          placeholder="Search logs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
          sx={{ flex: 1 }}
          InputProps={{
            startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />,
            endAdornment: searchTerm && (
              <IconButton size="small" onClick={() => setSearchTerm('')}>
                <ClearIcon />
              </IconButton>
            )
          }}
        />

        {/* Filter Toggle */}
        <Button
          startIcon={<FilterIcon />}
          endIcon={filterExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          onClick={() => setFilterExpanded(!filterExpanded)}
          variant={selectedLevels.length > 0 ? 'contained' : 'outlined'}
          size="small"
        >
          Filters {selectedLevels.length > 0 && `(${selectedLevels.length})`}
        </Button>

        {/* Clear Filters */}
        {(searchTerm || selectedLevels.length > 0) && (
          <Button
            startIcon={<ClearIcon />}
            onClick={onClear}
            size="small"
            color="secondary"
          >
            Clear
          </Button>
        )}
      </Box>

      {/* Expanded Filter Controls */}
      <Collapse in={filterExpanded}>
        <Box sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
            Log Levels
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {availableLevels.map(level => (
              <Chip
                key={level}
                label={level.toUpperCase()}
                onClick={() => handleLevelToggle(level)}
                clickable
                variant={selectedLevels.includes(level) ? 'filled' : 'outlined'}
                sx={{
                  bgcolor: selectedLevels.includes(level) ? `${getLogLevelColor(level)}20` : 'transparent',
                  borderColor: getLogLevelColor(level),
                  color: getLogLevelColor(level),
                  '&:hover': {
                    bgcolor: `${getLogLevelColor(level)}30`
                  }
                }}
              />
            ))}
          </Stack>
        </Box>
      </Collapse>
    </Paper>
  );
};

/**
 * Main ServiceTab Component
 */
const ServiceTab = ({ service, isConnected, onRefresh }) => {
  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLevels, setSelectedLevels] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedLogs, setExpandedLogs] = useState(new Set());

  // Debounced search
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Available log levels from service
  const availableLevels = useMemo(() => {
    return Array.from(service.levels || []).sort();
  }, [service.levels]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    let logs = service.logs || [];

    // Apply search filter
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      logs = logs.filter(log =>
        log.message.toLowerCase().includes(searchLower) ||
        log.service.toLowerCase().includes(searchLower) ||
        Object.values(log.metadata || {}).some(value =>
          String(value).toLowerCase().includes(searchLower)
        )
      );
    }

    // Apply level filter
    if (selectedLevels.length > 0) {
      logs = logs.filter(log => selectedLevels.includes(log.level.toLowerCase()));
    }

    return logs;
  }, [service.logs, debouncedSearch, selectedLevels]);

  // Virtual scrolling
  const {
    scrollRef,
    visibleItems,
    totalHeight,
    scrollToBottom,
    scrollToTop,
    setScrollTop
  } = useVirtualScrolling(filteredLogs, 600, 120);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && !isPaused) {
      scrollToBottom();
    }
  }, [service.logs?.length, autoScroll, isPaused, scrollToBottom]);

  // Handle scroll events
  const handleScroll = useCallback((event) => {
    const { scrollTop, scrollHeight, clientHeight } = event.target;
    setScrollTop(scrollTop);
    
    // Disable auto-scroll if user scrolls up
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 50;
    if (!isAtBottom && autoScroll) {
      setAutoScroll(false);
    }
  }, [setScrollTop, autoScroll]);

  // Clear filters
  const handleClearFilters = useCallback(() => {
    setSearchTerm('');
    setSelectedLevels([]);
  }, []);

  // Export logs
  const handleExportLogs = useCallback(() => {
    const logData = filteredLogs.map(log => ({
      timestamp: log.timestamp.toISOString(),
      level: log.level,
      service: log.service,
      message: log.message,
      metadata: log.metadata
    }));

    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${service.name}-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [filteredLogs, service.name]);

  // Toggle log expansion
  const handleLogToggle = useCallback((logId, expanded) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (expanded) {
        newSet.add(logId);
      } else {
        newSet.delete(logId);
      }
      return newSet;
    });
  }, []);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Service Header */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container alignItems="center" spacing={2}>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  bgcolor: getStatusColor(service.status),
                  flexShrink: 0
                }}
              />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {service.name}
              </Typography>
              <Chip
                label={service.status.toUpperCase()}
                size="small"
                sx={{
                  bgcolor: `${getStatusColor(service.status)}20`,
                  color: getStatusColor(service.status),
                  fontWeight: 600
                }}
              />
            </Box>
            {service.lastUpdate && (
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                Last update: {service.lastUpdate.toLocaleTimeString()}
              </Typography>
            )}
          </Grid>

          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <Typography variant="body2" color="textSecondary" sx={{ mr: 2 }}>
                {filteredLogs.length} / {service.logs?.length || 0} logs
              </Typography>
              
              <Tooltip title="Export Logs">
                <IconButton size="small" onClick={handleExportLogs}>
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Refresh Service">
                <IconButton size="small" onClick={onRefresh}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>
        </Grid>

        {/* Log Level Statistics */}
        <Box sx={{ mt: 2 }}>
          <LogLevelStats logs={service.logs || []} />
        </Box>
      </Paper>

      {/* Filter Controls */}
      <FilterControls
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedLevels={selectedLevels}
        setSelectedLevels={setSelectedLevels}
        availableLevels={availableLevels}
        onClear={handleClearFilters}
      />

      {/* Connection Status */}
      {!isConnected && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Disconnected from log stream. Some logs may be missing.
        </Alert>
      )}

      {/* Log Display Area */}
      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Toolbar */}
        <Toolbar variant="dense" sx={{ minHeight: '48px !important' }}>
          <Typography variant="subtitle2" sx={{ flex: 1 }}>
            {filteredLogs.length} logs
          </Typography>
          
          <Button
            startIcon={isPaused ? <PlayIcon /> : <PauseIcon />}
            onClick={() => setIsPaused(!isPaused)}
            size="small"
            variant={isPaused ? 'contained' : 'outlined'}
          >
            {isPaused ? 'Resume' : 'Pause'}
          </Button>
        </Toolbar>

        <Divider />

        {/* Virtual Scrolled Log List */}
        <Box
          ref={scrollRef}
          sx={{
            flex: 1,
            overflow: 'auto',
            position: 'relative'
          }}
          onScroll={handleScroll}
        >
          {filteredLogs.length === 0 ? (
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              height: '100%',
              flexDirection: 'column',
              color: 'text.secondary'
            }}>
              <Typography variant="h6" gutterBottom>
                No logs found
              </Typography>
              <Typography variant="body2">
                {searchTerm || selectedLevels.length > 0 ? 
                  'Try adjusting your filters' : 
                  'Waiting for log messages...'}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ height: totalHeight, position: 'relative' }}>
              <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
                {visibleItems.map((log) => (
                  <Box
                    key={log.id}
                    sx={{
                      position: 'absolute',
                      top: log.virtualIndex * 120,
                      left: 0,
                      right: 0,
                      px: 2,
                      py: 1
                    }}
                  >
                    <LogItem
                      log={log}
                      expanded={expandedLogs.has(log.id)}
                      onToggle={handleLogToggle}
                      compact={false}
                    />
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </Paper>

      {/* Floating Action Button for Auto-Scroll */}
      {!autoScroll && (
        <Fab
          color="primary"
          size="small"
          onClick={() => {
            setAutoScroll(true);
            scrollToBottom();
          }}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1000
          }}
        >
          <ScrollDownIcon />
        </Fab>
      )}
    </Box>
  );
};

export default ServiceTab;