"""
OpSentra FastAPI AI Layer - Phase 1: Project Setup and Configuration

This FastAPI service provides real-time log analysis and AI-enhanced error detection.

Features:
- RabbitMQ consumer for raw logs from log shippers
- Pattern-based error detection using regex filters
- LLM integration with Groq API (primary) and Gemini API (fallback)
- Real-time AI suggestion generation for detected errors
- Asynchronous processing for high-throughput log analysis
- Context-aware error analysis with service-agnostic suggestions

Architecture:
- Consumes from 'raw-logs' queue in parallel with Node.js backend
- Applies initial regex filters for error pattern detection
- Segments error logs and sends to LLM for analysis
- Publishes enriched data to 'ai-enriched' queue
- Handles API failures with fallback mechanisms

Error Detection Patterns:
- Stack traces (multi-line errors, tracebacks)
- HTTP errors (4xx, 5xx status codes)
- Performance bottlenecks (latency warnings, slow queries)
- Application errors (exceptions, failed operations)
"""

import asyncio
import json
import logging
import os
import re
import time
from typing import Dict, List, Optional, Any
from pathlib import Path

import aio_pika
import google.generativeai as genai
import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('ai_layer.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# FastAPI app instance
app = FastAPI(
    title="OpSentra AI Layer",
    description="Real-time log analysis and AI-enhanced error detection service",
    version="1.0.0"
)

class LogEntry(BaseModel):
    """Pydantic model for log entries"""
    _id: Optional[str] = None
    timestamp: str
    service: str
    level: str
    message: str
    host: Optional[str] = None
    
class AIEnrichment(BaseModel):
    """Pydantic model for AI-enriched log data"""
    log_id: str
    suggestion: str
    commands: List[str]
    confidence: float
    processing_time: float

class OpSentraAI:
    """Main AI processing class for OpSentra log analysis"""
    
    def __init__(self):
        self.rabbitmq_connection = None
        self.rabbitmq_channel = None
        self.groq_api_key = os.getenv('GROQ_API_KEY')
        self.gemini_api_key = os.getenv('GEMINI_API_KEY')
        self.cloudamqp_url = os.getenv('CLOUDAMQP_URL')
        
        # Configure Gemini
        if self.gemini_api_key:
            genai.configure(api_key=self.gemini_api_key)
            self.gemini_model = genai.GenerativeModel('gemini-pro')
        
        # Error detection patterns
        self.error_patterns = [
            # Stack traces and exceptions
            r'(?i)(traceback|exception|error|failed|failure)',
            # HTTP errors
            r'HTTP [45]\d\d',
            # Performance issues
            r'(?i)(timeout|slow|latency > \d+ms|took \d+ms)',
            # Database errors
            r'(?i)(connection refused|database.*error|sql.*error)',
            # Container/service errors
            r'(?i)(container.*exit|pod.*failed|service.*down)',
            # File system errors
            r'(?i)(permission denied|no such file|disk.*full)',
        ]
        
        self.compiled_patterns = [re.compile(pattern) for pattern in self.error_patterns]
        
        # AI processing statistics
        self.stats = {
            'logs_processed': 0,
            'errors_detected': 0,
            'ai_suggestions_generated': 0,
            'groq_api_calls': 0,
            'gemini_api_calls': 0,
            'api_failures': 0
        }

    async def initialize_rabbitmq(self):
        """Initialize RabbitMQ connection and set up consumers"""
        try:
            self.rabbitmq_connection = await aio_pika.connect_robust(self.cloudamqp_url)
            self.rabbitmq_channel = await self.rabbitmq_connection.channel()
            
            # Declare exchanges and queues
            logs_exchange = await self.rabbitmq_channel.declare_exchange(
                'logs_exchange', aio_pika.ExchangeType.TOPIC, durable=True
            )
            
            # Queue for raw logs (shared with Node.js backend)
            raw_logs_queue = await self.rabbitmq_channel.declare_queue(
                'raw-logs', durable=True
            )
            
            # Queue for AI-enriched data
            ai_enriched_queue = await self.rabbitmq_channel.declare_queue(
                'ai-enriched', durable=True
            )
            
            # Bind queues to exchange
            await raw_logs_queue.bind(logs_exchange, 'logs.*')
            await ai_enriched_queue.bind(logs_exchange, 'ai.*')
            
            # Set up consumer for raw logs
            await raw_logs_queue.consume(self.process_log_message)
            
            logger.info("RabbitMQ connection established and consumers started")
            
        except Exception as e:
            logger.error(f"Failed to initialize RabbitMQ: {e}")
            raise

    def detect_error_patterns(self, log_message: str) -> bool:
        """Detect if a log message contains error patterns"""
        message_lower = log_message.lower()
        
        # Check compiled regex patterns
        for pattern in self.compiled_patterns:
            if pattern.search(log_message):
                return True
        
        # Additional heuristic checks
        error_keywords = [
            'error', 'exception', 'failed', 'failure', 'timeout',
            'refused', 'denied', 'unavailable', 'crashed', 'panic'
        ]
        
        return any(keyword in message_lower for keyword in error_keywords)

    def extract_log_context(self, log_entry: Dict[str, Any]) -> str:
        """Extract relevant context from log entry for AI analysis"""
        context_parts = [
            f"Service: {log_entry.get('service', 'unknown')}",
            f"Level: {log_entry.get('level', 'info')}",
            f"Message: {log_entry.get('message', '')}",
        ]
        
        if log_entry.get('host'):
            context_parts.append(f"Host: {log_entry['host']}")
            
        return " | ".join(context_parts)

    async def call_groq_api(self, log_context: str) -> Optional[Dict[str, Any]]:
        """Call Groq API for log analysis"""
        if not self.groq_api_key:
            return None
            
        try:
            headers = {
                'Authorization': f'Bearer {self.groq_api_key}',
                'Content-Type': 'application/json'
            }
            
            model = os.getenv('GROQ_MODEL', 'llama-3.1-8b-instant')
            
            payload = {
                "model": model,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a Linux system administrator expert. Analyze log errors and provide specific, actionable solutions."
                    },
                    {
                        "role": "user", 
                        "content": f"""
                        Analyze this log error and provide specific, actionable suggestions:
                        
                        Log Context: {log_context}
                        
                        Please provide:
                        1. A brief explanation of the likely cause
                        2. 2-3 specific Linux commands to diagnose or fix the issue
                        3. Focus on practical, service-agnostic solutions
                        
                        Respond in JSON format with 'explanation' and 'commands' fields.
                        """
                    }
                ],
                "max_tokens": 1000,
                "temperature": 0.3
            }
            
            # Use actual Groq API endpoint
            response = requests.post(
                'https://api.groq.com/openai/v1/chat/completions',
                headers=headers, 
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result['choices'][0]['message']['content']
                
                # Parse JSON response
                import json
                try:
                    parsed_content = json.loads(content)
                    self.stats['groq_api_calls'] += 1
                    return parsed_content
                except json.JSONDecodeError:
                    # Fallback if not proper JSON
                    self.stats['groq_api_calls'] += 1
                    return {
                        'explanation': content,
                        'commands': ['systemctl status service-name', 'journalctl -u service-name --since "1 hour ago"']
                    }
            else:
                logger.error(f"Groq API error: {response.status_code} - {response.text}")
                self.stats['api_failures'] += 1
                return None
            
        except Exception as e:
            logger.error(f"Groq API call failed: {e}")
            self.stats['api_failures'] += 1
            return None

    async def call_gemini_api(self, log_context: str) -> Optional[Dict[str, Any]]:
        """Call Gemini API as fallback for log analysis"""
        if not self.gemini_api_key:
            return None
            
        try:
            model = os.getenv('GOOGLE_MODEL', 'gemini-1.5-flash')
            
            prompt = f"""
            You are a Linux system administrator expert. Analyze this log error and provide specific, actionable suggestions.
            
            Log Context: {log_context}
            
            Please provide:
            1. A brief explanation of the likely cause (2-3 sentences)
            2. 2-3 specific Linux commands to diagnose or fix the issue
            3. Focus on practical, service-agnostic solutions
            
            Respond in this exact JSON format:
            {{
                "explanation": "Your analysis here",
                "commands": ["command1", "command2", "command3"]
            }}
            """
            
            response = await asyncio.to_thread(
                self.gemini_model.generate_content, prompt
            )
            
            self.stats['gemini_api_calls'] += 1
            
            # Parse JSON response
            response_text = response.text.strip()
            if response_text.startswith('```json'):
                response_text = response_text.replace('```json', '').replace('```', '').strip()
            
            return json.loads(response_text)
            
        except Exception as e:
            logger.error(f"Gemini API call failed: {e}")
            self.stats['api_failures'] += 1
            return None

    async def generate_ai_suggestion(self, log_entry: Dict[str, Any]) -> Optional[AIEnrichment]:
        """Generate AI suggestions for error logs"""
        start_time = time.time()
        
        try:
            log_context = self.extract_log_context(log_entry)
            
            # Try Groq first, fallback to Gemini
            ai_response = await self.call_groq_api(log_context)
            if not ai_response:
                ai_response = await self.call_gemini_api(log_context)
            
            if not ai_response:
                logger.warning("Both AI APIs failed for log analysis")
                return None
            
            processing_time = time.time() - start_time
            
            enrichment = AIEnrichment(
                log_id=str(log_entry.get('_id', '')),
                suggestion=ai_response.get('explanation', 'No suggestion available'),
                commands=ai_response.get('commands', []),
                confidence=0.85,  # Placeholder confidence score
                processing_time=processing_time
            )
            
            self.stats['ai_suggestions_generated'] += 1
            return enrichment
            
        except Exception as e:
            logger.error(f"Error generating AI suggestion: {e}")
            return None

    async def publish_ai_enrichment(self, enrichment: AIEnrichment):
        """Publish AI-enriched data back to RabbitMQ"""
        try:
            if not self.rabbitmq_channel:
                logger.error("RabbitMQ channel not available for publishing")
                return
                
            message_body = enrichment.json()
            
            # Publish to ai-enriched queue
            await self.rabbitmq_channel.default_exchange.publish(
                aio_pika.Message(
                    message_body.encode(),
                    content_type='application/json'
                ),
                routing_key='ai-enriched'
            )
            
            logger.debug(f"Published AI enrichment for log {enrichment.log_id}")
            
        except Exception as e:
            logger.error(f"Error publishing AI enrichment: {e}")

    async def process_log_message(self, message: aio_pika.AbstractIncomingMessage):
        """Process incoming log messages from RabbitMQ"""
        async with message.process():
            try:
                log_data = json.loads(message.body.decode())
                self.stats['logs_processed'] += 1
                
                # Check if log contains error patterns
                if not self.detect_error_patterns(log_data.get('message', '')):
                    return  # Skip non-error logs
                
                self.stats['errors_detected'] += 1
                logger.info(f"Error detected in log from {log_data.get('service', 'unknown')}")
                
                # Generate AI suggestion
                enrichment = await self.generate_ai_suggestion(log_data)
                if enrichment:
                    await self.publish_ai_enrichment(enrichment)
                    
            except Exception as e:
                logger.error(f"Error processing log message: {e}")

    async def start_processing(self):
        """Start the AI processing service"""
        logger.info("Starting OpSentra AI Layer...")
        
        try:
            await self.initialize_rabbitmq()
            logger.info("AI Layer is ready and processing logs")
            
            # Keep the service running
            while True:
                await asyncio.sleep(int(os.getenv('HEALTH_CHECK_INTERVAL_SECONDS', '60')))
                logger.info(f"AI Stats: {self.stats}")
                
        except Exception as e:
            logger.error(f"Error in AI processing: {e}")
            raise

    async def shutdown(self):
        """Graceful shutdown"""
        logger.info("Shutting down AI Layer...")
        
        if self.rabbitmq_connection:
            await self.rabbitmq_connection.close()
        
        logger.info("AI Layer shutdown complete")

# Global AI processor instance
ai_processor = OpSentraAI()

# FastAPI event handlers
@app.on_event("startup")
async def startup_event():
    """FastAPI startup event"""
    asyncio.create_task(ai_processor.start_processing())

@app.on_event("shutdown")
async def shutdown_event():
    """FastAPI shutdown event"""
    await ai_processor.shutdown()

# API endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "OpSentra AI Layer",
        "stats": ai_processor.stats
    }

@app.get("/stats")
async def get_stats():
    """Get AI processing statistics"""
    return ai_processor.stats

@app.post("/analyze")
async def analyze_log(log_entry: LogEntry):
    """Manual log analysis endpoint"""
    try:
        log_dict = log_entry.dict()
        
        if not ai_processor.detect_error_patterns(log_dict.get('message', '')):
            return {"error": "No error patterns detected in log"}
        
        enrichment = await ai_processor.generate_ai_suggestion(log_dict)
        if enrichment:
            return enrichment.dict()
        else:
            raise HTTPException(status_code=500, detail="Failed to generate AI analysis")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )