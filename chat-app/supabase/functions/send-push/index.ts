import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@samlap.app';

/**
 * Generate JWT for Web Push (VAPID)
 */
async function createVapidJwt(
  endpoint: string,
  privateKeyBase64: string,
  publicKeyBase64: string,
  subject: string
): Promise<{ authorization: string; cryptoKey: string }> {
  const audience = new URL(endpoint).origin;
  const expiry = Math.floor(Date.now() / 1000) + 12 * 60 * 60; // 12 hours

  const header = { alg: 'ES256', typ: 'JWT' };
  const payload = { aud: audience, exp: expiry, sub: subject };

  const enc = new TextEncoder();
  const b64url = (buf: ArrayBuffer | Uint8Array) =>
    btoa(String.fromCharCode(...new Uint8Array(buf instanceof ArrayBuffer ? buf : buf.buffer)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

  const headerB64 = b64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = b64url(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  // Import the private key
  const rawKey = Uint8Array.from(atob(privateKeyBase64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    rawKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  ).catch(() => {
    // Try as raw key (32 bytes)
    return crypto.subtle.importKey(
      'raw',
      rawKey,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );
  });

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    enc.encode(signingInput)
  );

  const jwt = `${signingInput}.${b64url(signature)}`;

  return {
    authorization: `vapid t=${jwt}, k=${publicKeyBase64}`,
    cryptoKey: publicKeyBase64,
  };
}

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const payloadStr = await req.json(); // Accept either webhook or direct invocation
    const { record, isCall, callerName, callType, recipientIds: directRecipients, chatId: callChatId } = payloadStr;

    // Create a service-role Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let recipientIds: string[] = [];
    let pushTitle = '';
    let pushBody = '';
    let pushChatId = '';
    let senderIdForMuteCheck = '';

    if (isCall) {
      recipientIds = directRecipients || [];
      pushTitle = `Incoming ${callType} call...`;
      pushBody = `${callerName} is calling you`;
      pushChatId = callChatId;
      senderIdForMuteCheck = payloadStr.callerId;
    } else {
      const message = record;
      if (!message || !message.sender_id || !message.chat_id) {
        return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 });
      }

      // Determine the recipient(s) from the chat_id
      const chatParts = message.chat_id.split('_');
      recipientIds = chatParts.filter((id: string) => id !== message.sender_id);
      senderIdForMuteCheck = message.sender_id;

      // Get sender info for notification text
      const { data: sender } = await supabase
        .from('users')
        .select('username, avatar')
        .eq('uid', message.sender_id)
        .single();

      const senderName = sender?.username || 'Someone';
      pushTitle = senderName;
      pushBody = message.text || (message.media_type === 'image' ? '📷 Photo' : '📎 File');
      pushChatId = message.chat_id;
    }

    if (recipientIds.length === 0) return new Response(JSON.stringify({ sent: 0 }));

    // Check if chat is muted for recipient
    for (const recipientId of recipientIds) {
      if (senderIdForMuteCheck) {
        const { data: chatRecord } = await supabase
          .from('user_chats')
          .select('muted')
          .eq('owner_id', recipientId)
          .eq('recipient_id', senderIdForMuteCheck)
          .single();

        if (chatRecord?.muted) {
          console.log(`Chat muted for recipient ${recipientId}, skipping push`);
          continue;
        }
      }

      // Get all push subscriptions for this recipient
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', recipientId);

      if (!subscriptions || subscriptions.length === 0) continue;

      // Build notification payload
      const payloadObj: any = {
        title: pushTitle,
        body: pushBody,
        chatId: pushChatId,
      };
      if (isCall) {
        payloadObj.isCall = true;
        payloadObj.callType = callType;
      }
      const notifPayload = JSON.stringify(payloadObj);

      // Send push to each subscription
      for (const sub of subscriptions) {
        try {
          const response = await fetch(sub.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/octet-stream',
              'Content-Encoding': 'aes128gcm',
              'TTL': '2419200',
            },
            body: notifPayload,
          });

          // Remove stale subscriptions (410 Gone)
          if (response.status === 410 || response.status === 404) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('id', sub.id);
          }
        } catch (pushErr) {
          console.error(`Push failed for ${sub.endpoint}:`, pushErr);
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-push error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
