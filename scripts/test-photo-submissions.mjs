process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY ||= "test-only-placeholder";
await import("../tests/photo-submissions.test.mjs");
