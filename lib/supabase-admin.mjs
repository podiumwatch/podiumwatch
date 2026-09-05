import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error("Supabase environment variables are missing.");
}

export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseSecretKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

// A plain .in(column, ids) with enough ids builds a request URL that blows
// past Node/undici's ~16KB header size limit -- confirmed live in
// production (2026-09-04): once the Recruit Ratings tables held 500
// distinct profile ids (250 boys + 250 girls, Cross Country Top 250),
// every .in() query built directly against that full id list started
// throwing "HeadersOverflowError: Headers Overflow Error" on every
// request -- not a display bug, a real 500 error on the entire
// /api/recruiting/ endpoint. 150 ids keeps even a wide select() (a dozen
// or so columns) comfortably under half that limit with real margin. Any
// query filtering by an id list whose size scales with real data (not a
// small, bounded set like [oneId]) should go through this instead of a
// bare .in().
const ID_CHUNK_SIZE = 150;

export async function fetchInChunks(table, selectClause, column, ids, configure) {
  if (!ids.length) return [];

  const chunks = [];
  for (let index = 0; index < ids.length; index += ID_CHUNK_SIZE) {
    chunks.push(ids.slice(index, index + ID_CHUNK_SIZE));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      let query = supabaseAdmin.from(table).select(selectClause).in(column, chunk);
      if (configure) query = configure(query, chunk);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    })
  );

  return results.flat();
}