use pbkdf2::pbkdf2_hmac;
use sha2::Sha256;

const ITERATIONS: u32 = 100_000;
const KEY_LEN: usize = 32;
const SERVICE_NAME: &str = "com.zhuhuifeng.curation";
const KEYCHAIN_USER: &str = "cache-db-key";

pub fn derive_key(token: &str, user_id: &str) -> String {
    let mut key = [0u8; KEY_LEN];
    pbkdf2_hmac::<Sha256>(token.as_bytes(), user_id.as_bytes(), ITERATIONS, &mut key);
    hex::encode(key)
}

pub fn store_key(hex_key: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE_NAME, KEYCHAIN_USER).map_err(|e| e.to_string())?;
    entry.set_password(hex_key).map_err(|e| e.to_string())
}

pub fn load_key() -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(SERVICE_NAME, KEYCHAIN_USER).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(pw) => Ok(Some(pw)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub fn delete_key() -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE_NAME, KEYCHAIN_USER).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
