/**
 * Phase 5: Frontend-Client - Main App Component - Generated September 2025
 * 
 * OpSentra Dashboard Main Application
 * Features:
 * - React 19.1.0 with Suspense and concurrent features
 * - Material-UI 7.3.2 theming integration
 * - Real-time log streaming via Server-Sent Events
 * - Service management with tabbed interface
 * - Modern white/black responsive design
 */

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import {
  ThemeProvider,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Tabs,
  Tab,
  Paper,
  IconButton,
  Badge,
  Snackbar,
  Alert,
  LinearProgress,
  Tooltip
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Dashboard as DashboardIcon,
  CloudOff as DisconnectedIcon,
  Cloud as ConnectedIcon
} from '@mui/icons-material';

// Import theme and hooks
import { opsentraTheme, getStatusColor } from './theme/theme';
import useSSE from './hooks/useSSE';

// Lazy load components for code splitting
const ServiceTab = React.lazy(() => import('./components/ServiceTab'));
const SettingsDialog = React.lazy(() => import('./components/SettingsDialog'));

/**
 * Main Application Component
 * Manages global state, SSE connections, and service tabs
 */
function App() {
  // State management
  const [services, setServices] = useState(new Map());
  const [activeService, setActiveService] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [isRefreshing, setIsRefreshing] = useState(false);

  // SSE connection for real-time log streaming
  const {
    isConnected,
    isConnecting,
    connectionCount,
    lastHeartbeat,
    connect,
    disconnect,
    subscribe,
    unsubscribe
  } = useSSE('http://localhost:8002/api/logs/stream');

  /**
   * Handle incoming log messages from SSE stream
   */
  const handleLogMessage = useCallback((data) => {
    try {
      const logEntry = JSON.parse(data);
      const { service_name: serviceName, timestamp, level, message, metadata = {} } = logEntry;

      if (!serviceName) return;

      setServices(prev => {
        const updated = new Map(prev);
        const existing = updated.get(serviceName) || {
          name: serviceName,
          status: 'online',
          logCount: 0,
          lastUpdate: null,
          logs: [],
          levels: new Set()
        };

        // Add new log entry
        const newLog = {
          id: `${serviceName}-${Date.now()}-${Math.random()}`,
          timestamp: new Date(timestamp),
          level: level.toLowerCase(),
          message,
          metadata,
          service: serviceName
        };

        // Update service data
        existing.logs.unshift(newLog); // Add to beginning for newest first
        existing.logs = existing.logs.slice(0, 1000); // Keep last 1000 logs
        existing.logCount = existing.logs.length;
        existing.lastUpdate = new Date();
        existing.levels.add(level.toLowerCase());
        existing.status = 'online';

        updated.set(serviceName, existing);
        return updated;
      });
    } catch (error) {
      console.error('Error processing log message:', error);
      showSnackbar('Error processing log message', 'error');
    }
  }, []);

  /**
   * Handle SSE connection status changes
   */
  const handleConnectionChange = useCallback((connected) => {
    if (connected) {
      showSnackbar('Connected to log stream', 'success');
    } else {
      showSnackbar('Disconnected from log stream', 'warning');
      // Mark all services as potentially offline
      setServices(prev => {
        const updated = new Map(prev);
        for (const [serviceName, service] of updated) {
          service.status = 'unknown';
        }
        return updated;
      });
    }
  }, []);

  /**
   * Subscribe to SSE messages on mount
   */
  useEffect(() => {
    const unsubscribeLog = subscribe('log', handleLogMessage);
    const unsubscribeStatus = subscribe('connection', handleConnectionChange);

    return () => {
      unsubscribeLog();
      unsubscribeStatus();
    };
  }, [subscribe, handleLogMessage, handleConnectionChange]);

  /**
   * Auto-select first service when services change
   */
  useEffect(() => {
    if (!activeService && services.size > 0) {
      const firstService = Array.from(services.keys())[0];
      setActiveService(firstService);
    }
  }, [services, activeService]);

  /**
   * Show snackbar notification
   */
  const showSnackbar = useCallback((message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  /**
   * Close snackbar
   */
  const handleSnackbarClose = useCallback(() => {
    setSnackbar(prev => ({ ...prev, open: false }));
  }, []);

  /**
   * Handle tab change
   */
  const handleTabChange = useCallback((event, newValue) => {
    setActiveService(newValue);
  }, []);

  /**
   * Handle refresh button click
   */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Reconnect SSE
      await disconnect();
      setTimeout(() => {
        connect();
      }, 1000);
      showSnackbar('Refreshing connection...', 'info');
    } catch (error) {
      console.error('Error refreshing:', error);
      showSnackbar('Error refreshing connection', 'error');
    } finally {
      setTimeout(() => setIsRefreshing(false), 2000);
    }
  }, [connect, disconnect]);

  /**
   * Get connection status icon and color
   */
  const connectionStatus = useMemo(() => {
    if (isConnecting) {
      return { icon: RefreshIcon, color: 'warning.main', text: 'Connecting...' };
    }
    if (isConnected) {
      return { icon: ConnectedIcon, color: 'success.main', text: `Connected (${connectionCount} reconnects)` };
    }
    return { icon: DisconnectedIcon, color: 'error.main', text: 'Disconnected' };
  }, [isConnected, isConnecting, connectionCount]);

  /**
   * Get service list as sorted array
   */
  const serviceList = useMemo(() => {
    return Array.from(services.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [services]);

  /**
   * Get active service data
   */
  const activeServiceData = useMemo(() => {
    return activeService ? services.get(activeService) : null;
  }, [services, activeService]);

  return (
    <ThemeProvider theme={opsentraTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        
        {/* App Bar */}
        <AppBar position="static" elevation={1}>
          <Toolbar>
            <DashboardIcon sx={{ mr: 2 }} />
            <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
              OpSentra Dashboard
            </Typography>
            
            {/* Connection Status */}
            <Tooltip title={connectionStatus.text}>
              <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                <connectionStatus.icon 
                  sx={{ 
                    color: connectionStatus.color, 
                    mr: 1,
                    animation: isConnecting ? 'spin 2s linear infinite' : 'none'
                  }} 
                />
                <Typography variant="body2" color="textSecondary">
                  {serviceList.length} services
                </Typography>
              </Box>
            </Tooltip>

            {/* Action Buttons */}
            <Tooltip title="Refresh Connection">
              <IconButton
                color="inherit"
                onClick={handleRefresh}
                disabled={isRefreshing}
                sx={{ mr: 1 }}
              >
                <RefreshIcon 
                  sx={{ 
                    animation: isRefreshing ? 'spin 1s linear infinite' : 'none' 
                  }} 
                />
              </IconButton>
            </Tooltip>

            <Tooltip title="Settings">
              <IconButton
                color="inherit"
                onClick={() => setSettingsOpen(true)}
              >
                <SettingsIcon />
              </IconButton>
            </Tooltip>
          </Toolbar>

          {/* Loading bar for refresh */}
          {isRefreshing && (
            <LinearProgress 
              sx={{ 
                position: 'absolute', 
                bottom: 0, 
                left: 0, 
                right: 0, 
                height: 2 
              }} 
            />
          )}
        </AppBar>

        {/* Service Tabs */}
        {serviceList.length > 0 && (
          <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Container maxWidth="xl">
              <Tabs
                value={activeService}
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ minHeight: 48 }}
              >
                {serviceList.map((service) => (
                  <Tab
                    key={service.name}
                    value={service.name}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: getStatusColor(service.status),
                            mr: 1
                          }}
                        />
                        {service.name}
                        <Badge
                          badgeContent={service.logCount}
                          color="primary"
                          max={999}
                          sx={{ ml: 1 }}
                        >
                          <Box sx={{ width: 16 }} />
                        </Badge>
                      </Box>
                    }
                    sx={{
                      textTransform: 'none',
                      minHeight: 48,
                      fontSize: '0.875rem'
                    }}
                  />
                ))}
              </Tabs>
            </Container>
          </Box>
        )}

        {/* Main Content Area */}
        <Container maxWidth="xl" sx={{ flex: 1, py: 2 }}>
          {serviceList.length === 0 ? (
            /* No Services State */
            <Paper
              sx={{
                height: '60vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                p: 4
              }}
            >
              <DisconnectedIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h5" color="textSecondary" gutterBottom>
                No Services Connected
              </Typography>
              <Typography variant="body1" color="textSecondary" sx={{ mb: 2 }}>
                {isConnected ? 
                  'Waiting for log messages from services...' : 
                  'Connecting to log stream...'}
              </Typography>
              {!isConnected && (
                <Box sx={{ mt: 2 }}>
                  <LinearProgress sx={{ width: 200 }} />
                </Box>
              )}
            </Paper>
          ) : (
            /* Service Tab Content */
            <Suspense fallback={
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <LinearProgress sx={{ width: '100%', maxWidth: 400 }} />
              </Box>
            }>
              {activeServiceData && (
                <ServiceTab
                  service={activeServiceData}
                  isConnected={isConnected}
                  onRefresh={handleRefresh}
                />
              )}
            </Suspense>
          )}
        </Container>

        {/* Settings Dialog */}
        <Suspense fallback={null}>
          <SettingsDialog
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            connectionInfo={{
              isConnected,
              isConnecting,
              connectionCount,
              lastHeartbeat,
              serviceCount: serviceList.length
            }}
          />
        </Suspense>

        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleSnackbarClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            onClose={handleSnackbarClose}
            severity={snackbar.severity}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>

      {/* Global styles for animations */}
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </ThemeProvider>
  );
}

export default App