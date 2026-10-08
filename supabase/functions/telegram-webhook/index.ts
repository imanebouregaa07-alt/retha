import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Helper to escape Markdown special characters for Telegram Markdown v1
function escapeMarkdown(text: string): string {
  if (!text) return "";
  return text.replace(/([_*`\[])/g, "\\$1");
}

// Answer callback query helper
async function answerCallbackQuery(botToken: string, callbackQueryId: string, text: string, showAlert = false) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: showAlert
      })
    });
  } catch (e) {
    console.error("Failed to answer callback query:", e);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const phone = url.searchParams.get("phone") || url.searchParams.get("to") || "";
    const email = url.searchParams.get("to") || url.searchParams.get("email") || "";

    if (action === "phone" || action === "call") {
      const cleanPhone = phone ? phone.replace(/[^0-9+]/g, "") : "";
      return new Response(null, {
        status: 302,
        headers: { "Location": `tel:${cleanPhone || phone}` }
      });
    }

    if (action === "email") {
      return new Response(null, {
        status: 302,
        headers: { "Location": `mailto:${email}` }
      });
    }
    return new Response(JSON.stringify({ ok: true, service: "retha-telegram-webhook" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    let botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
    let expectedSecretToken = Deno.env.get("TELEGRAM_SECRET_TOKEN") || "";

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Fallback: Check Supabase Vault for secrets if not in Deno.env
    if (!botToken) {
      const { data: vaultToken } = await supabase.rpc("get_secret", { secret_name: "TELEGRAM_BOT_TOKEN" });
      if (vaultToken) {
        botToken = vaultToken;
      }
    }

    if (!expectedSecretToken) {
      const { data: vaultSecret } = await supabase.rpc("get_secret", { secret_name: "TELEGRAM_SECRET_TOKEN" });
      if (vaultSecret) {
        expectedSecretToken = vaultSecret;
      }
    }

    if (!botToken) {
      console.error("TELEGRAM_BOT_TOKEN is not configured.");
      return new Response(
        JSON.stringify({ error: "TELEGRAM_BOT_TOKEN is not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Verify requests genuinely come from Telegram if secret token is configured
    if (expectedSecretToken) {
      const headerSecret = req.headers.get("x-telegram-bot-api-secret-token");
      if (headerSecret !== expectedSecretToken) {
        console.warn("Unauthorized webhook request: secret token mismatch");
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    const update = await req.json().catch(() => ({}));

    // --- CASE 1: Standard Text Messages (e.g. /start or /myid) ---
    if (update.message) {
      const message = update.message;
      const chatId = String(message.chat?.id || "");
      const text = message.text || "";
      const senderName = message.from?.first_name || "عزيزي العضو";

      if (text.startsWith("/start") || text.startsWith("/myid") || text.startsWith("/chatid")) {
        const welcomeText = `مرحباً بك *${escapeMarkdown(senderName)}* في بوت إشعارات ريثا للتسويق العقاري 🏢
━━━━━━━━━━━━━━━━━━━━
معرف المحادثة الخاص بك (Chat ID):
\`${chatId}\`

يرجى تزويد مدير النظام بهذا المعرف لإضافتك في جدول المستلمين المعتمدين لتلقي الإشعارات الفورية.`;

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: welcomeText,
            parse_mode: "Markdown"
          })
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // --- CASE 2: Callback Query from Inline Keyboard Buttons ---
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const callbackData = callbackQuery.data || "";
      const callbackId = callbackQuery.id;
      const pressingChatId = String(callbackQuery.message?.chat?.id || callbackQuery.from?.id || "");

      // Check for our known prefixes: fw_ (follow up), sd_ (sold), rs_ (reserved)
      const prefix = callbackData.slice(0, 3);
      if (!["fw_", "sd_", "rs_"].includes(prefix)) {
        await answerCallbackQuery(botToken, callbackId, "إجراء غير معروف.");
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      const leadId = callbackData.slice(3);

      // 1. Verify pressing chat_id exists in telegram_recipients and is active
      const { data: recipient, error: recError } = await supabase
        .from("telegram_recipients")
        .select("id, chat_id, name, active")
        .eq("chat_id", pressingChatId)
        .eq("active", true)
        .maybeSingle();

      if (recError || !recipient) {
        console.warn(`Unauthorized button click from chat_id: ${pressingChatId}`);
        await answerCallbackQuery(
          botToken,
          callbackId,
          "⚠️ ليس لديك صلاحية لاتخاذ هذا الإجراء. يرجى التواصل مع إدارة ريثا.",
          true
        );
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      // 2. Fetch the lead and associated property directly from the leads table
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .select("*, properties(id, title, title_ar, reference_code, city, price, status)")
        .eq("id", leadId)
        .maybeSingle();

      if (leadError || !lead) {
        console.error(`Lead not found for leadId ${leadId}:`, leadError);
        await answerCallbackQuery(
          botToken,
          callbackId,
          "❌ لم يتم العثور على هذا الطلب في قاعدة البيانات.",
          true
        );
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      // 3. Perform database updates
      const handlerName = recipient.name || callbackQuery.from?.first_name || "أحد أعضاء الفريق";
      let actionTitle = "";
      let answerToast = "";

      if (prefix === "sd_") {
        actionTitle = "تم البيع";
        answerToast = "تم تسجيل البيع بنجاح وتحديث حالة العقار 🏠";

        // Update lead status to 'notified_sold'
        await supabase
          .from("leads")
          .update({ status: "notified_sold" })
          .eq("id", leadId);

        // Update property status to 'sold' (triggers property_status_history)
        if (lead.property_id) {
          await supabase
            .from("properties")
            .update({ status: "sold" })
            .eq("id", lead.property_id);
        }
      } else if (prefix === "rs_") {
        actionTitle = "تم الحجز";
        answerToast = "تم تسجيل الحجز بنجاح وتحديث حالة العقار ⏳";

        // Update lead status to 'contacted'
        await supabase
          .from("leads")
          .update({ status: "reserved" })
          .eq("id", leadId);

        // Update property status to 'reserved' (triggers property_status_history)
        if (lead.property_id) {
          await supabase
            .from("properties")
            .update({ status: "reserved" })
            .eq("id", lead.property_id);
        }
      } else {
        // fw_ -> Follow up / Contacted
        actionTitle = "تم التواصل";
        answerToast = "تم تسجيل التواصل والمتابعة بنجاح ✅";

        // Update lead status to 'contacted'
        await supabase
          .from("leads")
          .update({ status: "contacted" })
          .eq("id", leadId);
      }

      // Answer callback query with confirmation popup
      await answerCallbackQuery(botToken, callbackId, answerToast, false);

      // 4. Edit message in ALL recipients' chats to show final audit trail & handler
      // Retrieve existing message text from callback query
      let baseText = callbackQuery.message?.text || "";

      // Remove any previous outcome footer/banner if already present
      const footerDividerIndex = baseText.indexOf("====================");
      if (footerDividerIndex !== -1) {
        baseText = baseText.substring(0, footerDividerIndex).trim();
      }
      const legacyDivider = baseText.indexOf("━━━━━━━━━━━━━━━━━━━━\n📌 النتيجة:");
      if (legacyDivider !== -1) {
        baseText = baseText.substring(0, legacyDivider).trim();
      }
      const legacyBanner = baseText.search(/\n[🏠⏳✅]\s*\*?تحديث حالة الطلب:\*?/);
      if (legacyBanner !== -1) {
        const prevDiv = baseText.lastIndexOf("━━━━━━━━━━━━━━━━━━━━", legacyBanner);
        if (prevDiv !== -1 && prevDiv > 80) {
          baseText = baseText.substring(0, prevDiv).trim();
        } else {
          baseText = baseText.substring(0, legacyBanner).trim();
        }
      }

      const updatedText = `${baseText}

====================
✅ حالة الطلب: ${actionTitle}
👤 تم بواسطة: ${handlerName}`;

      // Filter out Row 2 outcome buttons (callback_data starting with fw_, sd_, rs_)
      // Preserves Row 1 contact buttons (e.g. WhatsApp, Call, Email)
      const originalKeyboard = callbackQuery.message?.reply_markup?.inline_keyboard || [];
      const updatedKeyboard = originalKeyboard
        .map((row: any[]) =>
          row.filter((btn: any) => {
            const cb = btn.callback_data || "";
            return !["fw_", "sd_", "rs_"].includes(cb.slice(0, 3));
          })
        )
        .filter((row: any[]) => row.length > 0);

      const updatedReplyMarkup = {
        inline_keyboard: updatedKeyboard
      };

      // Fetch all recorded notifications for this lead to edit in every chat
      const { data: notifications } = await supabase
        .from("telegram_lead_notifications")
        .select("chat_id, message_id")
        .eq("lead_id", leadId);

      const targetsToUpdate = new Map<string, number>();

      if (notifications && notifications.length > 0) {
        for (const notif of notifications) {
          targetsToUpdate.set(String(notif.chat_id), Number(notif.message_id));
        }
      }

      // Ensure the pressing chat's message is included
      if (callbackQuery.message?.message_id) {
        targetsToUpdate.set(pressingChatId, Number(callbackQuery.message.message_id));
      }

      // Update message in every recipient's chat
      for (const [targetChatId, targetMessageId] of targetsToUpdate.entries()) {
        try {
          const editRes = await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: targetChatId,
              message_id: targetMessageId,
              text: updatedText,
              reply_markup: updatedReplyMarkup
            })
          });
          const editData = await editRes.json();
          if (!editRes.ok || !editData.ok) {
            console.error(`Telegram API error editing message for chat ${targetChatId}:`, editData);
          }
        } catch (editErr) {
          console.error(`Failed editing message for chat ${targetChatId}:`, editErr);
        }
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ ok: true, message: "Unhandled update type" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    console.error("telegram-webhook error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
});
// update links