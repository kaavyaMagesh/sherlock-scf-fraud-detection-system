const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: '../.env' }); // Make sure we grab it from one level up just in case, or root

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_EG7XaOHL6FSZ@ep-snowy-violet-a15qdjeb-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
});

module.exports = pool;
