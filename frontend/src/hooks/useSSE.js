/**
 * Phase 5: Frontend-Client - SSE Connection Hook - Generated September 2025
 * 
 * Custom React hook for Server-Sent Events with advanced features:
 * - Auto-reconnection with exponential backoff
 * - Heartbeat detection and handling
 * - Error state management
 * - Connection lifecycle management
 * 
 * Rationale: EventSource with robust error handling per 2025 SSE best practices.
 * Heartbeat implementation prevents proxy timeouts in production environments.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for SSE connection management
 * @param {string} url - SSE endpoint URL
 * @param {Object} options - Configuration options
 * @returns {Object} - { data, error, connectionState, reconnect }
 */
export default function useSSE(url, options = {}) {
  const {
    enabled = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
    heartbeatTimeout = 45000, // 45s - slightly longer than backend 30s heartbeat
    autoReconnect = true
  } = options;

  // State management
  const [data, setData] = useState([]);
  const [error, setError] = useState(null);
  const [connectionState, setConnectionState] = useState('disconnected'); // disconnected, connecting, connected, error
  const [reconnectCount, setReconnectCount] = useState(0);

  // Refs for cleanup and connection management
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const heartbeatTimeoutRef = useRef(null);
  const lastEventTimeRef = useRef(Date.now());

  // Heartbeat monitoring
  // Rationale: Track last event time to detect connection issues
  const resetHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
    }
    
    lastEventTimeRef.current = Date.now();
    
    // Set timeout to detect missing heartbeats
    heartbeatTimeoutRef.current = setTimeout(() => {
      console.warn('SSE: Heartbeat timeout detected, forcing reconnection');
      setError('Heartbeat timeout - connection may be stale');
      setConnectionState('error');
      
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    }, heartbeatTimeout);
  }, [heartbeatTimeout]);

  // Connection establishment
  const connect = useCallback(() => {
    if (!enabled || !url) return;

    // Prevent multiple concurrent connections
    if (eventSourceRef.current?.readyState === EventSource.CONNECTING ||
        eventSourceRef.current?.readyState === EventSource.OPEN) {
      return;
    }

    try {
      setConnectionState('connecting');
      setError(null);

      // Create EventSource with error handling
      const eventSource = new EventSource(url, {
        withCredentials: false // Adjust based on backend CORS settings
      });

      eventSourceRef.current = eventSource;

      // Connection opened successfully
      eventSource.onopen = (event) => {
        console.log('SSE: Connection established', { url, readyState: eventSource.readyState });
        setConnectionState('connected');
        setError(null);
        setReconnectCount(0);
        resetHeartbeat();
      };

      // Message received
      eventSource.onmessage = (event) => {
        resetHeartbeat();

        // Handle heartbeat messages (empty or colon-prefixed)
        if (!event.data || event.data.trim() === '' || event.data.startsWith(':')) {
          console.debug('SSE: Heartbeat received');
          return;
        }

        try {
          // Parse JSON data
          const parsedData = JSON.parse(event.data);
          
          // Validate log structure per OpSentra schema
          if (parsedData && parsedData.message && parsedData.service) {
            setData(prevData => {
              // Limit data array size to prevent memory issues
              const maxLogs = 1000;
              const newData = [...prevData, {
                ...parsedData,
                id: event.lastEventId || `${Date.now()}-${Math.random()}`,
                receivedAt: new Date().toISOString()
              }];
              
              // Keep only recent logs
              return newData.length > maxLogs 
                ? newData.slice(-maxLogs) 
                : newData;
            });
          } else {
            console.warn('SSE: Invalid log data structure', parsedData);
          }
        } catch (parseError) {
          console.error('SSE: Failed to parse event data', {
            error: parseError.message,
            data: event.data
          });
        }
      };

      // Error handling
      eventSource.onerror = (event) => {
        console.error('SSE: Connection error', {
          readyState: eventSource.readyState,
          url: url
        });

        setConnectionState('error');
        
        // Determine error type based on readyState
        let errorMessage = 'Connection failed';
        switch (eventSource.readyState) {
          case EventSource.CONNECTING:
            errorMessage = 'Failed to establish connection';
            break;
          case EventSource.CLOSED:
            errorMessage = 'Connection was closed';
            break;
          default:
            errorMessage = 'Unknown connection error';
        }
        
        setError(errorMessage);

        // Auto-reconnect logic
        if (autoReconnect && reconnectCount < maxReconnectAttempts) {
          const delay = Math.min(reconnectInterval * Math.pow(1.5, reconnectCount), 30000);
          console.log(`SSE: Attempting reconnection in ${delay}ms (attempt ${reconnectCount + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectCount(prev => prev + 1);
            connect();
          }, delay);
        } else if (reconnectCount >= maxReconnectAttempts) {
          setError(`Max reconnection attempts (${maxReconnectAttempts}) exceeded`);
          setConnectionState('disconnected');
        }
      };

    } catch (connectionError) {
      console.error('SSE: Failed to create EventSource', connectionError);
      setError(`Failed to create connection: ${connectionError.message}`);
      setConnectionState('error');
    }
  }, [url, enabled, autoReconnect, reconnectCount, maxReconnectAttempts, reconnectInterval, resetHeartbeat]);

  // Manual reconnection function
  const reconnect = useCallback(() => {
    console.log('SSE: Manual reconnection triggered');
    
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    // Clear timeouts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
    }
    
    // Reset state
    setReconnectCount(0);
    setError(null);
    
    // Reconnect
    connect();
  }, [connect]);

  // Disconnect function
  const disconnect = useCallback(() => {
    console.log('SSE: Disconnecting');
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
    }
    
    setConnectionState('disconnected');
    setError(null);
  }, []);

  // Effect for connection management
  useEffect(() => {
    if (enabled && url) {
      connect();
    }

    // Cleanup on unmount or dependency changes
    return () => {
      disconnect();
    };
  }, [url, enabled]); // Only re-run if URL or enabled status changes

  // Window focus/blur handling for connection management
  useEffect(() => {
    const handleFocus = () => {
      if (connectionState === 'error' || connectionState === 'disconnected') {
        console.log('SSE: Window focused, attempting reconnection');
        reconnect();
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && (connectionState === 'error' || connectionState === 'disconnected')) {
        console.log('SSE: Page visible, attempting reconnection');
        reconnect();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [connectionState, reconnect]);

  // Return hook interface
  return {
    data,
    error,
    connectionState,
    reconnectCount,
    isConnected: connectionState === 'connected',
    isConnecting: connectionState === 'connecting',
    isError: connectionState === 'error',
    reconnect,
    disconnect,
    
    // Additional utilities
    clearData: () => setData([]),
    lastEventTime: lastEventTimeRef.current
  };
}