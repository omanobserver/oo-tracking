export const config = { runtime: 'edge' };

let cache = { heavy: null, heavyAt: 0, TTL: 5 * 60 * 1000 };

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

    // Real-time فقط: view-ين خفيفتين
    const [active, today] = await Promise.all([
      supabaseGet(URL_BASE, SERVICE_KEY, 'active_readers'),
      supabaseGet(URL_BASE, SERVICE_KEY, 'today_stats'),
    ]);

    // Heavy: كل 5 دقائق فقط — view-ين إضافيتين
    if (!cache.heavy || now - cache.heavyAt > cache.TTL) {
      const [articles, sources] = await Promise.all([
        supabaseGet(URL_BASE, SERVICE_KEY, 'top_articles'),
        supabaseGet(URL_BASE, SERVICE_KEY, 'traffic_sources'),
      ]);
      cache.heavy = { top_articles: articles ?? [], traffic_sources: sources ?? [] };
      cache.heavyAt = now;
    }

    const result = {
      active_readers:  active?.[0]?.count ?? 0,
      today:           today?.[0] ?? {},
      top_articles:    cache.heavy?.top_articles ?? [],
      traffic_sources: cache.heavy?.traffic_sources ?? [],
      weekly_stats:    [],
      monthly_stats:   [],
      sections_alltime: [],
      completion_rate: [],
      peak_hours:      [],
      returning_vs_new: [],
      sections_performance: [],
      author_stats:    [],
      content_age:     [],
      top_keywords:    [],
      fetched_at:      new Date().toISOString(),
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
