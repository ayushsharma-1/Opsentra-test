/**
 * OpSentra Dashboard Component
 * 
 * Phase 1: Project Setup and Configuration
 * 
 * Main dashboard component that handles:
 * - Real-time log streaming via EventSource (SSE)
 * - Service-based filtering and tabs
 * - AI suggestion display and interaction
 * - Search and filtering functionality
 * - Auto-scrolling and manual scroll control
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Search, 
  Play, 
  Pause, 
  RotateCcw, 
  Activity, 
  AlertCircle, 
  Copy, 
  Check,
  ChevronDown,
  ChevronUp,
  Terminal,
  Zap
} from 'lucide-react';

const Dashboard = () => {
  // State management
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [services, setServices] = useState(new Set(['all']));
  const [activeService, setActiveService] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [copiedCommand, setCopiedCommand] = useState('');
  const [expandedSuggestions, setExpandedSuggestions] = useState(new Set());

  // Refs
  const eventSourceRef = useRef(null);
  const logContainerRef = useRef(null);
  const maxLogs = 1000;

  // Initialize SSE connection
  const initializeEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setConnectionStatus('connecting');
    
    try {
      const eventSource = new EventSource('/stream');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setConnectionStatus('connected');
        setIsStreaming(true);
        console.log('SSE connection established');
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleStreamData(data);
        } catch (error) {
          console.error('Error parsing SSE data:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        setConnectionStatus('disconnected');
        setIsStreaming(false);
        
        // Retry connection after 3 seconds
        setTimeout(() => {
          if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
            initializeEventSource();
          }
        }, 3000);
      };
    } catch (error) {
      console.error('Failed to initialize EventSource:', error);
      setConnectionStatus('disconnected');
      setIsStreaming(false);
    }
  }, []);

  // Handle incoming stream data
  const handleStreamData = useCallback((data) => {
    if (data.type === 'log') {
      const logEntry = {
        id: data.data._id,
        timestamp: new Date(data.data.timestamp),
        service: data.data.service || 'unknown',
        level: data.data.level || 'info',
        message: data.data.message || '',
        host: data.data.host || '',
        ai_suggestion: data.data.ai_suggestion || null,
        ai_commands: data.data.ai_commands || null
      };

      setLogs(prev => {
        const updated = [logEntry, ...prev].slice(0, maxLogs);
        return updated;
      });

      setServices(prev => new Set([...prev, logEntry.service]));
    } else if (data.type === 'ai_suggestion') {
      // Update existing log with AI suggestion
      setLogs(prev => prev.map(log => 
        log.id === data.data.log_id 
          ? {
              ...log,
              ai_suggestion: data.data.suggestion,
              ai_commands: data.data.commands
            }
          : log
      ));
    }
  }, []);

  // Filter logs based on active filters
  useEffect(() => {
    let filtered = logs;

    // Filter by service
    if (activeService !== 'all') {
      filtered = filtered.filter(log => log.service === activeService);
    }

    // Filter by level
    if (levelFilter !== 'all') {
      filtered = filtered.filter(log => log.level === levelFilter);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(term) ||
        log.service.toLowerCase().includes(term) ||
        log.host.toLowerCase().includes(term)
      );
    }

    setFilteredLogs(filtered);
  }, [logs, activeService, levelFilter, searchTerm]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (isAutoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
    }
  }, [filteredLogs, isAutoScroll]);

  // Initialize on mount
  useEffect(() => {
    initializeEventSource();
    
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [initializeEventSource]);

  // Utility functions
  const formatTimestamp = (timestamp) => {
    return timestamp.toLocaleString('en-US', {
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  const getLevelColor = (level) => {
    switch (level?.toLowerCase()) {
      case 'error': return 'error';
      case 'warn': return 'warn';
      case 'info': return 'info';
      case 'debug': return 'debug';
      default: return 'info';
    }
  };

  const copyToClipboard = async (text, commandId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCommand(commandId);
      setTimeout(() => setCopiedCommand(''), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const toggleSuggestionExpansion = (logId) => {
    setExpandedSuggestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  const clearLogs = () => {
    setLogs([]);
    setServices(new Set(['all']));
  };

  const toggleStreaming = () => {
    if (isStreaming) {
      eventSourceRef.current?.close();
      setIsStreaming(false);
      setConnectionStatus('disconnected');
    } else {
      initializeEventSource();
    }
  };

  const getServiceCount = (serviceName) => {
    if (serviceName === 'all') return logs.length;
    return logs.filter(log => log.service === serviceName).length;
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">OpSentra</h1>
          <p className="dashboard-subtitle">
            Centralized Logging Dashboard with AI-Enhanced Error Resolution
          </p>
        </div>
        <div className={`connection-status status-${connectionStatus}`}>
          <Activity size={16} />
          <span>
            {connectionStatus === 'connected' && 'Connected'}
            {connectionStatus === 'connecting' && 'Connecting...'}
            {connectionStatus === 'disconnected' && 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="dashboard-controls">
        <div className="search-container">
          <Search className="search-icon" size={16} />
          <input
            type="text"
            placeholder="Search logs..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          className="filter-select"
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
        >
          <option value="all">All Levels</option>
          <option value="error">Error</option>
          <option value="warn">Warning</option>
          <option value="info">Info</option>
          <option value="debug">Debug</option>
        </select>

        <button
          className="control-button"
          onClick={toggleStreaming}
        >
          {isStreaming ? (
            <>
              <Pause size={16} />
              Pause Stream
            </>
          ) : (
            <>
              <Play size={16} />
              Resume Stream
            </>
          )}
        </button>

        <button
          className="control-button secondary"
          onClick={() => setIsAutoScroll(!isAutoScroll)}
        >
          {isAutoScroll ? 'Disable' : 'Enable'} Auto-scroll
        </button>

        <button
          className="control-button secondary"
          onClick={clearLogs}
        >
          <RotateCcw size={16} />
          Clear Logs
        </button>
      </div>

      {/* Service Tabs */}
      <div className="service-tabs">
        {Array.from(services).map(service => (
          <button
            key={service}
            className={`service-tab ${activeService === service ? 'active' : ''}`}
            onClick={() => setActiveService(service)}
          >
            <Terminal size={14} />
            {service === 'all' ? 'All Services' : service}
            <span className="service-badge">
              {getServiceCount(service)}
            </span>
          </button>
        ))}
      </div>

      {/* Log Container */}
      <div className="log-container">
        <div className="log-header">
          <h2 className="log-title">
            {activeService === 'all' ? 'All Logs' : `${activeService} Logs`}
          </h2>
          <div className="log-count">
            {filteredLogs.length} entries
          </div>
        </div>

        <div className="log-content" ref={logContainerRef}>
          {filteredLogs.length === 0 ? (
            <div className="empty-state">
              <AlertCircle className="empty-state-icon" size={48} />
              <h3 className="empty-state-title">No logs found</h3>
              <p className="empty-state-description">
                {logs.length === 0 
                  ? 'Waiting for log entries to stream in...' 
                  : 'No logs match your current filters. Try adjusting your search criteria.'
                }
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={`${log.id}-${log.timestamp.getTime()}`} className="log-entry">
                <div className="log-meta">
                  <span className="log-timestamp">
                    {formatTimestamp(log.timestamp)}
                  </span>
                  <span className="log-service">{log.service}</span>
                  <span className={`log-level ${getLevelColor(log.level)}`}>
                    {log.level.toUpperCase()}
                  </span>
                  {log.host && (
                    <span className="log-host">@{log.host}</span>
                  )}
                </div>
                
                <div className={`log-message ${getLevelColor(log.level)}`}>
                  {log.message}
                </div>

                {log.ai_suggestion && (
                  <div className="ai-suggestion">
                    <div 
                      className="ai-suggestion-header"
                      onClick={() => toggleSuggestionExpansion(log.id)}
                    >
                      <Zap size={16} />
                      <span className="ai-suggestion-title">AI Suggestion</span>
                      {expandedSuggestions.has(log.id) ? (
                        <ChevronUp size={16} />
                      ) : (
                        <ChevronDown size={16} />
                      )}
                    </div>
                    
                    {expandedSuggestions.has(log.id) && (
                      <>
                        <div className="ai-suggestion-content">
                          {log.ai_suggestion}
                        </div>
                        
                        {log.ai_commands && log.ai_commands.length > 0 && (
                          <div className="ai-commands">
                            {log.ai_commands.map((command, index) => (
                              <div key={index} className="command-item">
                                <Terminal size={14} />
                                <span className="command-text">{command}</span>
                                <button
                                  className={`copy-button ${
                                    copiedCommand === `${log.id}-${index}` ? 'copied' : ''
                                  }`}
                                  onClick={() => copyToClipboard(command, `${log.id}-${index}`)}
                                >
                                  {copiedCommand === `${log.id}-${index}` ? (
                                    <>
                                      <Check size={12} />
                                      Copied
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={12} />
                                      Copy
                                    </>
                                  )}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;