/**
 * Phase 5: Frontend-Client - Modern White/Black Theme - Generated September 2025
 * 
 * Material-UI theme configuration for OpSentra Dashboard
 * Features:
 * - Modern white/black aesthetic with subtle grays
 * - High contrast for accessibility (WCAG AA compliant)
 * - Custom color palette for log levels and status indicators
 * - Responsive breakpoints optimized for dashboard layouts
 * - Enhanced typography with proper hierarchy
 */

import { createTheme } from '@mui/material/styles';

// Color palette constants
const colors = {
  // Primary theme colors - modern black/white with blue accent
  primary: {
    main: '#1976d2', // OpSentra brand blue
    dark: '#115293',
    light: '#42a5f5',
    contrastText: '#ffffff'
  },
  
  // Background colors - clean white/black theme
  background: {
    default: '#ffffff',   // Main background - pure white
    paper: '#f8f9fa',     // Card/paper backgrounds - subtle gray
    elevated: '#ffffff',   // Elevated surfaces
    dark: '#121212',      // Dark mode background
    darker: '#000000'     // Pure black for high contrast
  },
  
  // Surface colors for components
  surface: {
    primary: '#ffffff',
    secondary: '#f5f5f5',
    tertiary: '#eeeeee',
    border: '#e0e0e0'
  },
  
  // Text colors - high contrast for readability
  text: {
    primary: '#212121',     // Primary text - near black
    secondary: '#757575',   // Secondary text - medium gray
    disabled: '#bdbdbd',    // Disabled text
    hint: '#9e9e9e',       // Hint text
    inverse: '#ffffff'      // White text for dark backgrounds
  },
  
  // Log level colors - semantic color coding
  logLevels: {
    error: '#d32f2f',      // Red for errors
    warning: '#f57c00',    // Orange for warnings
    info: '#1976d2',       // Blue for info
    debug: '#388e3c',      // Green for debug
    trace: '#7b1fa2',      // Purple for trace
    success: '#2e7d32'     // Green for success
  },
  
  // Status indicators
  status: {
    online: '#4caf50',     // Green for online/connected
    offline: '#f44336',    // Red for offline/error
    pending: '#ff9800',    // Orange for pending/connecting
    unknown: '#9e9e9e'     // Gray for unknown status
  },
  
  // Interactive elements
  interactive: {
    hover: 'rgba(25, 118, 210, 0.04)',
    selected: 'rgba(25, 118, 210, 0.08)',
    focus: 'rgba(25, 118, 210, 0.12)',
    pressed: 'rgba(25, 118, 210, 0.16)'
  }
};

// Create the main theme
export const opsentraTheme = createTheme({
  palette: {
    mode: 'light',
    primary: colors.primary,
    secondary: {
      main: '#424242',
      dark: '#1c1c1c',
      light: '#6d6d6d',
      contrastText: '#ffffff'
    },
    error: {
      main: colors.logLevels.error,
      dark: '#b71c1c',
      light: '#ef5350'
    },
    warning: {
      main: colors.logLevels.warning,
      dark: '#e65100',
      light: '#ffb74d'
    },
    info: {
      main: colors.logLevels.info,
      dark: '#0d47a1',
      light: '#64b5f6'
    },
    success: {
      main: colors.logLevels.success,
      dark: '#1b5e20',
      light: '#81c784'
    },
    background: {
      default: colors.background.default,
      paper: colors.background.paper
    },
    text: colors.text,
    divider: colors.surface.border,
    
    // Custom colors for log levels
    logLevel: colors.logLevels,
    status: colors.status
  },
  
  // Typography - modern and readable
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
    
    // Headings
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      lineHeight: 1.2,
      color: colors.text.primary
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      lineHeight: 1.3,
      color: colors.text.primary
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.4,
      color: colors.text.primary
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 500,
      lineHeight: 1.4,
      color: colors.text.primary
    },
    h5: {
      fontSize: '1.125rem',
      fontWeight: 500,
      lineHeight: 1.4,
      color: colors.text.primary
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 500,
      lineHeight: 1.5,
      color: colors.text.primary
    },
    
    // Body text
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
      color: colors.text.primary
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
      color: colors.text.secondary
    },
    
    // Specialized typography
    subtitle1: {
      fontSize: '1rem',
      fontWeight: 500,
      lineHeight: 1.5,
      color: colors.text.primary
    },
    subtitle2: {
      fontSize: '0.875rem',
      fontWeight: 500,
      lineHeight: 1.4,
      color: colors.text.secondary
    },
    caption: {
      fontSize: '0.75rem',
      lineHeight: 1.4,
      color: colors.text.secondary
    },
    overline: {
      fontSize: '0.75rem',
      fontWeight: 500,
      lineHeight: 1.4,
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      color: colors.text.secondary
    },
    
    // Monospace for log content
    monospace: {
      fontFamily: '"JetBrains Mono", "Consolas", "Monaco", monospace',
      fontSize: '0.875rem',
      lineHeight: 1.4
    }
  },
  
  // Spacing scale
  spacing: 8, // 8px base unit
  
  // Component shape
  shape: {
    borderRadius: 8 // Slightly rounded corners for modern look
  },
  
  // Breakpoints for responsive design
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 960,
      lg: 1280,
      xl: 1920
    }
  },
  
  // Z-index scale
  zIndex: {
    appBar: 1100,
    drawer: 1200,
    modal: 1300,
    snackbar: 1400,
    tooltip: 1500
  },
  
  // Component customizations
  components: {
    // AppBar customization
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: colors.background.default,
          color: colors.text.primary,
          boxShadow: `0 1px 3px rgba(0, 0, 0, 0.1)`,
          borderBottom: `1px solid ${colors.surface.border}`
        }
      }
    },
    
    // Toolbar customization
    MuiToolbar: {
      styleOverrides: {
        root: {
          minHeight: '64px !important',
          paddingLeft: '24px !important',
          paddingRight: '24px !important'
        }
      }
    },
    
    // Paper (cards, surfaces) customization
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: colors.background.paper,
          border: `1px solid ${colors.surface.border}`,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
        },
        elevation1: {
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
        },
        elevation2: {
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
        },
        elevation3: {
          boxShadow: '0 6px 16px rgba(0, 0, 0, 0.1)'
        }
      }
    },
    
    // Tabs customization
    MuiTabs: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${colors.surface.border}`,
          backgroundColor: colors.background.paper
        },
        indicator: {
          backgroundColor: colors.primary.main,
          height: 3
        }
      }
    },
    
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontSize: '0.875rem',
          fontWeight: 500,
          minHeight: 48,
          color: colors.text.secondary,
          '&.Mui-selected': {
            color: colors.primary.main,
            fontWeight: 600
          },
          '&:hover': {
            backgroundColor: colors.interactive.hover,
            color: colors.primary.main
          }
        }
      }
    },
    
    // Accordion customization for log entries
    MuiAccordion: {
      styleOverrides: {
        root: {
          backgroundColor: colors.background.paper,
          border: `1px solid ${colors.surface.border}`,
          borderRadius: '8px !important',
          margin: '8px 0',
          '&:before': {
            display: 'none'
          },
          '&.Mui-expanded': {
            margin: '16px 0'
          }
        }
      }
    },
    
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          padding: '0 16px',
          minHeight: 56,
          '&.Mui-expanded': {
            minHeight: 56
          }
        },
        content: {
          margin: '12px 0',
          '&.Mui-expanded': {
            margin: '12px 0'
          }
        }
      }
    },
    
    MuiAccordionDetails: {
      styleOverrides: {
        root: {
          padding: '0 16px 16px 16px',
          borderTop: `1px solid ${colors.surface.border}`
        }
      }
    },
    
    // Button customization
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 6,
          fontWeight: 500
        },
        containedPrimary: {
          backgroundColor: colors.primary.main,
          color: colors.primary.contrastText,
          boxShadow: '0 2px 4px rgba(25, 118, 210, 0.2)',
          '&:hover': {
            backgroundColor: colors.primary.dark,
            boxShadow: '0 4px 8px rgba(25, 118, 210, 0.3)'
          }
        }
      }
    },
    
    // TextField customization
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: colors.background.default,
            '& fieldset': {
              borderColor: colors.surface.border
            },
            '&:hover fieldset': {
              borderColor: colors.primary.main
            },
            '&.Mui-focused fieldset': {
              borderColor: colors.primary.main
            }
          }
        }
      }
    },
    
    // Chip customization for tags/labels
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          fontWeight: 500
        }
      }
    },
    
    // Snackbar for notifications
    MuiSnackbar: {
      styleOverrides: {
        root: {
          '& .MuiSnackbarContent-root': {
            backgroundColor: colors.text.primary,
            color: colors.text.inverse
          }
        }
      }
    }
  }
});

// Dark theme variant (future enhancement)
export const opsentraDarkTheme = createTheme({
  ...opsentraTheme,
  palette: {
    ...opsentraTheme.palette,
    mode: 'dark',
    background: {
      default: colors.background.dark,
      paper: colors.background.darker
    },
    text: {
      primary: colors.text.inverse,
      secondary: '#b0b0b0'
    }
  }
});

// Export color constants for use in components
export { colors };

// Utility function to get log level color
export const getLogLevelColor = (level) => {
  const normalizedLevel = level?.toLowerCase() || 'info';
  return colors.logLevels[normalizedLevel] || colors.logLevels.info;
};

// Utility function to get status color
export const getStatusColor = (status) => {
  const normalizedStatus = status?.toLowerCase() || 'unknown';
  return colors.status[normalizedStatus] || colors.status.unknown;
};