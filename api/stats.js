export const config = { runtime: 'edge' };

export default async function handler(request) {

  const URL_BASE    = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const [
      active, today, articles, sources,
      weekly, monthly, sectionsAll,
      completion, peakHours, returningVsNew, sectionPerf,
      authorStats, contentAge, topKeywords
    ] = await Promise.all([
      supabaseGet(URL_BASE, SERVICE_KEY, 'active_readers'),
      supabaseGet(URL_BASE, SERVICE_KEY, 'today_stats'),
      supabaseGet(URL_BASE, SERVICE_KEY, 'top_articles'),
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

    const result = {
      active_readers:       active?.[0]?.count ?? 0,
      today:                today?.[0] ?? {},
      top_articles:         articles ?? [],
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
      fetched_at:           new Date().toISOString(),
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
      'apikey':         key,
      'Authorization': `Bearer ${key}`,
      'Accept':         'application/json',
    },
  });
  if (!res.ok) throw new Error(`Supabase error on ${view}: ${await res.text()}`);
  return res.json();
}
