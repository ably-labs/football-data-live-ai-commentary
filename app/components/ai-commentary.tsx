'use client';

import { useState, useEffect, useRef } from 'react';
import { useAbly } from 'ably/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import * as Ably from 'ably';
import { MAIN_CHANNEL, COMMENTARY_CHANNEL } from '@/lib/constants';

interface Commentary {
  id: string;
  text: string;
  timestamp: number;
  gameTime: number; // seconds remaining when commentary was made
  isComplete: boolean;
  commentator?: 'Barry Banter' | 'Ronnie Roast';
}

export function AICommentary() {
  // Generate unique instance ID for debugging
  const instanceId = useRef(`ai-commentary-${Math.random().toString(36).substr(2, 9)}`);
  const [commentary, setCommentary] = useState<Commentary[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const currentCommentaryIdRef = useRef<string | null>(null);
  const commentaryEndRef = useRef<HTMLDivElement>(null);
  const processedChunks = useRef<Set<string>>(new Set());
  const ably = useAbly();
  
  useEffect(() => {
    const currentInstanceId = instanceId.current;
    console.log(`[AICommentary-${currentInstanceId}] Component mounted`);
    return () => {
      console.log(`[AICommentary-${currentInstanceId}] Component unmounted`);
    };
  }, []);

  useEffect(() => {
    if (!ably) return;

    const commentaryChannel = ably.channels.get(COMMENTARY_CHANNEL);
    const gameChannel = ably.channels.get(MAIN_CHANNEL);
    
    // Subscribe to reset events to clear commentary
    const handleResetMessage = (message: Ably.Message) => {
      if (message.name === 'reset') {
        console.log('[AICommentary] Game reset detected - clearing commentary');
        setCommentary([]);
        currentCommentaryIdRef.current = null;
        setIsGenerating(false);
        setIsPending(false);
        processedChunks.current.clear();
      }
    };
    
    gameChannel.subscribe('reset', handleResetMessage);
    
    // Load commentary history first
    const loadHistory = async () => {
      try {
        // First check if there's been a recent reset
        const gameHistory = await gameChannel.history({ limit: 100, direction: 'backwards' });
        let lastResetTime = 0;
        let lastGameStartTime = 0;
        
        if (gameHistory && gameHistory.items.length > 0) {
          // Find the most recent reset or game start
          for (const msg of gameHistory.items) {
            if (msg.name === 'reset' && msg.timestamp > lastResetTime) {
              lastResetTime = msg.timestamp;
            } else if (msg.name === 'game-status-update' && 
                      msg.data?.isGameActive === true && 
                      msg.timestamp > lastGameStartTime) {
              lastGameStartTime = msg.timestamp;
            }
          }
        }
        
        // Don't load commentary from before the last reset (or last 2 minutes)
        const startTime = Math.max(lastResetTime, Date.now() - 2 * 60 * 1000);
        
        // Load all pages of history
        const allMessages: Ably.Message[] = [];
        let historyPage = await commentaryChannel.history({ start: startTime, end: Date.now(), direction: 'forwards' });
        
        while (historyPage) {
          if (historyPage.items.length > 0) {
            allMessages.push(...historyPage.items);
            console.log(`[AICommentary-${instanceId.current}] Loaded ${historyPage.items.length} messages from history page`);
          }
          
          // Check if there are more pages
          if (historyPage.hasNext()) {
            const nextPage = await historyPage.next();
            if (nextPage) {
              historyPage = nextPage;
            } else {
              break;
            }
          } else {
            break;
          }
        }
        
        console.log(`[AICommentary-${instanceId.current}] Total messages loaded from history: ${allMessages.length}`);
        
        if (allMessages.length > 0) {
          // Group messages by commentary ID
          const commentaryGroups = new Map<string, Commentary>();
          
          allMessages.forEach((message: Ably.Message) => {
            if (message.name === 'start') {
              // Use commentaryId if available (new format), otherwise fall back to timestamp
              const id = message.data?.commentaryId || `commentary-${message.data?.timestamp || message.timestamp}`;
              const serverTimestamp = message.data?.timestamp || message.timestamp;
              
              commentaryGroups.set(id, {
                id,
                text: '',
                timestamp: serverTimestamp,
                gameTime: message.data.gameTime || 120,
                isComplete: false
              });
            } else if (message.name === 'chunk' && message.data.text) {
              // Use commentaryId for direct matching (new format)
              const targetCommentaryId = message.data?.commentaryId;
              
              if (targetCommentaryId && commentaryGroups.has(targetCommentaryId)) {
                const commentary = commentaryGroups.get(targetCommentaryId)!;
                commentary.text += message.data.text;
                
                // Mark this chunk as processed to avoid duplication when live messages arrive
                if (message.data.chunkIndex !== undefined) {
                  const chunkKey = `${targetCommentaryId}-${message.data.chunkIndex}`;
                  processedChunks.current.add(chunkKey);
                }
                
                // Use the chunk's game time if this is the first chunk
                if (commentary.text === message.data.text && message.data.gameTime !== undefined) {
                  commentary.gameTime = message.data.gameTime;
                }
              } else if (!targetCommentaryId) {
                // Legacy format - try to match by timestamp
                const sortedIds = Array.from(commentaryGroups.keys())
                  .map(id => ({ id, timestamp: parseInt(id.split('-')[1]) }))
                  .sort((a, b) => b.timestamp - a.timestamp);
                
                for (const { id, timestamp } of sortedIds) {
                  if (message.timestamp && timestamp <= message.timestamp) {
                    const commentary = commentaryGroups.get(id);
                    if (commentary) {
                      commentary.text += message.data.text;
                      break;
                    }
                  }
                }
              }
            } else if (message.name === 'complete') {
              // Use commentaryId for direct matching (new format)
              const targetCommentaryId = message.data?.commentaryId;
              
              if (targetCommentaryId && commentaryGroups.has(targetCommentaryId)) {
                commentaryGroups.get(targetCommentaryId)!.isComplete = true;
              } else if (!targetCommentaryId) {
                // Legacy format - mark the most recent incomplete commentary as complete
                const sortedIds = Array.from(commentaryGroups.keys())
                  .map(id => ({ id, timestamp: parseInt(id.split('-')[1]) }))
                  .sort((a, b) => b.timestamp - a.timestamp);
                
                for (const { id } of sortedIds) {
                  const commentary = commentaryGroups.get(id);
                  if (commentary && !commentary.isComplete) {
                    commentary.isComplete = true;
                    break;
                  }
                }
              }
            }
          });
          
          // Set all loaded commentary
          const loadedCommentary = Array.from(commentaryGroups.values())
            .filter(c => c.text.length > 0)
            .sort((a, b) => a.timestamp - b.timestamp);
          
          if (loadedCommentary.length > 0) {
            console.log(`[AICommentary-${instanceId.current}] Loaded ${loadedCommentary.length} historical commentaries`);
            loadedCommentary.forEach(c => {
              console.log(`[AICommentary-${instanceId.current}] Historical commentary:`, {
                id: c.id,
                textLength: c.text.length,
                isComplete: c.isComplete,
                preview: c.text.substring(0, 50) + '...'
              });
            });
            setCommentary(loadedCommentary);
          }
        }
      } catch (error) {
        console.error('[AICommentary] Error loading history:', error);
      }
    };
    
    loadHistory();
    
    const handleMessage = (message: Ably.Message) => {
    const timestamp = Date.now();
    console.log(`[AICommentary-${instanceId.current}] Received message:`, message.name, 'at', timestamp, message.data);
    switch (message.name) {
      case 'pending':
        // Show cursor immediately when any commentary-worthy event happens
        setIsPending(true);
        console.log(`[AICommentary-${instanceId.current}] Commentary pending - showing cursor`);
        break;
        
      case 'start':
        // New commentary generation started
        // Use commentaryId if available (new format), otherwise generate from timestamp
        const commentaryId = message.data.commentaryId || `commentary-${message.data.timestamp || timestamp}`;
        const serverTimestamp = message.data.timestamp || timestamp;
        
        // Clear processed chunks for this new commentary
        // Remove any existing chunks for this commentary ID (in case of retries)
        const keysToRemove = Array.from(processedChunks.current).filter(key => key.startsWith(commentaryId + '-'));
        keysToRemove.forEach(key => processedChunks.current.delete(key));
        
        // Check if we already have this commentary ID to prevent duplicates
        setCommentary(prev => {
          const existing = prev.find(c => c.id === commentaryId);
          if (existing) {
            console.log(`[AICommentary-${instanceId.current}] WARNING: Duplicate commentary start event for ID:`, commentaryId);
            return prev;
          }
          
          currentCommentaryIdRef.current = commentaryId;
          setIsGenerating(true);
          setIsPending(false); // Clear pending now that we're actually generating
          
          console.log(`[AICommentary-${instanceId.current}] Previous commentary count:`, prev.length);
          const newCommentary = [...prev, {
            id: commentaryId,
            text: '',
            timestamp: serverTimestamp,
            gameTime: message.data.gameTime || 120,
            isComplete: false
          }];
          console.log(`[AICommentary-${instanceId.current}] New commentary count:`, newCommentary.length);
          return newCommentary;
        });
        console.log(`[AICommentary-${instanceId.current}] Started new commentary with ID:`, commentaryId);
        break;

      case 'chunk':
        // Append chunk to current commentary
        const chunkReceiveTime = timestamp;
        const serverSentTime = message.data.timestamp;
        const networkDelay = chunkReceiveTime - serverSentTime;
        console.log(`[AICommentary-${instanceId.current}] Processing chunk:`, message.data.chunkIndex, 'network delay:', networkDelay, 'ms');
        
        // Use commentaryId from chunk message (new format) or fall back to current ref
        const targetCommentaryId = message.data.commentaryId || currentCommentaryIdRef.current;
        
        if (targetCommentaryId && message.data.text) {
          // Check for duplicate chunks using commentaryId and chunkIndex
          const chunkKey = `${targetCommentaryId}-${message.data.chunkIndex}`;
          if (processedChunks.current.has(chunkKey)) {
            console.log(`[AICommentary-${instanceId.current}] WARNING: Duplicate chunk detected for key ${chunkKey}, skipping`);
            return;
          }
          processedChunks.current.add(chunkKey);
          
          console.log(`[AICommentary-${instanceId.current}] Appending text:`, message.data.text, 'to ID:', targetCommentaryId, 'chunk index:', message.data.chunkIndex);
          setCommentary(prev => {
            const targetItem = prev.find(item => item.id === targetCommentaryId);
            if (!targetItem) {
              console.log(`[AICommentary-${instanceId.current}] WARNING: No commentary found with ID:`, targetCommentaryId);
              return prev;
            }
            
            const updated = prev.map(item => 
              item.id === targetCommentaryId 
                ? { 
                    ...item, 
                    text: item.text + message.data.text,
                    // Update gameTime if provided in chunk (use first chunk's time)
                    gameTime: item.text === '' && message.data.gameTime !== undefined ? message.data.gameTime : item.gameTime
                  }
                : item
            );
            console.log(`[CHUNK-DEBUG] Updated commentary text for ${targetCommentaryId}:`, 
              updated.find(c => c.id === targetCommentaryId)?.text);
            return updated;
          });
        } else {
          console.log(`[AICommentary-${instanceId.current}] No commentary ID or text empty. ID:`, targetCommentaryId);
        }
        break;

      case 'complete':
        // Mark commentary as complete
        // Use commentaryId from complete message (new format) or fall back to current ref
        const completeCommentaryId = message.data.commentaryId || currentCommentaryIdRef.current;
        
        if (completeCommentaryId) {
          setCommentary(prev => prev.map(item => 
            item.id === completeCommentaryId 
              ? { ...item, isComplete: true }
              : item
          ));
          
          // Clear current ref if it matches
          if (currentCommentaryIdRef.current === completeCommentaryId) {
            currentCommentaryIdRef.current = null;
            setIsGenerating(false);
          }
        }
        break;

      case 'error':
        // Handle error
        console.error('Commentary error:', message.data);
        setIsGenerating(false);
        setIsPending(false);
        currentCommentaryIdRef.current = null;
        break;
        
      case 'clear':
        // Clear all commentary on reset
        console.log(`[AICommentary-${instanceId.current}] Clearing commentary on reset`);
        setCommentary([]);
        currentCommentaryIdRef.current = null;
        setIsGenerating(false);
        setIsPending(false);
        processedChunks.current.clear();
        break;
    }
    };

    const currentInstanceId = instanceId.current;
    console.log(`[AICommentary-${currentInstanceId}] Subscribing to commentary channel`);
    commentaryChannel.subscribe(handleMessage);

    return () => {
      console.log(`[AICommentary-${currentInstanceId}] Unsubscribing from channels`);
      commentaryChannel.unsubscribe(handleMessage);
      gameChannel.unsubscribe('reset', handleResetMessage);
    };
  }, [ably]);

  // Removed auto-scroll functionality

  // Parse commentary to identify commentators
  const parseCommentary = (text: string, isComplete: boolean = true): { commentator?: string; content: string }[] => {
    const parsed: { commentator?: string; content: string }[] = [];
    
    console.log(`[PARSE-DEBUG] parseCommentary called with text length: ${text.length}, isComplete: ${isComplete}`);
    console.log(`[PARSE-DEBUG] Raw text:`, text);
    
    // Remove code block markers if present
    let cleanText = text;
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.substring(3);
      // Also remove newline after opening ```
      if (cleanText.startsWith('\n')) {
        cleanText = cleanText.substring(1);
      }
    }
    if (cleanText.endsWith('```')) {
      cleanText = cleanText.substring(0, cleanText.length - 3);
    }
    
    console.log(`[PARSE-DEBUG] Clean text after removing backticks:`, cleanText);
    
    // Split by line breaks to handle multi-line commentary
    const lines = cleanText.split('\n');
    let currentCommentator: string | undefined = undefined;
    let currentContent: string[] = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check if this line starts with a commentator tag
      const barryMatch = trimmedLine.match(/^\[BARRY\]\s*(.*)/);
      const ronnieMatch = trimmedLine.match(/^\[RONNIE\]\s*(.*)/);
      
      if (barryMatch) {
        // Save previous content if any
        if (currentCommentator && currentContent.length > 0) {
          parsed.push({
            commentator: currentCommentator,
            content: currentContent.join(' ').trim()
          });
        }
        
        currentCommentator = 'Barry Banter';
        currentContent = barryMatch[1] ? [barryMatch[1]] : [];
      } else if (ronnieMatch) {
        // Save previous content if any
        if (currentCommentator && currentContent.length > 0) {
          parsed.push({
            commentator: currentCommentator,
            content: currentContent.join(' ').trim()
          });
        }
        
        currentCommentator = 'Ronnie Roast';
        currentContent = ronnieMatch[1] ? [ronnieMatch[1]] : [];
      } else if (trimmedLine && currentCommentator) {
        // This is continuation of the current commentator's text
        currentContent.push(trimmedLine);
      }
    }
    
    // Save the last commentator's content
    if (currentCommentator && currentContent.length > 0) {
      const content = currentContent.join(' ').trim();
      if (content || isComplete) {
        parsed.push({
          commentator: currentCommentator,
          content: content
        });
      }
    }
    
    // If no commentators found and we have text, check for old format
    if (parsed.length === 0 && cleanText.trim()) {
      // Fallback for old format (during transition)
      if (cleanText.includes('Barry:') || cleanText.includes('Ronnie:')) {
        const oldParts = cleanText.split(/(?=(Barry:|Ronnie:))/);
        for (const part of oldParts) {
          const trimmedPart = part.trim();
          if (trimmedPart.startsWith('Barry:')) {
            parsed.push({
              commentator: 'Barry Banter',
              content: trimmedPart.substring(6).trim().replace(/^[""]|[""]$/g, '')
            });
          } else if (trimmedPart.startsWith('Ronnie:')) {
            parsed.push({
              commentator: 'Ronnie Roast',
              content: trimmedPart.substring(7).trim().replace(/^[""]|[""]$/g, '')
            });
          }
        }
      } else if (isComplete) {
        // No format detected, use as Barry
        parsed.push({
          commentator: 'Barry Banter',
          content: cleanText.trim()
        });
      }
    }
    
    console.log(`[PARSE-DEBUG] Final parsed result: ${parsed.length} items:`, parsed);
    return parsed;
  };

  // Format game time from seconds remaining
  const getGameTime = (secondsRemaining: number) => {
    // Clamp to valid range
    const clampedSeconds = Math.max(0, Math.min(120, secondsRemaining));
    const minutes = Math.floor(clampedSeconds / 60);
    const seconds = clampedSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Prepare the cursor state before rendering
  const showCursors = (isPending || (isGenerating && currentCommentaryIdRef.current && 
    (() => {
      const currentCommentary = commentary.find(c => c.id === currentCommentaryIdRef.current);
      return !currentCommentary || currentCommentary.text.length === 0;
    })()));

  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="space-y-2">
      {/* Show cursors at the top when generating new commentary */}
      {showCursors && (
        <div className="space-y-2">
          {/* Barry preparing */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
            <div className="flex items-start gap-3">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarImage src="/images/barry-banter.png" alt="Barry Banter" />
                <AvatarFallback className="bg-blue-600 text-white font-bold text-xs">
                  BB
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white">
                  <span className="inline-block w-2 h-4 bg-white animate-pulse" />
                </p>
              </div>
            </div>
          </div>
          
          {/* Ronnie preparing */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
            <div className="flex items-start gap-3">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarImage src="/images/ronnie-roast.png" alt="Ronnie Roast" />
                <AvatarFallback className="bg-orange-600 text-white font-bold text-xs">
                  RR
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white">
                  <span className="inline-block w-2 h-4 bg-white animate-pulse" />
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Render existing commentary in reverse order */}
      {[...commentary]
        .flatMap((item) => {
          console.log(`[RENDER-DEBUG] Processing commentary item:`, {
            id: item.id,
            textLength: item.text.length,
            isComplete: item.isComplete,
            textPreview: item.text.substring(0, 100) + '...'
          });
          const parsedLines = parseCommentary(item.text, item.isComplete);
          console.log(`[RENDER-DEBUG] Parsed into ${parsedLines.length} lines`);
          const result = parsedLines.map((line, index) => ({
            ...line,
            id: `${item.id}-${index}`,
            timestamp: item.timestamp,
            gameTime: item.gameTime,
            isComplete: item.isComplete,
            isLastInGroup: index === parsedLines.length - 1
          }));
          console.log(`[RENDER-DEBUG] Returning ${result.length} items for rendering`);
          return result;
        })
        .reverse()
        .map((line) => {
          console.log(`[RENDER-DEBUG] Rendering line:`, {
            id: line.id,
            commentator: line.commentator,
            contentLength: line.content?.length || 0,
            contentPreview: line.content?.substring(0, 50) + '...'
          });
          return (
          <div key={line.id} className="bg-gray-800 border border-gray-700 rounded-lg p-3">
            <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage 
                      src={
                        line.commentator === 'Barry Banter' ? "/images/barry-banter.png" : 
                        line.commentator === 'Ronnie Roast' ? "/images/ronnie-roast.png" : 
                        undefined
                      }
                      alt={line.commentator || 'Commentator'}
                    />
                    <AvatarFallback 
                      className={cn(
                        "text-white font-bold text-xs",
                        line.commentator === 'Barry Banter' ? "bg-blue-600" : 
                        line.commentator === 'Ronnie Roast' ? "bg-orange-600" : 
                        "bg-gray-600"
                      )}
                    >
                      {line.commentator === 'Barry Banter' ? 'BB' : 'RR'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white break-words">
                      {line.content}
                      {!line.isComplete && line.isLastInGroup && (
                        <span className="inline-block w-2 h-4 bg-white animate-pulse ml-1" />
                      )}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0 mt-1">
                    {getGameTime(line.gameTime)}
                  </span>
                </div>
              </div>
          );
        })}
        
        <div ref={commentaryEndRef} />
      </div>
    </div>
  );
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}