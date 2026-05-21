// Server-side only — never import this from client components or pages
const META_VERSION = "v19.0";
const GRAPH        = `https://graph.facebook.com/${META_VERSION}`;

// ─── OAuth ────────────────────────────────────────────────────────────────────

export function buildOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id:     process.env.META_APP_ID!,
    redirect_uri:  process.env.META_REDIRECT_URI!,
    scope:         "ads_read,ads_management",
    response_type: "code",
    state,
  });
  return `https://www.facebook.com/dialog/oauth?${params}`;
}

// ─── Token exchange ───────────────────────────────────────────────────────────

export async function exchangeCodeForToken(code: string): Promise<{
  accessToken: string;
  expiresAt: Date;
  userId: string;
  userName: string;
}> {
  // Short-lived token
  const shortRes  = await fetch(
    `${GRAPH}/oauth/access_token?` + new URLSearchParams({
      client_id:     process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      redirect_uri:  process.env.META_REDIRECT_URI!,
      code,
    }),
  );
  const short = await shortRes.json() as {
    access_token?: string;
    error?: { message: string };
  };
  if (short.error) throw new Error(short.error.message);

  // Exchange for long-lived token (~60 days)
  const longRes = await fetch(
    `${GRAPH}/oauth/access_token?` + new URLSearchParams({
      grant_type:        "fb_exchange_token",
      client_id:         process.env.META_APP_ID!,
      client_secret:     process.env.META_APP_SECRET!,
      fb_exchange_token: short.access_token!,
    }),
  );
  const long = await longRes.json() as {
    access_token?: string;
    expires_in?: number;
    error?: { message: string };
  };
  if (long.error) throw new Error(long.error.message);

  // User profile
  const meRes = await fetch(
    `${GRAPH}/me?fields=id,name&access_token=${long.access_token}`,
  );
  const me = await meRes.json() as { id: string; name: string };

  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + (long.expires_in ?? 5_183_944));

  return {
    accessToken: long.access_token!,
    expiresAt,
    userId:   me.id,
    userName: me.name,
  };
}

// ─── Ad accounts ──────────────────────────────────────────────────────────────

export async function fetchAdAccounts(accessToken: string): Promise<Array<{
  id: string;
  name: string;
  currency: string;
}>> {
  const res  = await fetch(
    `${GRAPH}/me/adaccounts?fields=id,name,currency&access_token=${accessToken}`,
  );
  const data = await res.json() as {
    data?: Array<{ id: string; name: string; currency: string }>;
    error?: { message: string };
  };
  if (data.error) throw new Error(data.error.message);
  return data.data ?? [];
}

// ─── Insights ─────────────────────────────────────────────────────────────────

interface RawInsight {
  date_start:  string;
  spend:       string;
  impressions: string;
  clicks:      string;
  cpm:         string;
  ctr:         string;
  cpc:         string;
  actions?:    Array<{ action_type: string; value: string }>;
}

export async function fetchInsights(
  accessToken:  string,
  adAccountId:  string,
  dateFrom:     string,
  dateTo:       string,
): Promise<Array<{
  date:        string;
  spend:       number;
  impressions: number;
  clicks:      number;
  leads:       number;
  conversions: number;
  cpm:         number;
  ctr:         number;
  cpc:         number;
}>> {
  const params = new URLSearchParams({
    time_range:     JSON.stringify({ since: dateFrom, until: dateTo }),
    fields:         "spend,impressions,clicks,cpm,ctr,cpc,actions",
    time_increment: "1",
    level:          "account",
    access_token:   accessToken,
  });

  const res  = await fetch(`${GRAPH}/${adAccountId}/insights?${params}`);
  const data = await res.json() as {
    data?:  RawInsight[];
    error?: { message: string };
  };
  if (data.error) throw new Error(data.error.message);

  return (data.data ?? []).map(d => {
    const actions = d.actions ?? [];
    return {
      date:        d.date_start,
      spend:       parseFloat(d.spend       ?? "0"),
      impressions: parseInt(d.impressions   ?? "0", 10),
      clicks:      parseInt(d.clicks        ?? "0", 10),
      leads:       parseInt(actions.find(a => a.action_type === "lead")?.value      ?? "0", 10),
      conversions: parseInt(actions.find(a => a.action_type === "purchase")?.value ?? "0", 10),
      cpm:         parseFloat(d.cpm ?? "0"),
      ctr:         parseFloat(d.ctr ?? "0"),
      cpc:         parseFloat(d.cpc ?? "0"),
    };
  });
}
