/**
 * OpSentra Frontend Main Application Component
 * 
 * Phase 1: Project Setup and Configuration
 * 
 * This is the main React application component that provides:
 * - Real-time log streaming via Server-Sent Events (SSE)
 * - Centralized and distributed (per-service) log views
 * - AI suggestion display with expandable panels
 * - Search and filtering capabilities
 * - Responsive dashboard layout
 * 
 * Features:
 * - EventSource for SSE connection to backend
 * - Dynamic service tabs based on incoming logs
 * - Auto-scrolling live feed with pause functionality
 * - Copy-to-clipboard for AI suggested commands
 * - Error highlighting and pattern detection
 */

import { useState, useEffect, useRef } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './components/Dashboard'
import './App.css'

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App