/**
 * utils/chatbotApi.ts — API client for the Multi-Agent Medical Chatbot
 *
 * Handles all communication with the chatbot backend endpoints.
 * Uses stored JWT token for authenticated requests.
 */
import { getToken } from './supabase/client';
import { API_ENDPOINTS } from '../config/api';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  agentUsed?: string;
  intent?: string;
  sources?: ChatSource[];
  createdAt?: string;
}

export interface ChatSource {
  type: 'report' | 'prescription';
  id: string;
  preview: string;
  metadata: Record<string, string>;
}

export interface SendMessageResponse {
  reply: string;
  agentUsed: string;       // 'groq_only' | 'mistral+groq' | 'off_topic_block' | 'error'
  intent: string;
  sources: ChatSource[];
  dataSharingConsent: boolean;
  consentNeeded: boolean;
}

export interface SessionInfo {
  sessionId: string;
  dataSharingConsent: boolean;
  userRole: string;
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/** Get or create the current session and consent status */
export async function getSession(): Promise<SessionInfo> {
  const res = await fetch(API_ENDPOINTS.CHATBOT.SESSION, {
    headers: authHeaders(),
  });
  return handleResponse<SessionInfo>(res);
}

/** Send a chat message — runs the full multi-agent pipeline */
export async function sendMessage(message: string): Promise<SendMessageResponse> {
  const res = await fetch(API_ENDPOINTS.CHATBOT.MESSAGE, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ message }),
  });
  return handleResponse<SendMessageResponse>(res);
}

/** Fetch chat history for the current session */
export async function getHistory(): Promise<{
  messages: ChatMessage[];
  dataSharingConsent: boolean;
}> {
  const res = await fetch(API_ENDPOINTS.CHATBOT.HISTORY, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

/** Toggle data sharing consent */
export async function setConsent(consent: boolean): Promise<{ success: boolean; message: string }> {
  const res = await fetch(API_ENDPOINTS.CHATBOT.CONSENT, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ consent }),
  });
  return handleResponse(res);
}

/** Clear chat history */
export async function clearHistory(): Promise<{ success: boolean }> {
  const res = await fetch(API_ENDPOINTS.CHATBOT.CLEAR, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return handleResponse(res);
}
