declare namespace Cloudflare {
  interface Env {
    X_BEARER_TOKEN?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
