// ============================================================
// api/collect.js — Vercel Edge Function
// المسار في مشروع Observer AI Studio: /api/collect.js
//
// متغيرات البيئة المطلوبة في Vercel Dashboard:
//   SUPABASE_URL        = https://xxxx.supabase.co
//   SUPABASE_ANON_KEY   = eyJh...  (من Settings > API في Supabase)
//   ALLOWED_ORIGIN      = https://omanobserver.om
// ============================================================

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {

  const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://omanobserver.om';
  const SUPABASE_URL   = process.env.SUPABASE_URL;
  const SUPABASE_KEY   = process.env.SUPABASE_ANON_KEY;

  // رؤوس CORS — ضرورية لأن الطلب يأتي من نطاق مختلف
  const corsHeaders = {
    'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age':       '86400',
  };

  // معالجة طلبات OPTIONS (pre-flight)
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // قبول POST فقط
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    // ── 1. قراءة وتحقق من البيانات ──────────────────────────
    const raw = await request.text();
    if (!raw || raw.length > 8000) {
      return new Response('Invalid payload size', { status: 400, headers: corsHeaders });
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
    }

    // التحقق من الحقول الإلزامية
    if (!data.sessionId || !data.path) {
      return new Response('Missing required fields', { status: 400, headers: corsHeaders });
    }

    // ── 2. تنظيف وتحضير البيانات ────────────────────────────
    const record = {
      session_id:   String(data.sessionId).slice(0, 64),
      visitor_id:   String(data.visitorId || 'unknown').slice(0, 64),
      url:          String(data.url || '').slice(0, 500),
      path:         String(data.path || '').slice(0, 300),
      title:        data.title ? String(data.title).slice(0, 200) : null,
      article_id:   data.articleId ? String(data.articleId).slice(0, 100) : null,
      section:      String(data.section || 'unknown').slice(0, 50),
      referrer:     String(data.referrer || '').slice(0, 300),
      engaged_time: Math.min(Math.max(parseInt(data.engagedTime) || 0, 0), 3600),
      scroll_depth: Math.min(Math.max(parseInt(data.scrollDepth) || 0, 0), 100),
      is_final:     Boolean(data.isFinal),
      // بيانات جغرافية من Vercel تلقائياً
      geo_country:  request.geo?.country || 'OM',
      geo_city:     request.geo?.city    || 'Unknown',
      connection:   String(data.connectionType || 'unknown').slice(0, 20),
      vp_width:     parseInt(data.viewport?.w) || null,
    };

    // ── 3. حفظ في Supabase ──────────────────────────────────
    const response = await fetch(`${SUPABASE_URL}/rest/v1/page_events`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':         SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer':         'return=minimal', // أسرع — لا تُرجع البيانات المُدرجة
      },
      body: JSON.stringify(record),
    });

    if (!response.ok) {
      // سجّل الخطأ داخلياً لكن أرسل 200 للمتصفح
      // (لا نريد أن يُعيد الـ Beacon محاولة الإرسال)
      console.error('Supabase insert error:', await response.text());
    }

    // ── 4. رد ناجح دائماً للمتصفح ───────────────────────────
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Edge function error:', error);
    // حتى عند الخطأ — أرسل 200 لتجنب إعادة المحاولة
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
