export interface DashboardOverview {
  days: number;
  labels: string[];
  kpis: {
    users: { total: number; period: number; delta: number | null };
    shops: { total: number; active: number };
    calculations: { total: number; period: number; delta: number | null };
    requests: { total: number; period: number; delta: number | null };
    quotes: { total: number; period: number; delta: number | null };
    installations: { total: number; period: number; delta: number | null };
    reviews: { total: number; avg: number | null };
    tickets: { open: number; period: number };
  };
  series: Record<'users' | 'calculations' | 'requests' | 'quotes' | 'installations' | 'reviews' | 'tickets', number[]>;
  distributions: {
    roles: Record<string, number>;
    shopStatus: Record<string, number>;
    requestStatus: Record<string, number>;
    installStatus: Record<string, number>;
    quoteStatus: Record<string, number>;
    calcType: Record<string, number>;
    requestRegion: Array<{ region: string; count: number }>;
    ratingDist: Array<{ rating: number; count: number }>;
  };
  quotePoints: Array<{ kw: number; total: number; status: string }>;
}
