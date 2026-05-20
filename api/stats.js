export const config = { runtime: 'edge' };

// ── Cache بسيط في memory ────────────────────────────────────
let cache = {
  heavy: null,        // البيانات الثقيلة (stats, charts, etc.)
  heavyAt: 0,         // وقت آخر تحديث
  TTL: 5 * 60 * 1000 // 5 دقائق
};

export default async function handler(request) {
  const URL_BASE    = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const now = Date.now();

    // ── 1. Real-time: دائماً من Supabase (فقط view-ين) ──────
    const [active, articles] = await Promise.all([
      supabaseGet(URL_BASE, SERVICE_KEY, 'active_readers'),
      supabaseGet(URL_BASE, SERVICE_KEY, 'top_articles'),
    ]);

    // ── 2. Heavy: من cache إذا لم تنتهِ المدة ───────────────
    if (!cache.heavy || now - cache.heavyAt > cache.TTL) {
      const [
        today, sources, weekly, monthly, sectionsAll,
        completion, peakHours, returningVsNew, sectionPerf,
        authorStats, contentAge, topKeywords
      ] = await Promise.all([
        supabaseGet(URL_BASE, SERVICE_KEY, 'today_stats'),
        supabaseGet(URL_BASE, SERVICE_KEY, 'traffic_sources'),
        supabaseGet(URL_BASE, SERVICE_KEY, 'weekly_stats'),
        supabaseGet(URL_BASE, SERVICE_KEY, 'monthly_stats'),
        supabaseGet(URL_BASE, SERVICE_KEY, 'sections_alltime'),
        supabaseGet(URL_BASE, SERVICE_KEY, 'completion_rate'),
        supabaseGet(URL_BASE, SERVICE_KEY, 'peak_hours'),
        supabaseGet(URL_BASE, SERVICE_KEY, 'returning_vs_new'),
        supabaseGet(URL_BASE, SERVICE_KEY, 'sections_performance'),
        supabaseGet(URL_BASE, SERVICE_KEY, 'author_stats'),
        supabaseGet(URL_BASE, SERVICE_KEY, 'content_age_performance'),
        supabaseGet(URL_BASE, SERVICE_KEY, 'top_keywords'),
      ]);

      cache.heavy = {
        today:                today?.[0] ?? {},
        traffic_sources:      sources ?? [],
        weekly_stats:         weekly ?? [],
        monthly_stats:        monthly ?? [],
        sections_alltime:     sectionsAll ?? [],
        completion_rate:      completion ?? [],
        peak_hours:           peakHours ?? [],
        returning_vs_new:     returningVsNew ?? [],
        sections_performance: sectionPerf ?? [],
        author_stats:         authorStats ?? [],
        content_age:          contentAge ?? [],
        top_keywords:         topKeywords ?? [],
      };
      cache.heavyAt = now;
    }

    // ── 3. دمج النتائج ───────────────────────────────────────
    const result = {
      active_readers: active?.[0]?.count ?? 0,
      top_articles:   articles ?? [],
      ...cache.heavy,
      fetched_at:     new Date().toISOString(),
      cache_age:      Math.round((now - cache.heavyAt) / 1000) + 's',
    };

    return new Response(JSON.stringify(result), { status: 200, headers });

  } catch (error) {
    console.error('Stats error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch stats' }),
      { status: 500, headers }
    );
  }
}

async function supabaseGet(baseUrl, key, view) {
  const res = await fetch(`${baseUrl}/rest/v1/${view}?select=*`, {
    headers: {
      'apikey':        key,
      'Authorization': `Bearer ${key}`,
      'Accept':        'application/json',
    },
  });
  if (!res.ok) throw new Error(`Supabase error on ${view}: ${await res.text()}`);
  return res.json();
}
