/**
 * Cliente Supabase para o StockCell
 * Substitui o better-sqlite3 na migração para nuvem
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ SUPABASE_URL e SUPABASE_KEY devem estar definidos no .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('✅ Cliente Supabase inicializado:', supabaseUrl);

module.exports = supabase;
