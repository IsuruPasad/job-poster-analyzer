/** Ikman.lk login used to post the ad — common to every location tab, never per-ad data. */
export interface IkmanCredentials {
  email: string;
  password: string;
}

/** Result of authenticating against ikman.lk's POST /data/sessions — the bearer token used for POST /data/post_listings. */
export interface IkmanSession {
  token: string;
  accountId?: string;
}
