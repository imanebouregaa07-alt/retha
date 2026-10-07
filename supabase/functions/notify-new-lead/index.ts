import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Helper to escape Markdown special characters for Telegram Markdown v1
function escapeMarkdown(text: string): string {
  if (!text) return "";
  return text.replace(/([_*`\[])/g, "\\$1");
}

// Format Saudi/International phone numbers for wa.me URL
function formatPhoneForWhatsApp(phone: string): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("05")) {
    digits = "966" + digits.slice(1);
  }
  return digits;
}

Deno.serve(async (req: Request) => {
  // Only accept POST requests
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

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Fallback: If not in Deno.env, fetch securely from Supabase Vault
    if (!botToken) {
      const { data: vaultToken } = await supabase.rpc("get_secret", { secret_name: "TELEGRAM_BOT_TOKEN" });
      if (vaultToken) {
        botToken = vaultToken;
      }
    }

    if (!botToken) {
      console.error("TELEGRAM_BOT_TOKEN secret is not set in Edge Function environment or Vault.");
      return new Response(
        JSON.stringify({ error: "TELEGRAM_BOT_TOKEN is not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse payload (Supports Database Webhooks, pg_net, or direct invoke)
    const payload = await req.json().catch(() => ({}));
    let lead = payload.record || payload.lead || payload;

    // If lead_id was provided instead of full record, query DB
    if (!lead?.full_name && (payload.lead_id || payload.id)) {
      const targetId = payload.lead_id || payload.id;
      const { data: dbLead, error: dbErr } = await supabase
        .from("leads")
        .select("*, properties(*)")
        .eq("id", targetId)
        .single();

      if (dbErr || !dbLead) {
        throw new Error(`Lead ${targetId} not found in database: ${dbErr?.message}`);
      }
      lead = dbLead;
    }

    if (!lead || !lead.id) {
      return new Response(JSON.stringify({ error: "Invalid lead payload: missing lead id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Fetch related property details if not already present
    let property = lead.properties;
    if (!property && lead.property_id) {
      const { data: propData } = await supabase
        .from("properties")
        .select("id, title, title_ar, reference_code, city, price")
        .eq("id", lead.property_id)
        .maybeSingle();
      property = propData;
    }

    // Fetch all active Telegram recipients
    const { data: recipients, error: recError } = await supabase
      .from("telegram_recipients")
      .select("id, chat_id, name, active")
      .eq("active", true);

    if (recError) {
      console.error("Error fetching telegram_recipients:", recError);
      throw recError;
    }

    if (!recipients || recipients.length === 0) {
      console.warn("No active telegram_recipients configured in database.");
      return new Response(
        JSON.stringify({
          ok: true,
          message: "Lead processed, but no active telegram_recipients found."
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Format Property Information
    let propTitle = "طلب استشارة عامة";
    if (property?.title_ar && property.title_ar.trim().length > 3) {
      propTitle = property.title_ar.trim();
    } else if (property?.title && property.title.trim().length > 0) {
      propTitle = property.title.trim();
    } else if (lead.property_name && lead.property_name.trim().length > 0) {
      propTitle = lead.property_name.trim();
    }

    const propRef = property?.reference_code || "عام";
    const propCity = (property?.city && property.city.toLowerCase() === "riyadh")
      ? "الرياض"
      : (property?.city || "الرياض");
    // Determine if property has an active listed price
    const rawPrice = property?.price;
    const priceNum = (rawPrice !== null && rawPrice !== undefined && String(rawPrice).trim() !== "")
      ? Number(rawPrice)
      : NaN;
    const hasPrice = !isNaN(priceNum) && priceNum > 0;

    const propPrice = hasPrice
      ? `${priceNum.toLocaleString("en-US")} ر.س`
      : "غير معروض";

    // Format preferred contact method label
    const methodMap: Record<string, string> = {
      whatsapp: "واتساب (WhatsApp)",
      phone: "اتصال هاتفي (Phone Call)",
      email: "بريد إلكتروني (Email)"
    };
    const methodKey = (lead.preferred_contact_method || "whatsapp").toLowerCase();
    const contactMethodLabel = methodMap[methodKey] || methodKey;

    const formattedDate = new Date(lead.created_at || Date.now()).toLocaleString("ar-SA", {
      timeZone: "Asia/Riyadh",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    // Build client information lines
    const clientLines: string[] = [
      `👤 *العميل:* ${escapeMarkdown(lead.full_name || "غير محدد")}`,
      `📞 *الجوال:* \`${lead.phone || "-"}\``,
      `📧 *البريد:* ${lead.email ? escapeMarkdown(lead.email) : "غير متوفر"}`,
      `💬 *طريقة التواصل المفضلة:* ${contactMethodLabel}`
    ];

    // Dynamic budget range handling:
    // - Priced properties: continue to display their allocated budget range (or "غير محدد" as fallback)
    // - Unpriced properties (budget field hidden on frontend): completely OMIT the budget line; do not output "غير محدد"
    if (hasPrice) {
      clientLines.push(`💰 *نطاق الميزانية:* ${escapeMarkdown(lead.budget_range || "غير محدد")}`);
    } else if (lead.budget_range && lead.budget_range.trim().length > 0) {
      clientLines.push(`💰 *نطاق الميزانية:* ${escapeMarkdown(lead.budget_range.trim())}`);
    }

    // Build property information lines
    const propertyLines: string[] = [
      `🏠 *العقار المطلوب:* ${escapeMarkdown(propTitle)}`,
      `📍 *الموقع/المدينة:* ${escapeMarkdown(propCity)}`,
      `🔢 *الرمز المرجعي:* \`${escapeMarkdown(propRef)}\``
    ];

    // Check if this request is a VIP Advisory or General Consultation (not tied to a specific property)
    const isGeneralAdvisory =
      !property ||
      !lead.property_id ||
      propTitle === "طلب استشارة عامة" ||
      propTitle.includes("استشارة عامة") ||
      propTitle.toLowerCase().includes("general vip") ||
      propTitle.includes("VIP Private Acquisition Advisory");

    // Only include the price line if it is tied to an actual property:
    // - Priced property: outputs formatted SAR price
    // - Unpriced property: outputs "السعر: غير معروض"
    // - VIP Advisory / General Consultation: completely OMIT the price line
    if (!isGeneralAdvisory) {
      propertyLines.push(`💵 *السعر:* ${propPrice}`);
    }

    // Build Luxury Arabic Notification Message
    const messageText = `🔔 *طلب استفسار جديد — ريثا العقارية*
━━━━━━━━━━━━━━━━━━━━
${clientLines.join("\n")}

${propertyLines.join("\n")}

📝 *ملاحظات العميل:*
${escapeMarkdown(lead.message || "لا توجد ملاحظات إضافية")}
━━━━━━━━━━━━━━━━━━━━
⏱ *الوقت:* ${formattedDate}`;

    // ROW 1: Dynamic Contact Button based on preferred_contact_method
    const row1Buttons: Array<{ text: string; url: string }> = [];
    const cleanPhone = formatPhoneForWhatsApp(lead.phone || "");
    const formattedPhoneParam = cleanPhone ? `+${cleanPhone}` : (lead.phone || "");
    const callUrl = `tel:${formattedPhoneParam}`;
    const emailUrl = `mailto:${lead.email || ""}`;

    if (methodKey === "whatsapp" && cleanPhone) {
      row1Buttons.push({
        text: "💬 واتساب",
        url: `https://wa.me/${cleanPhone}`
      });
    } else if (methodKey === "phone" && (lead.phone || cleanPhone)) {
      row1Buttons.push({
        text: "📞 اتصال",
        url: callUrl
      });
    } else if (methodKey === "email" && lead.email) {
      row1Buttons.push({
        text: "📧 إيميل",
        url: emailUrl
      });
    } else {
      // Fallback: If phone exists, provide WhatsApp link
      if (cleanPhone) {
        row1Buttons.push({
          text: "💬 واتساب",
          url: `https://wa.me/${cleanPhone}`
        });
      } else if (lead.phone) {
        row1Buttons.push({
          text: "📞 اتصال",
          url: callUrl
        });
      } else if (lead.email) {
        row1Buttons.push({
          text: "📧 إيميل",
          url: emailUrl
        });
      }
    }

    // ROW 2: Outcome Buttons (Keep callback_data <= 64 bytes!)
    // UUID is 36 chars. "fw_", "sd_", "rs_" are 3 chars -> 39 bytes total.
    const row2Buttons = [
      { text: "✅ تم التواصل - متابعة", callback_data: `fw_${lead.id}` },
      { text: "🏠 تم البيع", callback_data: `sd_${lead.id}` },
      { text: "⏳ تم الحجز", callback_data: `rs_${lead.id}` }
    ];

    const inlineKeyboard = {
      inline_keyboard: [
        row1Buttons,
        row2Buttons
      ]
    };

    const sendResults: Array<{ chat_id: string; success: boolean; message_id?: number; error?: string }> = [];

    // Send notification to each active recipient
    for (const recipient of recipients) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: recipient.chat_id,
            text: messageText,
            parse_mode: "Markdown",
            reply_markup: inlineKeyboard
          })
        });

        const resData = await response.json();

        if (response.ok && resData.ok) {
          const messageId = resData.result.message_id;
          sendResults.push({
            chat_id: recipient.chat_id,
            success: true,
            message_id: messageId
          });

          // Store sent message ID in database for multi-recipient updates
          await supabase
            .from("telegram_lead_notifications")
            .upsert(
              {
                lead_id: lead.id,
                chat_id: String(recipient.chat_id),
                message_id: messageId
              },
              { onConflict: "lead_id,chat_id" }
            )
            .then(({ error: insertErr }) => {
              if (insertErr) {
                console.warn("Failed to record telegram notification in DB:", insertErr);
              }
            });
        } else {
          console.error(`Telegram API error for chat ${recipient.chat_id}:`, resData);
          sendResults.push({
            chat_id: recipient.chat_id,
            success: false,
            error: resData.description || "Telegram API failure"
          });
        }
      } catch (sendErr: any) {
        console.error(`Exception sending to chat ${recipient.chat_id}:`, sendErr);
        sendResults.push({
          chat_id: recipient.chat_id,
          success: false,
          error: sendErr?.message || "Network error"
        });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        lead_id: lead.id,
        recipients_count: recipients.length,
        results: sendResults
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("notify-new-lead error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
