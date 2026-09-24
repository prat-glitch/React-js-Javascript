export function createIncomingTracker(chatId = null) {
  return { chatId, knownIds: null, soundedIds: new Set() };
}

export function noticeRealtimeMessage(tracker, message, userId) {
  if (!message?.id || message.chat_id !== tracker.chatId || message.sender_id === userId ||
      tracker.soundedIds.has(message.id) || tracker.knownIds?.has(message.id)) return false;
  tracker.soundedIds.add(message.id);
  return true;
}

export function noticeLoadedMessages(tracker, rows, userId) {
  const shouldSound = Boolean(tracker.knownIds && rows.some((message) =>
    message.sender_id !== userId && !tracker.knownIds.has(message.id) && !tracker.soundedIds.has(message.id)));
  if (shouldSound) {
    for (const message of rows) {
      if (message.sender_id !== userId && !tracker.knownIds.has(message.id)) tracker.soundedIds.add(message.id);
    }
  }
  tracker.knownIds = new Set(rows.map((message) => message.id));
  return shouldSound;
}
