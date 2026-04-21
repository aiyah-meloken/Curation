use pbkdf2::pbkdf2_hmac;
use sha2::Sha256;

const ITERATIONS: u32 = 100_000;
const KEY_LEN: usize = 32;

pub fn derive_key(token: &str, user_id: &str) -> String {
    let mut key = [0u8; KEY_LEN];
    pbkdf2_hmac::<Sha256>(token.as_bytes(), user_id.as_bytes(), ITERATIONS, &mut key);
    hex::encode(key)
}
