// ── SUPABASE CONFIGURATION ───────────────────────────────────────
const SUPABASE_URL = 'https://vzewwlaqqgukjkqjyfoq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6ZXd3bGFxcWd1a2prcWp5Zm9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MDMxOTYsImV4cCI6MjA4OTQ3OTE5Nn0.shS8lfmBcfwP1rVlDv4ksjxK1Bg91MJVhP9SAuYlGDQ';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
