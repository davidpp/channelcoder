import { readFile } from 'node:fs/promises';
import type { SessionManager, SessionState } from './session.js';
import { parseLogFile } from './stream-parser/file.js';

/**
 * Update a session with the real Claude session ID from a detached log file
 * @param sessionState - Session state to update
 * @param logFile - Path to the log file containing Claude's output
 * @returns Updated session state with real session ID
 */
export async function updateSessionFromLog(
  sessionState: SessionState,
  logFile: string
): Promise<SessionState> {
  try {
    // Parse the log file to extract session information
    const parsedLog = await parseLogFile(logFile);

    if (parsedLog.sessionId) {
      // Find the temporary detached session ID
      const tempSessionIndex = sessionState.sessionChain.findIndex((id) =>
        id.startsWith('detached-')
      );

      if (tempSessionIndex !== -1) {
        // Replace the temporary ID with the real one
        sessionState.sessionChain[tempSessionIndex] = parsedLog.sessionId;

        // Update current session ID
        if (sessionState.currentSessionId?.startsWith('detached-')) {
          sessionState.currentSessionId = parsedLog.sessionId;
        }

        // Update message session IDs
        for (const message of sessionState.messages) {
          if (message.sessionId.startsWith('detached-')) {
            message.sessionId = parsedLog.sessionId;
          }
        }
      } else {
        // No temporary ID found, just add the real one
        sessionState.sessionChain.push(parsedLog.sessionId);
        sessionState.currentSessionId = parsedLog.sessionId;
      }

      // Add assistant's response if available
      if (parsedLog.content) {
        const lastUserMessage = sessionState.messages.filter((m) => m.role === 'user').pop();

        if (lastUserMessage) {
          // Check if we already have this assistant message
          const hasAssistantResponse = sessionState.messages.some(
            (m) => m.role === 'assistant' && m.sessionId === parsedLog.sessionId
          );

          if (!hasAssistantResponse) {
            sessionState.messages.push({
              role: 'assistant',
              content: parsedLog.content,
              timestamp: new Date(),
              sessionId: parsedLog.sessionId,
            });
          }
        }
      }

      // Update last active time
      sessionState.metadata.lastActive = new Date();
    }

    return sessionState;
  } catch (error) {
    // If log file doesn't exist or is invalid, return unchanged state
    console.warn(`Failed to update session from log: ${error}`);
    return sessionState;
  }
}

/**
 * Monitor a detached process log file and update session when complete
 * @param sessionManager - Session manager instance
 * @param logFile - Path to the log file
 * @param pollInterval - How often to check the file (ms)
 * @param maxWaitTime - Maximum time to wait for completion (ms)
 */
export async function monitorDetachedSession(
  sessionManager: SessionManager,
  logFile: string,
  pollInterval = 1000,
  maxWaitTime = 60000
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    try {
      // Try to parse the log file
      const parsedLog = await parseLogFile(logFile);

      // Check if the process is complete (has a result event)
      if (parsedLog.metadata.duration !== undefined) {
        // Process is complete, update the session
        const updatedState = await updateSessionFromLog(
          sessionManager['state'], // Access private state
          logFile
        );

        // Update the manager's state
        sessionManager['state'] = updatedState;

        // Save the updated session
        if (sessionManager['storage'] && sessionManager['autoSave']) {
          await sessionManager['storage'].save(updatedState, updatedState.metadata.name);
        }

        return;
      }
    } catch (error) {
      // File might not exist yet or be incomplete, continue polling
    }

    // Wait before checking again
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  // Timeout reached, try one final update
  try {
    const updatedState = await updateSessionFromLog(sessionManager['state'], logFile);
    sessionManager['state'] = updatedState;

    if (sessionManager['storage'] && sessionManager['autoSave']) {
      await sessionManager['storage'].save(updatedState, updatedState.metadata.name);
    }
  } catch (error) {
    console.warn('Failed to update session after timeout');
  }
}
