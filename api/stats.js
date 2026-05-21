export const config = { runtime: 'edge' };

export default async function handler(request) {
  const URL_BASE    = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const [active, today, articles, sources] = await Promise.all([
      supabaseGet(URL_BASE, SERVICE_KEY, 'active_readers'),
      supabaseGet(URL_BASE, SERVICE_KEY, 'today_stats'),
      supabaseGet(URL_BASE, SERVICE_KEY, 'top_articles'),
      supabaseGet(URL_BASE, SERVICE_KEY, 'traffic_sources'),
    ]);

    const result = {
      active_readers:  active?.[0]?.count ?? 0,
      today:           today?.[0] ?? {},
      top_articles:    articles ?? [],
      traffic_sources: sources ?? [],
      fetched_at:      new Date().toISOString(),
    };

    return new Response(JSON.stringify(result), { status: 200, headers });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch stats' }),
      { status: 500, headers }
    );
  }
}

async function supabaseGet(baseUrl, key, view) {
  const res = await fetch(`${baseUrl}/rest/v1/${view}?select=*&limit=10`, {
    headers: {
      'apikey':        key,
      'Authorization': `Bearer ${key}`,
      'Accept':        'application/json',
    },
  });
  if (!res.ok) throw new Error(`Supabase error on ${view}: ${await res.text()}`);
  return res.json();
}
