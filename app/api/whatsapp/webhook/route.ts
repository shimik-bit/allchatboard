import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Green API webhook endpoint with allowlist + reply threading.
 *
 * Configure in Green API console → Settings → System notifications:
 *   URL: https://YOUR_DOMAIN/api/whatsapp/webhook?workspace=WORKSPACE_ID
 *   Enable: incomingMessageReceived
 *
 * Behavior:
 *   1. Phone must be in authorized_phones (allowlist) — else replies "אין הרשאה"
 *   2. If message quotes one of OUR previous outgoing messages → it's an UPDATE on a record
 *   3. Otherwise → AI classifies + creates a new record
 *   4. Always replies in WhatsApp with status confirmation
 */
export async function POST(req: NextRequest) {
  try {
    const workspaceId = req.nextUrl.searchParams.get('workspace');
    if (!workspaceId) {
      return NextResponse.json({ error: 'missing workspace param' }, { status: 400 });
    }

    const body = await req.json();
    if (body.typeWebhook !== 'incomingMessageReceived') {
      return NextResponse.json({ ok: true, ignored: body.typeWebhook });
    }

    const admin = createAdminClient();

    // Load workspace config
    const { data: workspace } = await admin
      .from('workspaces')
      .select('id, whatsapp_instance_id, whatsapp_token, business_description, ai_messages_used, ai_messages_limit')
      .eq('id', workspaceId)
      .single();

    if (!workspace) {
      return NextResponse.json({ error: 'workspace not found' }, { status: 404 });
    }

    // Extract message data
    const idMessage: string = body.idMessage || '';
    const chatId: string = body.senderData?.chatId || '';
    const senderPhone: string = (body.senderData?.sender || '').replace('@c.us', '').replace('@g.us', '');
    const senderName: string = body.senderData?.senderName || body.senderData?.chatName || '';
    const msgType: string = body.messageData?.typeMessage || '';

    // Detect quoted (reply) message — Green API puts stanzaId in different places
    const quotedMessageId: string | null =
      body.messageData?.quotedMessage?.stanzaId
      || body.messageData?.extendedTextMessageData?.stanzaId
      || body.messageData?.contextInfo?.stanzaId
      || null;

    let text = '';
    let mediaUrl: string | null = null;
    let mediaType: string | null = null;

    // Handle all message types that can carry text:
    // - textMessage: simple message
    // - extendedTextMessage: text with link/preview, also used for replies in some clients
    // - quotedMessage: explicit reply to another message (typeMessage='quotedMessage')
    // - reactionMessage: emoji reaction to a message
    // - imageMessage/videoMessage/documentMessage: media with optional caption
    if (msgType === 'textMessage') {
      text = body.messageData?.textMessageData?.textMessage || '';
    } else if (msgType === 'extendedTextMessage') {
      text = body.messageData?.extendedTextMessageData?.text
          || body.messageData?.textMessageData?.textMessage
          || '';
    } else if (msgType === 'quotedMessage') {
      // This is a REPLY — text could be in either of these places
      text = body.messageData?.extendedTextMessageData?.text
          || body.messageData?.textMessageData?.textMessage
          || '';
    } else if (msgType === 'reactionMessage') {
      // User reacted with emoji on a message → treat as a quick status update
      text = body.messageData?.extendedTextMessageData?.text
          || body.messageData?.reactionMessage?.text
          || '';
    } else if (msgType === 'audioMessage') {
      // Voice note (or sent audio file). No caption from WhatsApp UI for voice
      // notes — text starts empty and we'll fill it via Whisper transcription.
      text = body.messageData?.fileMessageData?.caption || '';
      mediaUrl = body.messageData?.fileMessageData?.downloadUrl || null;
      mediaType = body.messageData?.fileMessageData?.mimeType || 'audio';
    } else if (msgType === 'imageMessage' || msgType === 'videoMessage' || msgType === 'documentMessage') {
      text = body.messageData?.fileMessageData?.caption || '';
      mediaUrl = body.messageData?.fileMessageData?.downloadUrl || null;
      mediaType = body.messageData?.fileMessageData?.mimeType || msgType;
    }

    // ===== ALLOWLIST CHECK =====
    const { data: phoneRows } = await admin.rpc('find_authorized_phone', {
      ws_id: workspaceId,
      p_phone: senderPhone,
    });
    const authorizedPhone = phoneRows && phoneRows.length > 0 ? phoneRows[0] : null;

    // Group handling
    let groupId: string | null = null;
    if (chatId.endsWith('@g.us')) {
      const { data: group } = await admin
        .from('whatsapp_groups')
        .select('id, is_active')
        .eq('workspace_id', workspaceId)
        .eq('green_api_chat_id', chatId)
        .maybeSingle();

      if (group) {
        groupId = group.id;
        if (!group.is_active) {
          await saveMessage(admin, {
            workspace_id: workspaceId, group_id: groupId, green_api_message_id: idMessage,
            sender_phone: senderPhone, sender_name: senderName,
            authorized_phone_id: authorizedPhone?.id, text, media_url: mediaUrl, media_type: mediaType,
            quoted_message_id: quotedMessageId, status: 'ignored',
          });
          return NextResponse.json({ ok: true, status: 'group muted' });
        }
      } else {
        const { data: newGroup } = await admin
          .from('whatsapp_groups')
          .insert({
            workspace_id: workspaceId,
            green_api_chat_id: chatId,
            group_name: body.senderData?.chatName || 'קבוצה ללא שם',
            is_active: true,
          })
          .select('id').single();
        groupId = newGroup?.id || null;
      }
    }

    // Reject unauthorized phones
    if (!authorizedPhone || !authorizedPhone.is_active) {
      const messageId = await saveMessage(admin, {
        workspace_id: workspaceId, group_id: groupId, green_api_message_id: idMessage,
        sender_phone: senderPhone, sender_name: senderName,
        text, media_url: mediaUrl, media_type: mediaType,
        quoted_message_id: quotedMessageId, status: 'ignored',
        ai_error: 'מספר לא מורשה',
        update_action: 'rejected',
      });
      // Send polite rejection (only in private chats, not groups)
      if (!chatId.endsWith('@g.us') && workspace.whatsapp_instance_id && workspace.whatsapp_token) {
        await sendGreenApiReply({
          instanceId: workspace.whatsapp_instance_id,
          token: workspace.whatsapp_token,
          chatId,
          text: 'אין לך הרשאה לשלוח נתונים למערכת. פנה למנהל המערכת.',
          quotedMessageId: idMessage,
        });
      }
      return NextResponse.json({ ok: true, status: 'unauthorized' });
    }

    // Reader-only phones can QUERY but not create/update records
    const isReaderOnly = authorizedPhone.permission === 'reader';

    // Save the inbound message first (so we have a messageDbId for everything downstream)
    const messageDbId = await saveMessage(admin, {
      workspace_id: workspaceId, group_id: groupId, green_api_message_id: idMessage,
      sender_phone: senderPhone, sender_name: senderName,
      authorized_phone_id: authorizedPhone.id,
      text, media_url: mediaUrl, media_type: mediaType,
      quoted_message_id: quotedMessageId, status: 'received',
    });
    if (!messageDbId) {
      return NextResponse.json({ error: 'failed to save message' }, { status: 500 });
    }

    // ===== MEDIA PROCESSING =====
    // Voice notes get transcribed; images get described. The result is folded
    // into `text` so the rest of the pipeline (query/classify/update) works
    // identically whether the message arrived as text, voice, or image.
    if (mediaUrl && mediaType) {
      const isAudio = msgType === 'audioMessage' || mediaType.startsWith('audio');
      const isImage = msgType === 'imageMessage' || mediaType.startsWith('image');

      if (isAudio || isImage) {
        const downloaded = await downloadMedia(mediaUrl);
        if (downloaded) {
          if (isAudio) {
            const transcript = await transcribeAudio(downloaded.bytes, downloaded.contentType);
            if (transcript && transcript.trim()) {
              // Replace text with the transcript (voice notes have no caption anyway)
              text = transcript.trim();
            }
          } else if (isImage) {
            const description = await describeImage(downloaded.bytes, downloaded.contentType, text);
            if (description && description.trim()) {
              // Combine the user's caption (if any) with the AI description so the
              // classifier sees both — caption is the user's intent, description
              // is what's actually in the photo.
              text = text.trim()
                ? `${text.trim()}\n[תיאור התמונה: ${description.trim()}]`
                : `[תיאור התמונה: ${description.trim()}]`;
            }
          }

          // Persist the enriched text back to wa_messages so it shows in admin
          // panel and feeds future conversation history correctly.
          if (text.trim()) {
            await admin.from('wa_messages')
              .update({ text })
              .eq('id', messageDbId);
          }
        }
      }
    }

    // ===== CONVERSATION HISTORY =====
    // Load context based on user signals:
    //   - User replied to a message → walk the quote chain
    //   - User sent a follow-up within 30s → include the previous message
    //   - Otherwise → no history (treat as standalone, prevents field bleed)
    const conversationHistory = await loadConversationHistory({
      admin, workspaceId,
      senderPhone, groupId,
      excludeMessageId: messageDbId,
      quotedMessageId,
    });

    // ===== QUERY DETECTION =====
    // Before deciding if this is a create/update, check if it's a READ query.
    // Admin + reader can query; writer can also query but mainly creates.
    // Heuristic: questions, "list/show me", imperatives like "תן לי"
    const looksLikeQuery = /^(רשימת|תן\s*לי|תראה\s*לי|מה|כמה|איפה|מי|הראה|show|list|how\s*many|what|which|give\s*me|report|דו[״"']ח)/i
      .test(text.trim())
      || /\?$/.test(text.trim());

    if (looksLikeQuery && !quotedMessageId && text.trim()) {
      // Only run query flow for non-reply messages with actual text
      try {
        const queryResult = await handleQuery({
          admin, workspaceId, messageDbId, text,
          businessDescription: workspace.business_description || '',
          authorizedPhone,
          history: conversationHistory,
        });

        if (queryResult.matched) {
          if (workspace.whatsapp_instance_id && workspace.whatsapp_token) {
            await sendGreenApiReply({
              instanceId: workspace.whatsapp_instance_id,
              token: workspace.whatsapp_token,
              chatId,
              text: queryResult.responseText,
              quotedMessageId: idMessage,
              persist: { admin, workspaceId, senderPhone, groupId },
            });
          }
          return NextResponse.json({ ok: true, action: 'query', matched: true });
        }
        // Not matched as query → fall through to normal create flow
      } catch (e: any) {
        console.error('Query handler error:', e);
        // Fall through to classify
      }
    }

    // Reader-only phones can't create/update — reject here (queries already handled above)
    if (isReaderOnly) {
      await admin.from('wa_messages').update({
        status: 'ignored',
        ai_error: 'הרשאה: צופה בלבד - יכול רק לשלוח שאלות',
        update_action: 'rejected',
        processed_at: new Date().toISOString(),
      }).eq('id', messageDbId);

      if (workspace.whatsapp_instance_id && workspace.whatsapp_token) {
        await sendGreenApiReply({
          instanceId: workspace.whatsapp_instance_id,
          token: workspace.whatsapp_token,
          chatId,
          text: `${authorizedPhone.display_name}, יש לך הרשאת צפייה בלבד. אפשר לשאול שאלות (לדוגמה: "רשימת תקלות פתוחות"), אבל לא ליצור רשומות חדשות.`,
          quotedMessageId: idMessage,
        });
      }
      return NextResponse.json({ ok: true, status: 'reader cannot write' });
    }

    // Handle empty text (possibly a reaction)
    if (!text.trim()) {
      const isReaction = msgType === 'reactionMessage';
      if (isReaction && quotedMessageId) {
        text = '✅';
      } else {
        await admin.from('wa_messages')
          .update({ status: 'ignored', processed_at: new Date().toISOString() })
          .eq('id', messageDbId);
        return NextResponse.json({ ok: true, status: 'no text' });
      }
    }

    // ===== REPLY DETECTION =====
    // Strategy 1: quoted message ID matches a record's last_wa_message_id
    // Strategy 2: fallback — if message has quoted_message_id but no match,
    //             OR message text strongly implies an update ("טופל", "בוצע")
    //             → find the most recent record created from this chat_id
    const looksLikeUpdate = /^\s*(טופל|בוצע|סגור|הושלם|סיימתי|נסגר|done|closed|resolved|fixed|✅|👍|✔)\s*$/i
      .test(text.trim());
    const hasQuote = !!quotedMessageId;

    if (hasQuote || looksLikeUpdate) {
      // Try strategy 1: exact quoted message match
      let parentRecord: any = null;

      if (quotedMessageId) {
        const { data } = await admin
          .from('records')
          .select('id, table_id, data, last_wa_message_id, tables(name, slug)')
          .eq('workspace_id', workspaceId)
          .eq('last_wa_message_id', quotedMessageId)
          .maybeSingle();
        parentRecord = data;
      }

      // Strategy 2: fallback to most-recent record from this chat
      // (Green API's sendMessage-returned id doesn't always match the stanza id
      //  that comes back on replies, so we need a fuzzy match)
      if (!parentRecord) {
        const { data } = await admin
          .from('records')
          .select('id, table_id, data, last_wa_message_id, tables(name, slug)')
          .eq('workspace_id', workspaceId)
          .eq('source_chat_id', chatId)
          .order('created_at', { ascending: false })
          .limit(1);
        // Only use fallback if reply was sent within 2 hours of record creation
        if (data && data.length > 0) {
          const { data: fullRecord } = await admin
            .from('records')
            .select('id, table_id, data, last_wa_message_id, tables(name, slug), created_at')
            .eq('id', data[0].id)
            .single();
          if (fullRecord) {
            const ageMs = Date.now() - new Date(fullRecord.created_at).getTime();
            if (ageMs < 2 * 60 * 60 * 1000) { // 2 hours
              parentRecord = fullRecord;
            }
          }
        }
      }

      if (parentRecord) {
        try {
          const result = await processUpdate({
            admin, workspaceId, messageDbId,
            record: parentRecord, replyText: text,
            authorizedPhone, businessDescription: workspace.business_description || '',
            history: conversationHistory,
          });

          if (workspace.whatsapp_instance_id && workspace.whatsapp_token) {
            const sentId = await sendGreenApiReply({
              instanceId: workspace.whatsapp_instance_id,
              token: workspace.whatsapp_token,
              chatId,
              text: result.confirmationText,
              quotedMessageId: idMessage,
              persist: { admin, workspaceId, senderPhone, groupId },
            });
            if (sentId) {
              await admin.from('records')
                .update({ last_wa_message_id: sentId })
                .eq('id', parentRecord.id);
            }
          }

          return NextResponse.json({ ok: true, action: 'updated', recordId: parentRecord.id });
        } catch (e: any) {
          await admin.from('wa_messages').update({
            status: 'failed', ai_error: e?.message,
            processed_at: new Date().toISOString(),
          }).eq('id', messageDbId);
          return NextResponse.json({ ok: true, error: e?.message });
        }
      }
      // No parent record found → fall through to normal classify
    }

    // ===== NORMAL CLASSIFY + INSERT =====
    if (workspace.ai_messages_used >= workspace.ai_messages_limit) {
      await admin.from('wa_messages').update({
        status: 'failed', ai_error: 'הוגעה תקרת ה-AI החודשית',
        processed_at: new Date().toISOString(),
      }).eq('id', messageDbId);
      return NextResponse.json({ ok: true, status: 'quota exceeded' });
    }

    try {
      const result = await classifyAndInsert({
        admin, workspaceId, messageDbId, text,
        businessDescription: workspace.business_description || '',
        authorizedPhone,
        senderPhone, chatId, greenMessageId: idMessage,
        history: conversationHistory,
      });

      // Always reply in WhatsApp with confirmation
      if (workspace.whatsapp_instance_id && workspace.whatsapp_token) {
        const replyText = buildCreateReply(result, authorizedPhone);
        const sentId = await sendGreenApiReply({
          instanceId: workspace.whatsapp_instance_id,
          token: workspace.whatsapp_token,
          chatId,
          text: replyText,
          quotedMessageId: idMessage,
          persist: { admin, workspaceId, senderPhone, groupId },
        });
        // Save outgoing reply id on the record so future replies map back
        if (sentId && result.recordId) {
          await admin.from('records')
            .update({ last_wa_message_id: sentId })
            .eq('id', result.recordId);
        }

        // ──────────────────────────────────────────────────────────────
        // ASSIGNEE NOTIFICATION
        // After the record is created, check if any assignment rule
        // matches its category. If yes, assign + notify the assignee
        // privately on WhatsApp. Failures are logged but don't fail
        // the request (the user already got their confirmation).
        // ──────────────────────────────────────────────────────────────
        if (result.recordId) {
          try {
            await resolveAndNotifyAssignee({
              admin,
              workspaceId,
              recordId: result.recordId,
              tableId: result.tableId,
              tableName: result.tableName,
              recordData: result.fieldsExtracted,
              instanceId: workspace.whatsapp_instance_id,
              token: workspace.whatsapp_token,
              senderName: authorizedPhone?.display_name || senderPhone,
              groupName: groupId ? (await getGroupName(admin, groupId)) : null,
            });
          } catch (notifyErr) {
            console.error('assignee notification failed', notifyErr);
            // non-fatal — user already got their confirmation
          }
        }
      }

      return NextResponse.json({ ok: true, ...result });
    } catch (e: any) {
      await admin.from('wa_messages').update({
        status: 'failed', ai_error: e?.message,
        processed_at: new Date().toISOString(),
      }).eq('id', messageDbId);
      return NextResponse.json({ ok: true, error: e?.message });
    }
  } catch (e: any) {
    console.error('Webhook error:', e);
    return NextResponse.json({ ok: false, error: e?.message }, { status: 200 });
  }
}

// ============================================================================
// HELPERS
// ============================================================================

async function saveMessage(admin: any, data: any): Promise<string | null> {
  const { data: saved } = await admin
    .from('wa_messages')
    .insert({ ...data, direction: 'in' })
    .select('id').single();
  return saved?.id || null;
}

function buildCreateReply(result: any, phone: any): string {
  if (!result.success) {
    return `${phone.display_name || ''}, לא הצלחנו לסווג את ההודעה. נסה לכתוב יותר ספציפי. (${result.reason || ''})`;
  }
  const fields = result.fieldsExtracted
    ? Object.entries(result.fieldsExtracted).slice(0, 3)
        .map(([k, v]) => `${k}: ${v}`).join(', ')
    : '';
  return `✓ נרשם ב-${result.tableName}\n${fields}\n\n💬 השב להודעה זו לעדכון (לדוגמה: "טופל", "סגור", "שינוי כתובת ל...")`;
}

// ============================================================================
// CLASSIFY NEW MESSAGE → INSERT RECORD
// ============================================================================

async function classifyAndInsert(opts: {
  admin: any;
  workspaceId: string;
  messageDbId: string;
  text: string;
  businessDescription: string;
  authorizedPhone: any;
  senderPhone: string;
  chatId: string;
  greenMessageId: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}) {
  const { admin, workspaceId, messageDbId, text, businessDescription, authorizedPhone } = opts;
  const history = opts.history || [];

  // Load workspace tables + fields for the AI prompt
  const { data: tables } = await admin
    .from('tables')
    .select('id, name, slug, ai_keywords, description, default_assignee_phone_id')
    .eq('workspace_id', workspaceId)
    .eq('is_archived', false)
    .order('position');

  if (!tables || tables.length === 0) {
    throw new Error('לא הוגדרו טבלאות');
  }

  const { data: allFields } = await admin
    .from('fields')
    .select('id, table_id, name, slug, type, is_required, config, ai_extraction_hint, is_primary')
    .in('table_id', tables.map((t: any) => t.id))
    .order('position');

  const fieldsByTable = new Map<string, any[]>();
  for (const f of allFields || []) {
    if (!fieldsByTable.has(f.table_id)) fieldsByTable.set(f.table_id, []);
    fieldsByTable.get(f.table_id)!.push(f);
  }

  // For relation fields, load up to 100 records from the referenced table so AI
  // knows what values exist and can match (e.g. "תקלה אצל יוסי" → yossi's record id)
  const relationSamples = new Map<string, { id: string; label: string }[]>();
  const relationFields = (allFields || []).filter((f: any) => f.type === 'relation' && f.config?.relation_table_id);
  for (const rf of relationFields) {
    if (relationSamples.has(rf.id)) continue;
    const { data: sample } = await admin.rpc('list_records_for_dropdown', {
      p_table_id: rf.config.relation_table_id,
    });
    relationSamples.set(rf.id, (sample || []).slice(0, 100).map((r: any) => ({
      id: r.id, label: r.display_name,
    })));
  }

  const schema = tables.map((t: any) => ({
    slug: t.slug,
    name: t.name,
    keywords: t.ai_keywords || [],
    description: t.description || '',
    fields: (fieldsByTable.get(t.id) || []).map((f) => {
      const baseField: any = {
        slug: f.slug,
        name: f.name,
        type: f.type,
        required: f.is_required,
        hint: f.ai_extraction_hint || '',
        options: f.config?.options?.map((o: any) => o.value) || undefined,
      };
      if (f.type === 'relation') {
        const samples = relationSamples.get(f.id) || [];
        // Tell AI the linked records — use their IDs as enum + labels as hints
        baseField.existing_records = samples.map((s) => ({ id: s.id, name: s.label }));
        baseField.relation_hint = 'מצא בהודעה שם/כתובת שתואם לאחת מהרשומות הקיימות, והחזר את ה-id שלה. אם אין התאמה, החזר null.';
      }
      return baseField;
    }),
  }));

  const senderInfo = authorizedPhone
    ? `${authorizedPhone.display_name}${authorizedPhone.job_title ? ` (${authorizedPhone.job_title})` : ''}`
    : 'לא ידוע';

  const systemPrompt = `אתה עוזר שמסווג הודעות וואטסאפ בעברית לטבלאות.
${businessDescription ? `תיאור העסק: ${businessDescription}\n` : ''}
הטבלאות הזמינות:
${JSON.stringify(schema, null, 2)}

המשתמש: ${senderInfo}

החזר אך ורק JSON תקין:
{
  "table_slug": "<slug או null>",
  "confidence": <0.0-1.0>,
  "data": { "<field_slug>": <value> },
  "reasoning": "<קצר>"
}

כללים:
- table_slug: null אם זה לא נתון לשמירה (שיחת חולין, שאלה)
- select/status: רק ערך מתוך options
- date: YYYY-MM-DD | datetime: ISO 8601 | number/currency: מספר
- אל תמציא שדות
- confidence < 0.5 = לא בטוח

⚠️ חשוב מאוד - הקשר השיחה:
- הודעות קודמות (אם יש) מוצגות לך רק כדי לפענח התייחסויות והשלמות שהמשתמש מבטא במפורש (כמו "אצל יוסי" כהמשך לתקלה שתואר רגע קודם).
- אם המשתמש לא מתייחס בבירור להודעה הקודמת (למשל פשוט שולח משימה חדשה) - התעלם מההיסטוריה לחלוטין ואל תעתיק שדות (assignee, property, status וכו') מההודעה הקודמת.
- דוגמה: היסטוריה="משימה ליוסי לתקן רכב", הודעה נוכחית="לנקות עמוד" → צור משימה חדשה עם description=לנקות עמוד בלבד, ללא assignee.`;

  // Build messages with history (oldest first) followed by the current message
  const aiMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...history,
    { role: 'user', content: text },
  ];
  const aiRes = await callOpenAIWithMessages(systemPrompt, aiMessages);
  const classification = JSON.parse(aiRes);

  await incrementAiUsage(admin, workspaceId);

  if (!classification.table_slug || classification.confidence < 0.5) {
    await admin.from('wa_messages').update({
      status: 'classified', ai_classification: classification,
      processed_at: new Date().toISOString(),
    }).eq('id', messageDbId);
    return { success: false, reason: classification.reasoning || 'לא בטוח', classification };
  }

  const targetTable = tables.find((t: any) => t.slug === classification.table_slug);
  if (!targetTable) {
    throw new Error(`טבלה "${classification.table_slug}" לא נמצאה`);
  }

  const { data: newRecord, error: insertError } = await admin
    .from('records')
    .insert({
      table_id: targetTable.id,
      workspace_id: workspaceId,
      data: classification.data || {},
      source: 'whatsapp',
      source_message_id: messageDbId,
      ai_confidence: classification.confidence,
      authorized_phone_id: authorizedPhone?.id,
      source_phone: opts.senderPhone,
      source_chat_id: opts.chatId,
      source_message_green_id: opts.greenMessageId,
      assignee_phone_id: targetTable.default_assignee_phone_id || null,
    }).select('id').single();

  if (insertError) throw new Error(insertError.message);

  await admin.from('wa_messages').update({
    status: 'inserted', ai_classification: classification,
    record_id: newRecord.id, update_action: 'created',
    processed_at: new Date().toISOString(),
  }).eq('id', messageDbId);

  return {
    success: true,
    recordId: newRecord.id,
    tableId: targetTable.id,
    tableName: targetTable.name,
    fieldsExtracted: classification.data || {},
    confidence: classification.confidence,
  };
}

// ============================================================================
// PROCESS REPLY → UPDATE EXISTING RECORD
// ============================================================================

async function processUpdate(opts: {
  admin: any;
  workspaceId: string;
  messageDbId: string;
  record: any;
  replyText: string;
  authorizedPhone: any;
  businessDescription: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}) {
  const { admin, workspaceId, messageDbId, record, replyText, authorizedPhone, businessDescription } = opts;
  const history = opts.history || [];

  // Get the table's fields to know what can be updated
  const { data: fields } = await admin
    .from('fields')
    .select('name, slug, type, config')
    .eq('table_id', record.table_id)
    .order('position');

  const tableName = record.tables?.name || 'הרשומה';

  const fieldsSchema = (fields || []).map((f: any) => ({
    slug: f.slug,
    name: f.name,
    type: f.type,
    options: f.config?.options?.map((o: any) => ({ value: o.value, label: o.label })) || undefined,
  }));

  // FAST PATH: if text is a clear "completion" signal, auto-find a status field
  // and set it to a "closed" option — don't rely on AI for simple cases.
  const isCompletionSignal = /^\s*(טופל|בוצע|סגור|הושלם|סיימתי|נסגר|done|closed|resolved|fixed|✅|👍|✔)\s*$/i
    .test(replyText.trim());

  if (isCompletionSignal) {
    // Find a status/select field with a "closed" option
    const statusField = (fields || []).find((f: any) =>
      (f.type === 'status' || f.type === 'select') &&
      f.config?.options?.some((o: any) =>
        /טופל|בוצע|סגור|הושלם|resolved|closed|done|completed/i.test(o.label) ||
        /טופל|בוצע|סגור|הושלם|resolved|closed|done|completed/i.test(o.value)
      )
    );

    if (statusField) {
      const closedOption = statusField.config.options.find((o: any) =>
        /טופל|בוצע|סגור|הושלם|resolved|closed|done|completed/i.test(o.label) ||
        /טופל|בוצע|סגור|הושלם|resolved|closed|done|completed/i.test(o.value)
      );

      const newData = { ...record.data, [statusField.slug]: closedOption.value };
      const { error: updateError } = await admin
        .from('records')
        .update({ data: newData, updated_at: new Date().toISOString() })
        .eq('id', record.id);

      if (updateError) throw new Error(updateError.message);

      await admin.from('wa_messages').update({
        status: 'inserted',
        ai_classification: { action: 'update', fastPath: true, field: statusField.slug, value: closedOption.value },
        record_id: record.id, update_action: 'updated',
        processed_at: new Date().toISOString(),
      }).eq('id', messageDbId);

      // Increment is not needed here since we didn't use AI
      return {
        success: true,
        confirmationText: `✓ עודכן ב-${tableName}\n${statusField.name}: ${closedOption.label}\n\nתודה ${authorizedPhone?.display_name || ''}!`,
      };
    }
  }

  // Otherwise, go through AI for richer interpretation

  const senderInfo = authorizedPhone
    ? `${authorizedPhone.display_name}${authorizedPhone.job_title ? ` (${authorizedPhone.job_title})` : ''}`
    : 'לא ידוע';

  const systemPrompt = `אתה עוזר שמעדכן רשומה קיימת לפי תגובת משתמש בוואטסאפ.
${businessDescription ? `תיאור העסק: ${businessDescription}\n` : ''}
הרשומה הנוכחית מטבלת "${tableName}":
${JSON.stringify(record.data, null, 2)}

השדות הזמינים לעדכון:
${JSON.stringify(fieldsSchema, null, 2)}

המשתמש (${senderInfo}) שלח תגובה. עליך להבין:
1. אילו שדות הוא רוצה לעדכן
2. אם יש שדה "סטטוס" / "status" — מילים כמו "טופל", "בוצע", "סגור", "סיימתי", "✅" → סטטוס לערך הסופי
3. אם הוא רק מבקש מידע (שאלה) — אל תעדכן

⚠️ הודעות קודמות בשיחה הן רק לפענוח כינויים והפניות (כמו "וגם תוסיף הערה"). העדכון חייב להיות מבוסס אך ורק על ההודעה הנוכחית - אל תעדכן שדות שהמשתמש לא הזכיר עכשיו.

החזר אך ורק JSON:
{
  "action": "update" | "query" | "ignore",
  "updates": { "<field_slug>": <new_value> },
  "summary": "<תיאור קצר בעברית של מה התבצע>"
}`;

  const aiMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...history,
    { role: 'user', content: replyText },
  ];
  const aiRes = await callOpenAIWithMessages(systemPrompt, aiMessages);
  const result = JSON.parse(aiRes);

  await incrementAiUsage(admin, workspaceId);

  if (result.action === 'ignore' || !result.updates || Object.keys(result.updates).length === 0) {
    await admin.from('wa_messages').update({
      status: 'classified', ai_classification: result,
      record_id: record.id, update_action: result.action === 'query' ? 'queried' : 'ignored',
      processed_at: new Date().toISOString(),
    }).eq('id', messageDbId);

    if (result.action === 'query') {
      return { success: true, confirmationText: `${result.summary || 'מידע התקבל'}\n\nפרטי הרשומה:\n${formatRecord(record.data, fields)}` };
    }
    return { success: true, confirmationText: 'לא הבנתי איזה עדכון לבצע. נסה לכתוב יותר ספציפי.' };
  }

  // Apply updates
  const newData = { ...record.data, ...result.updates };
  const { error: updateError } = await admin
    .from('records')
    .update({ data: newData, updated_at: new Date().toISOString() })
    .eq('id', record.id);

  if (updateError) throw new Error(updateError.message);

  await admin.from('wa_messages').update({
    status: 'inserted', ai_classification: result,
    record_id: record.id, update_action: 'updated',
    processed_at: new Date().toISOString(),
  }).eq('id', messageDbId);

  const updateLabels = Object.entries(result.updates)
    .map(([k, v]) => {
      const f = fields?.find((x: any) => x.slug === k);
      return `${f?.name || k}: ${formatValue(v, f)}`;
    })
    .join('\n');

  return {
    success: true,
    confirmationText: `✓ עודכן ב-${tableName}\n${updateLabels}\n\nתודה ${authorizedPhone?.display_name || ''}!`,
  };
}

function formatValue(v: any, field?: any): string {
  if (v === null || v === undefined) return '—';
  if (field?.config?.options) {
    const opt = field.config.options.find((o: any) => o.value === v);
    return opt?.label || String(v);
  }
  return String(v);
}

function formatRecord(data: Record<string, any>, fields: any[]): string {
  if (!fields) return JSON.stringify(data);
  return fields.slice(0, 5).map((f) => `${f.name}: ${formatValue(data?.[f.slug], f)}`).join('\n');
}

// ============================================================================
// QUERY HANDLER — "רשימת תקלות פתוחות", "נכסים פנויים", etc.
// ============================================================================

async function handleQuery(opts: {
  admin: any;
  workspaceId: string;
  messageDbId: string;
  text: string;
  businessDescription: string;
  authorizedPhone: any;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<{ matched: boolean; responseText: string }> {
  const { admin, workspaceId, messageDbId, text, businessDescription, authorizedPhone } = opts;
  const history = opts.history || [];

  // Load tables + fields so AI knows what's queryable
  const { data: tables } = await admin
    .from('tables')
    .select('id, name, slug, icon, ai_keywords')
    .eq('workspace_id', workspaceId)
    .eq('is_archived', false)
    .order('position');

  if (!tables || tables.length === 0) {
    return { matched: false, responseText: '' };
  }

  const { data: allFields } = await admin
    .from('fields')
    .select('id, table_id, name, slug, type, is_primary, config')
    .in('table_id', tables.map((t: any) => t.id))
    .order('position');

  const fieldsByTable = new Map<string, any[]>();
  for (const f of allFields || []) {
    if (!fieldsByTable.has(f.table_id)) fieldsByTable.set(f.table_id, []);
    fieldsByTable.get(f.table_id)!.push(f);
  }

  // Load relation samples so AI can translate names/addresses in queries
  // (e.g. "תקלות של יוסי כהן") into the actual record IDs stored on records
  const relationSamples = new Map<string, { id: string; label: string }[]>();
  const relationFields = (allFields || []).filter((f: any) => f.type === 'relation' && f.config?.relation_table_id);
  for (const rf of relationFields) {
    if (relationSamples.has(rf.id)) continue;
    const { data: sample } = await admin.rpc('list_records_for_dropdown', {
      p_table_id: rf.config.relation_table_id,
    });
    relationSamples.set(rf.id, (sample || []).slice(0, 100).map((r: any) => ({
      id: r.id, label: r.display_name,
    })));
  }

  // Build compact schema for AI
  const schema = tables.map((t: any) => ({
    slug: t.slug,
    name: t.name,
    keywords: t.ai_keywords || [],
    fields: (fieldsByTable.get(t.id) || []).map((f: any) => {
      const baseField: any = {
        slug: f.slug,
        name: f.name,
        type: f.type,
        is_primary: f.is_primary,
        options: f.config?.options?.map((o: any) => ({ value: o.value, label: o.label })) || undefined,
      };
      if (f.type === 'relation') {
        const samples = relationSamples.get(f.id) || [];
        baseField.existing_records = samples.map((s) => ({ id: s.id, name: s.label }));
        baseField.relation_hint = 'כשהמשתמש מזכיר שם/כתובת שתואם לרשומה קיימת, השתמש ב-id שלה כערך בפילטר (operator: eq).';
      }
      return baseField;
    }),
  }));

  const systemPrompt = `אתה עוזר שמזהה שאילתות-קריאה מהודעות וואטסאפ בעברית ומתרגם אותן לחיפוש בטבלאות.
${businessDescription ? `תיאור העסק: ${businessDescription}\n` : ''}
הטבלאות:
${JSON.stringify(schema, null, 2)}

המשתמש שאל. החזר JSON:
{
  "is_query": true | false,
  "table_slug": "<באיזו טבלה לחפש>",
  "filters": [
    { "field_slug": "...", "operator": "eq|neq|in|not_in|gt|lt|contains", "value": <ערך> }
  ],
  "intent": "list" | "count" | "detail",
  "limit": <מספר רשומות מקסימלי, ברירת מחדל 10>,
  "summary": "<איך לקרוא לתוצאה, לדוגמה: 'תקלות פתוחות' או 'נכסים פנויים'>"
}

דוגמאות:
- "רשימת תקלות פתוחות" → table: issues, filter: status neq resolved, intent: list
- "כמה תקלות דחופות יש?" → table: issues, filter: urgency eq high, intent: count
- "נכסים פנויים" → table: properties, filter: status eq vacant, intent: list
- "שוכרים עם חוזה שמסתיים החודש" → table: tenants, filter: lease_end between...
- "תקלות של יוסי כהן" → מצא את יוסי ב-existing_records של שדה relation, filter: <relation_field> eq "<uuid>", intent: list

⚠️ חשוב: הודעות קודמות בשיחה מוצגות לך רק לצורך פענוח כינויי גוף והפניות (כמו "תוסיף תאריך", "תן לי גם מקום"). כשהמשתמש שואל שאלה חדשה לחלוטין שלא קשורה לשאילתה הקודמת - התעלם מההיסטוריה.

אם זו לא שאילתה-קריאה (מדובר ביצירה/עדכון) → החזר {"is_query": false}`;

  let parsed: any;
  try {
    const aiMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...history,
      { role: 'user', content: text },
    ];
    const aiRes = await callOpenAIWithMessages(systemPrompt, aiMessages);
    parsed = JSON.parse(aiRes);
    await incrementAiUsage(admin, workspaceId);
  } catch {
    return { matched: false, responseText: '' };
  }

  if (!parsed.is_query || !parsed.table_slug) {
    return { matched: false, responseText: '' };
  }

  const targetTable = tables.find((t: any) => t.slug === parsed.table_slug);
  if (!targetTable) return { matched: false, responseText: '' };

  const tableFields = fieldsByTable.get(targetTable.id) || [];

  // Fetch ALL records for this table (we'll filter in JS — simpler than building
  // dynamic JSON-path queries for every operator)
  const { data: records } = await admin
    .from('records')
    .select('id, data, created_at, source_phone, notes')
    .eq('table_id', targetTable.id)
    .order('created_at', { ascending: false })
    .limit(200);

  if (!records || records.length === 0) {
    return {
      matched: true,
      responseText: `📋 ${parsed.summary || targetTable.name}\n\nלא נמצאו רשומות`,
    };
  }

  // Apply filters
  const filtered = (records as any[]).filter((r: any) => {
    for (const f of (parsed.filters || [])) {
      const val = r.data?.[f.field_slug];
      switch (f.operator) {
        case 'eq':
          if (val !== f.value) return false;
          break;
        case 'neq':
          if (val === f.value) return false;
          break;
        case 'in':
          if (!Array.isArray(f.value) || !f.value.includes(val)) return false;
          break;
        case 'not_in':
          if (Array.isArray(f.value) && f.value.includes(val)) return false;
          break;
        case 'gt':
          if (!(Number(val) > Number(f.value))) return false;
          break;
        case 'lt':
          if (!(Number(val) < Number(f.value))) return false;
          break;
        case 'contains':
          if (!String(val || '').toLowerCase().includes(String(f.value).toLowerCase())) return false;
          break;
      }
    }
    return true;
  });

  const limit = Math.min(parsed.limit || 10, 20);

  // Mark message as handled
  await admin.from('wa_messages').update({
    status: 'classified',
    ai_classification: { ...parsed, result_count: filtered.length },
    update_action: 'queried',
    processed_at: new Date().toISOString(),
  }).eq('id', messageDbId);

  // Format response based on intent
  if (parsed.intent === 'count') {
    return {
      matched: true,
      responseText: `📊 ${parsed.summary || targetTable.name}\n\n*${filtered.length}* רשומות`,
    };
  }

  if (filtered.length === 0) {
    return {
      matched: true,
      responseText: `📋 ${parsed.summary || targetTable.name}\n\n✨ אין רשומות תואמות - הכל מסודר!`,
    };
  }

  // List format
  const primaryField = tableFields.find((f: any) => f.is_primary) || tableFields[0];
  const secondaryFields = tableFields.filter((f: any) => !f.is_primary).slice(0, 3);

  const items = filtered.slice(0, limit).map((r: any, i: number) => {
    const title = primaryField ? (r.data?.[primaryField.slug] || '—') : '—';
    const details = secondaryFields
      .map((f: any) => {
        const v = r.data?.[f.slug];
        if (v === null || v === undefined || v === '') return null;
        const label = formatValue(v, f);
        return `${f.name}: ${label}`;
      })
      .filter(Boolean)
      .join(' · ');
    return `${i + 1}. *${title}*${details ? `\n   ${details}` : ''}`;
  }).join('\n\n');

  let response = `${targetTable.icon || '📋'} *${parsed.summary || targetTable.name}* (${filtered.length})\n\n${items}`;
  if (filtered.length > limit) {
    response += `\n\n_...ועוד ${filtered.length - limit} רשומות_`;
  }

  return { matched: true, responseText: response };
}

// ============================================================================
// OPENAI CALL
// ============================================================================

async function callOpenAI(systemPrompt: string, userMsg: string): Promise<string> {
  return callOpenAIWithMessages(systemPrompt, [
    { role: 'user', content: userMsg },
  ]);
}

/**
 * Same as callOpenAI but accepts a custom messages array — useful for passing
 * conversation history (3 most recent in/out turns) so the AI can resolve
 * references like "send it with a date" → understands "it" = the previous list.
 */
async function callOpenAIWithMessages(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) throw new Error('OPENAI_API_KEY not configured');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
  });

  if (!res.ok) throw new Error(`OpenAI: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI החזיר תשובה ריקה');
  return content;
}

// ============================================================================
// MEDIA HANDLERS — transcribe voice notes & describe images
// ============================================================================

/**
 * Download a media file from a URL (e.g. Green API's downloadUrl) and return
 * its bytes. Green API URLs are time-limited so we must fetch them right when
 * the webhook fires.
 */
async function downloadMedia(url: string): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error('media download failed', res.status, url);
      return null;
    }
    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    const bytes = await res.arrayBuffer();
    return { bytes, contentType };
  } catch (e) {
    console.error('downloadMedia threw', e);
    return null;
  }
}

/**
 * Transcribe an audio voice note using OpenAI Whisper (Hebrew-friendly).
 * We use whisper-1 because it's Whisper's best transcription model and is
 * dramatically cheaper than running gpt-4o-audio for raw transcription.
 * Returns the transcript text or null on failure.
 */
async function transcribeAudio(audioBytes: ArrayBuffer, contentType: string): Promise<string | null> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return null;

  try {
    // WhatsApp voice notes from Green API typically arrive as audio/ogg (opus).
    // Whisper accepts ogg directly — no conversion needed.
    const ext = contentType.includes('ogg') ? 'ogg'
              : contentType.includes('mp4') || contentType.includes('m4a') ? 'm4a'
              : contentType.includes('mpeg') ? 'mp3'
              : contentType.includes('wav') ? 'wav'
              : 'ogg';

    const form = new FormData();
    form.append('file', new Blob([audioBytes], { type: contentType }), `voice.${ext}`);
    form.append('model', 'whisper-1');
    form.append('language', 'he'); // bias toward Hebrew, still works for Hebrew+English mix

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}` },
      body: form,
    });

    if (!res.ok) {
      console.error('Whisper failed', res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const data = await res.json();
    return data.text || null;
  } catch (e) {
    console.error('transcribeAudio threw', e);
    return null;
  }
}

/**
 * Describe an image using GPT-4o vision. Returns a Hebrew description that's
 * good enough to feed into the classifier (e.g. "תמונה של דליפת מים מתחת
 * לכיור" gives the classifier enough signal to file as an issue).
 *
 * We send the image as a data URL — simpler than uploading and works fine for
 * the typical phone-photo size of a few hundred KB.
 */
async function describeImage(imageBytes: ArrayBuffer, contentType: string, userCaption: string): Promise<string | null> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return null;

  try {
    // Convert to base64 data URL. atob/btoa-friendly chunked conversion to
    // avoid blowing the call stack on multi-MB images.
    const bytes = new Uint8Array(imageBytes);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
    }
    const base64 = Buffer.from(binary, 'binary').toString('base64');
    const dataUrl = `data:${contentType};base64,${base64}`;

    const prompt = userCaption
      ? `המשתמש שלח את התמונה הזאת עם הכיתוב: "${userCaption}". תאר בקצרה מה רואים בתמונה (משפט-שניים בעברית) באופן שיעזור לסווג אותה לטבלה במערכת ניהול עסקי.`
      : 'תאר בקצרה מה רואים בתמונה (משפט-שניים בעברית) באופן שיעזור לסווג אותה לטבלה במערכת ניהול עסקי. אם זו תקלה/נזק/חשבונית/קבלה/מסמך - ציין זאת.';

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o', // vision-capable; -mini also works but is less accurate for messy phone photos
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
          ],
        }],
      }),
    });

    if (!res.ok) {
      console.error('vision call failed', res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.error('describeImage threw', e);
    return null;
  }
}

// ============================================================================
// CONVERSATION HISTORY — load relevant context for AI
// ============================================================================

/**
 * Decide what context the AI needs based on user signals:
 *
 *   1. User replied to a specific message → walk the quote chain backwards
 *      and return the full thread (oldest → newest). This is the explicit
 *      signal "this message is connected to that one."
 *
 *   2. No quote, but user sent another message within 30 seconds → return
 *      just the previous message (handles mid-thought additions like
 *      "תקלה במכונית" then 5 seconds later "אצל יוסי").
 *
 *   3. Otherwise → return empty history. Treat the message as standalone.
 *      This is the common case: separate tasks should not bleed fields
 *      into each other (e.g. assignee from a previous task).
 *
 * Returns messages oldest-first so they slot naturally into a chat log.
 */
async function loadConversationHistory(opts: {
  admin: any;
  workspaceId: string;
  senderPhone: string;
  groupId: string | null;
  excludeMessageId: string;
  quotedMessageId: string | null;
}): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  const { admin, workspaceId, senderPhone, groupId, excludeMessageId, quotedMessageId } = opts;

  // ── Case 1: Quote chain
  // Walk backwards from the quoted message until we run out of quotes.
  // Cap at 10 hops to avoid pathological loops (shouldn't happen but be safe).
  if (quotedMessageId) {
    const chain: Array<{ text: string; direction: string }> = [];
    let nextQuoteId: string | null = quotedMessageId;
    let hops = 0;
    const MAX_HOPS = 10;
    const seen = new Set<string>();

    while (nextQuoteId && hops < MAX_HOPS && !seen.has(nextQuoteId)) {
      seen.add(nextQuoteId);

      // Find the message by green_api_message_id (works for both in & out
      // since outgoing messages are also saved with their idMessage)
      let query: any = admin
        .from('wa_messages')
        .select('id, text, direction, quoted_message_id')
        .eq('workspace_id', workspaceId)
        .eq('green_api_message_id', nextQuoteId)
        .neq('id', excludeMessageId)
        .not('text', 'is', null)
        .neq('text', '')
        .limit(1);

      // Scope to same conversation
      if (groupId) {
        query = query.eq('group_id', groupId);
      } else {
        query = query.eq('sender_phone', senderPhone).is('group_id', null);
      }

      const { data } = await query.maybeSingle();
      if (!data) break;

      chain.push({ text: data.text, direction: data.direction });
      nextQuoteId = data.quoted_message_id;
      hops++;
    }

    // Chain was collected newest→oldest; reverse so AI sees oldest first
    return chain.reverse().map((m) => ({
      role: m.direction === 'out' ? ('assistant' as const) : ('user' as const),
      content: String(m.text).slice(0, 1000),
    }));
  }

  // ── Case 2: No quote, but maybe a follow-up within 30s
  // Pull the single most recent inbound message from this conversation. If it
  // arrived less than 30 seconds ago, return it as context — likely the user
  // is mid-thought and this message extends the previous one.
  const RECENT_WINDOW_MS = 30 * 1000;

  let recentQuery: any = admin
    .from('wa_messages')
    .select('id, text, direction, received_at')
    .eq('workspace_id', workspaceId)
    .eq('direction', 'in')
    .neq('id', excludeMessageId)
    .not('text', 'is', null)
    .neq('text', '')
    .order('received_at', { ascending: false })
    .limit(1);

  if (groupId) {
    recentQuery = recentQuery.eq('group_id', groupId);
  } else {
    recentQuery = recentQuery.eq('sender_phone', senderPhone).is('group_id', null);
  }

  const { data: recent } = await recentQuery.maybeSingle();
  if (!recent) return [];

  const ageMs = Date.now() - new Date(recent.received_at).getTime();
  if (ageMs > RECENT_WINDOW_MS) return [];

  return [{
    role: 'user' as const,
    content: String(recent.text).slice(0, 1000),
  }];
}

async function incrementAiUsage(admin: any, workspaceId: string) {
  await admin.rpc('increment_ai_usage', { ws_id: workspaceId });
}

// ============================================================================
// SEND VIA GREEN API
// ============================================================================

/**
 * Send a WhatsApp message via Green API and (optionally) persist it to
 * wa_messages so it appears in conversation history.
 *
 * The persistence is opt-in via the `persist` block — that way callers
 * that don't need to record (e.g. unauthorized rejection messages) skip it,
 * and we don't double-write or write malformed rows.
 */
// ============================================================================
// ASSIGNEE RESOLUTION + NOTIFICATION
// ============================================================================

/**
 * Lightweight helper: get group display name for inclusion in notifications.
 * Returns null on any failure (the notification will just omit the group).
 */
async function getGroupName(admin: any, groupId: string): Promise<string | null> {
  try {
    const { data } = await admin
      .from('whatsapp_groups')
      .select('name')
      .eq('id', groupId)
      .maybeSingle();
    return data?.name || null;
  } catch { return null; }
}

/**
 * Normalize a phone number into Green API chat ID format (e.g. "972501234567@c.us").
 * Accepts inputs like "0501234567", "+972501234567", "972-50-123-4567".
 */
function phoneToChatId(phone: string): string | null {
  if (!phone) return null;
  // Strip everything except digits
  let digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  // Israeli mobiles often arrive as "05X..." → convert to "972 5X..."
  if (digits.startsWith('0')) digits = '972' + digits.slice(1);
  // Strip a leading "+" was already removed; also strip a leading "00"
  if (digits.startsWith('00')) digits = digits.slice(2);
  return `${digits}@c.us`;
}

/**
 * After a record is created, look up assignment rules for its table and
 * resolve to an assignee. If matched, update the record with the assignee
 * and send a private WhatsApp notification with the record details.
 *
 * Rule matching:
 *   - Pull all active rules for this table, ordered by priority ASC (lower = higher priority).
 *   - For each rule, check if the record's value at `field_id` matches `match_value`.
 *     Comparison is case-insensitive, trimmed, and works for string or array values.
 *   - A rule with `match_value = NULL` is a catch-all (applies to any value).
 *   - First matching rule wins.
 */
async function resolveAndNotifyAssignee(opts: {
  admin: any;
  workspaceId: string;
  recordId: string;
  tableId: string;
  tableName: string;
  recordData: Record<string, any>;
  instanceId: string;
  token: string;
  senderName: string;
  groupName: string | null;
}): Promise<void> {
  const { admin, workspaceId, recordId, tableId, tableName, recordData, instanceId, token, senderName, groupName } = opts;

  // Resolve who should be notified, in priority order:
  //   1. A matching assignment_rule (most specific — based on record content)
  //   2. The table's default_assignee_phone_id (set in table settings)
  //   3. Nobody → return without doing anything
  //
  // The shape we end up with:
  //   { phone, name, recordPatch }
  //   - phone:       string for sendGreenApiReply
  //   - name:        used in the notification message
  //   - recordPatch: what to write back to records (may be empty if assignee
  //                  was already set, e.g. by table-default at insert time)

  let resolved: {
    phone: string;
    name: string;
    recordPatch: Record<string, any>;
  } | null = null;

  // ── Strategy 1: assignment rules ─────────────────────────────────────────
  const { data: rules } = await admin
    .from('assignment_rules')
    .select(`
      id, field_id, match_value, priority,
      assignee_phone_id, raw_phone, raw_name,
      authorized_phones ( id, phone, display_name, job_title )
    `)
    .eq('workspace_id', workspaceId)
    .eq('table_id', tableId)
    .eq('is_active', true)
    .order('priority', { ascending: true });

  if (rules && rules.length > 0) {
    // Map rule field_ids → field slugs (recordData uses slugs)
    const fieldIds = Array.from(new Set(rules.map((r: any) => r.field_id)));
    const { data: fields } = await admin
      .from('fields')
      .select('id, slug')
      .in('id', fieldIds);
    const fieldIdToSlug = new Map<string, string>(
      (fields || []).map((f: any) => [f.id, f.slug])
    );

    for (const rule of rules) {
      const slug = fieldIdToSlug.get(rule.field_id);
      if (!slug) continue;

      const recordValue = recordData[slug];
      let isMatch = false;

      if (rule.match_value === null) {
        // Catch-all: matches whenever the field has any value
        isMatch = recordValue !== undefined && recordValue !== null && recordValue !== '';
      } else {
        const target = String(rule.match_value).trim().toLowerCase();
        if (Array.isArray(recordValue)) {
          isMatch = recordValue.some(v => String(v).trim().toLowerCase() === target);
        } else if (recordValue !== undefined && recordValue !== null) {
          isMatch = String(recordValue).trim().toLowerCase() === target;
        }
      }

      if (!isMatch) continue;

      // Pull joined assignee data (Supabase returns either array or object)
      const ap = Array.isArray(rule.authorized_phones)
        ? rule.authorized_phones[0]
        : rule.authorized_phones;
      const phone = ap?.phone || rule.raw_phone;
      if (!phone) continue;

      resolved = {
        phone,
        name: ap?.display_name || rule.raw_name || 'נציג',
        // Write the resolved assignee back to the record so the dashboard
        // shows it (rules win over table defaults — overwrite if needed)
        recordPatch: rule.assignee_phone_id
          ? { assignee_phone_id: rule.assignee_phone_id, assignee_raw_phone: null, assignee_raw_name: null }
          : { assignee_phone_id: null, assignee_raw_phone: rule.raw_phone, assignee_raw_name: rule.raw_name },
      };
      break;
    }
  }

  // ── Strategy 2: table's default assignee ─────────────────────────────────
  if (!resolved) {
    // The record was already inserted with assignee_phone_id from the table's
    // default — re-fetch it (joined with the phone) so we know who to notify.
    // We don't *change* the record here, just send a notification to the
    // already-assigned person.
    const { data: rec } = await admin
      .from('records')
      .select(`
        assignee_phone_id,
        assignee_raw_phone,
        assignee_raw_name,
        authorized_phones:assignee_phone_id ( phone, display_name )
      `)
      .eq('id', recordId)
      .maybeSingle();

    if (rec) {
      const ap = Array.isArray(rec.authorized_phones)
        ? rec.authorized_phones[0]
        : rec.authorized_phones;
      const phone = ap?.phone || rec.assignee_raw_phone;
      if (phone) {
        resolved = {
          phone,
          name: ap?.display_name || rec.assignee_raw_name || 'נציג',
          recordPatch: {}, // nothing to change — assignee was already set
        };
      }
    }
  }

  if (!resolved) return; // nothing to do

  // ── Apply patch (if any), send notification, mark notified ───────────────
  if (Object.keys(resolved.recordPatch).length > 0) {
    await admin.from('records').update(resolved.recordPatch).eq('id', recordId);
  }

  const chatId = phoneToChatId(resolved.phone);
  if (!chatId) return;

  const notificationText = buildAssigneeNotification({
    assigneeName: resolved.name,
    tableName,
    recordData,
    senderName,
    groupName,
    recordId,
  });

  const sentId = await sendGreenApiReply({
    instanceId,
    token,
    chatId,
    text: notificationText,
    persist: {
      admin, workspaceId,
      senderPhone: resolved.phone, // the OTHER party = the assignee
      groupId: null,
    },
  });

  if (sentId) {
    await admin.from('records')
      .update({ assignee_notified_at: new Date().toISOString() })
      .eq('id', recordId);
  }
}

/**
 * Build the private WhatsApp message sent to the assignee.
 * Keeps it short, scannable, and shows the most relevant fields.
 */
function buildAssigneeNotification(opts: {
  assigneeName: string;
  tableName: string;
  recordData: Record<string, any>;
  senderName: string;
  groupName: string | null;
  recordId: string;
}): string {
  const { assigneeName, tableName, recordData, senderName, groupName, recordId } = opts;

  const lines: string[] = [];
  lines.push(`היי ${assigneeName} 👋`);
  lines.push(`קיבלת ${tableName} חדשה לטיפול:`);
  lines.push('');

  // Show up to 5 most informative fields (skip empty + internal-looking keys)
  const SKIP = new Set(['id', 'created_at', 'updated_at']);
  const entries = Object.entries(recordData)
    .filter(([k, v]) => !SKIP.has(k) && v !== null && v !== undefined && v !== '')
    .slice(0, 5);

  for (const [key, value] of entries) {
    const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
    lines.push(`• ${key}: ${displayValue}`);
  }

  lines.push('');
  if (groupName) {
    lines.push(`📍 דווח על ידי ${senderName} בקבוצת "${groupName}"`);
  } else {
    lines.push(`📍 דווח על ידי ${senderName}`);
  }

  // Link to the record in the dashboard
  const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://allchatboard.vercel.app';
  lines.push('');
  lines.push(`👁 לצפייה ועדכון: ${dashboardUrl}/r/${recordId}`);

  return lines.join('\n');
}


async function sendGreenApiReply(opts: {
  instanceId: string;
  token: string;
  chatId: string;
  text: string;
  quotedMessageId?: string | null;
  persist?: {
    admin: any;
    workspaceId: string;
    senderPhone: string; // the OTHER party's phone (i.e. the user we're replying to)
    groupId?: string | null;
  };
}): Promise<string | null> {
  const { instanceId, token, chatId, text, quotedMessageId, persist } = opts;
  try {
    const url = `https://api.green-api.com/waInstance${instanceId}/sendMessage/${token}`;
    const body: any = { chatId, message: text };
    if (quotedMessageId) body.quotedMessageId = quotedMessageId;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error('Green API send failed', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const sentMessageId = data.idMessage || null;

    // Persist outgoing message so it shows in conversation history for
    // future AI calls (lets the bot understand "the previous list" etc.)
    if (persist) {
      try {
        await persist.admin.from('wa_messages').insert({
          workspace_id: persist.workspaceId,
          group_id: persist.groupId || null,
          green_api_message_id: sentMessageId,
          sender_phone: persist.senderPhone,
          text,
          direction: 'out',
          status: 'sent',
        });
      } catch (e) {
        // Non-fatal: if persistence fails the user still got the message.
        console.error('failed to persist outgoing message', e);
      }
    }

    return sentMessageId;
  } catch (e) {
    console.error('sendGreenApiReply failed', e);
    return null;
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'AllChatBoard WhatsApp Webhook v2',
    features: ['allowlist', 'reply-threading', 'auto-reply'],
  });
}
