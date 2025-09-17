/**
 * Phase 5: Frontend-Client - SettingsDialog Component - Generated September 2025
 * 
 * Settings and configuration dialog for the OpSentra Dashboard
 * Features:
 * - Connection status and diagnostics
 * - Theme and display preferences
 * - Log management settings
 * - Export and data management options
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Divider,
  Grid,
  Card,
  CardContent,
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Switch,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Close as CloseIcon,
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  CloudSync as CloudSyncIcon
} from '@mui/icons-material';

/**
 * Connection Status Card
 */
const ConnectionStatusCard = ({ connectionInfo }) => {
  const {
    isConnected,
    isConnecting,
    connectionCount,
    lastHeartbeat,
    serviceCount
  } = connectionInfo;

  const getConnectionStatus = () => {
    if (isConnecting) {
      return {
        icon: RefreshIcon,
        color: 'warning.main',
        text: 'Connecting...',
        severity: 'warning'
      };
    }
    if (isConnected) {
      return {
        icon: WifiIcon,
        color: 'success.main',
        text: 'Connected',
        severity: 'success'
      };
    }
    return {
      icon: WifiOffIcon,
      color: 'error.main',
      text: 'Disconnected',
      severity: 'error'
    };
  };

  const status = getConnectionStatus();
  const StatusIcon = status.icon;

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <StatusIcon sx={{ color: status.color, mr: 1 }} />
          <Typography variant="h6">Connection Status</Typography>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">
              Status
            </Typography>
            <Chip
              label={status.text}
              color={status.severity}
              size="small"
              sx={{ mt: 0.5 }}
            />
          </Grid>

          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">
              Services
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 500, mt: 0.5 }}>
              {serviceCount}
            </Typography>
          </Grid>

          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">
              Reconnections
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 500, mt: 0.5 }}>
              {connectionCount}
            </Typography>
          </Grid>

          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">
              Last Heartbeat
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 500, mt: 0.5, fontSize: '0.875rem' }}>
              {lastHeartbeat ? 
                new Date(lastHeartbeat).toLocaleTimeString() : 
                'Never'}
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

/**
 * Settings Form Component
 */
const SettingsForm = () => {
  const [settings, setSettings] = useState({
    autoScroll: true,
    showTimestamps: true,
    compactView: false,
    maxLogHistory: 1000,
    refreshInterval: 5,
    enableNotifications: true,
    soundAlerts: false,
    darkMode: false,
    exportFormat: 'json'
  });

  const handleSettingChange = (setting) => (event) => {
    const value = event.target.type === 'checkbox' ? 
      event.target.checked : 
      event.target.value;
    
    setSettings(prev => ({
      ...prev,
      [setting]: value
    }));
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Display Preferences
      </Typography>
      
      <FormGroup>
        <FormControlLabel
          control={
            <Switch
              checked={settings.autoScroll}
              onChange={handleSettingChange('autoScroll')}
            />
          }
          label="Auto-scroll to new logs"
        />
        
        <FormControlLabel
          control={
            <Switch
              checked={settings.showTimestamps}
              onChange={handleSettingChange('showTimestamps')}
            />
          }
          label="Show timestamps"
        />
        
        <FormControlLabel
          control={
            <Switch
              checked={settings.compactView}
              onChange={handleSettingChange('compactView')}
            />
          }
          label="Compact view"
        />
      </FormGroup>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" gutterBottom>
        Performance Settings
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Max Log History"
            type="number"
            value={settings.maxLogHistory}
            onChange={handleSettingChange('maxLogHistory')}
            inputProps={{ min: 100, max: 10000 }}
            helperText="Number of logs to keep per service"
            fullWidth
            size="small"
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small">
            <InputLabel>Export Format</InputLabel>
            <Select
              value={settings.exportFormat}
              onChange={handleSettingChange('exportFormat')}
              label="Export Format"
            >
              <MenuItem value="json">JSON</MenuItem>
              <MenuItem value="csv">CSV</MenuItem>
              <MenuItem value="txt">Plain Text</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" gutterBottom>
        Notifications
      </Typography>

      <FormGroup>
        <FormControlLabel
          control={
            <Switch
              checked={settings.enableNotifications}
              onChange={handleSettingChange('enableNotifications')}
            />
          }
          label="Enable notifications for errors"
        />
        
        <FormControlLabel
          control={
            <Switch
              checked={settings.soundAlerts}
              onChange={handleSettingChange('soundAlerts')}
              disabled={!settings.enableNotifications}
            />
          }
          label="Sound alerts"
        />
      </FormGroup>
    </Box>
  );
};

/**
 * System Information Component
 */
const SystemInformation = () => {
  const systemInfo = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    memoryInfo: performance.memory ? {
      used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
      total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
      limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
    } : null
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        System Information
      </Typography>

      <List dense>
        <ListItem>
          <ListItemIcon>
            <InfoIcon color="primary" />
          </ListItemIcon>
          <ListItemText
            primary="Browser"
            secondary={systemInfo.userAgent.split(' ').slice(-2).join(' ')}
          />
        </ListItem>

        <ListItem>
          <ListItemIcon>
            <InfoIcon color="primary" />
          </ListItemIcon>
          <ListItemText
            primary="Platform"
            secondary={systemInfo.platform}
          />
        </ListItem>

        <ListItem>
          <ListItemIcon>
            <CloudSyncIcon color={systemInfo.onLine ? 'success' : 'error'} />
          </ListItemIcon>
          <ListItemText
            primary="Network Status"
            secondary={systemInfo.onLine ? 'Online' : 'Offline'}
          />
        </ListItem>

        {systemInfo.memoryInfo && (
          <ListItem>
            <ListItemIcon>
              <InfoIcon color="primary" />
            </ListItemIcon>
            <ListItemText
              primary="Memory Usage"
              secondary={`${systemInfo.memoryInfo.used} MB / ${systemInfo.memoryInfo.limit} MB`}
            />
          </ListItem>
        )}
      </List>
    </Box>
  );
};

/**
 * Main Settings Dialog Component
 */
const SettingsDialog = ({ open, onClose, connectionInfo }) => {
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    { label: 'Connection', component: ConnectionStatusCard },
    { label: 'Settings', component: SettingsForm },
    { label: 'System', component: SystemInformation }
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          height: '80vh',
          maxHeight: 600
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        pb: 1
      }}>
        <Typography variant="h6">Dashboard Settings</Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ display: 'flex', height: '100%' }}>
          {/* Tab Navigation */}
          <Box sx={{ 
            width: 200, 
            borderRight: 1, 
            borderColor: 'divider',
            bgcolor: 'grey.50'
          }}>
            <List component="nav">
              {tabs.map((tab, index) => (
                <ListItem
                  key={tab.label}
                  button
                  selected={activeTab === index}
                  onClick={() => setActiveTab(index)}
                  sx={{
                    '&.Mui-selected': {
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      '&:hover': {
                        bgcolor: 'primary.dark'
                      }
                    }
                  }}
                >
                  <ListItemText primary={tab.label} />
                </ListItem>
              ))}
            </List>
          </Box>

          {/* Tab Content */}
          <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
            {activeTab === 0 && (
              <ConnectionStatusCard connectionInfo={connectionInfo} />
            )}
            {activeTab === 1 && <SettingsForm />}
            {activeTab === 2 && <SystemInformation />}
          </Box>
        </Box>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="primary" variant="outlined">
          Close
        </Button>
        <Button onClick={onClose} color="primary" variant="contained">
          Save Settings
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SettingsDialog;