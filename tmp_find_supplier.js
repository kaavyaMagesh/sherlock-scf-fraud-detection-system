const pool = require('./db/index');
const identityService = require('./services/identityService');

async function check() {
    const res = await pool.query("SELECT id, verifiable_credential, credential_verified, is_revoked FROM companies");
    for (let r of res.rows) {
        let vcData = r.verifiable_credential;
        if (typeof vcData === 'string') {
            try { vcData = JSON.parse(vcData); } catch (e) { vcData = null; }
        }
        const isVCValid = identityService.verifyVC(vcData);
        if (r.credential_verified && !r.is_revoked && isVCValid) {
            console.log("Valid Supplier ID:", r.id);
        }
    }
    process.exit(0);
}
check();
