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

/** The logged-in ikman account, as returned by the API gateway's POST /v1/sessions and GET /v1/account. */
export interface UserAccount {
  id: string;
  profile: {
    name: string;
    type: "private" | "business";
    opt_out: boolean;
  };
  login:
    | { email: string; has_password: boolean }
    | { phone_number: string; has_password: boolean };
  /** Strings in the spec's sample, but not strings in real responses — read with care (see /api/post-job's phoneFromAccount). */
  recent_phone_numbers: unknown[];
  pick_up_code: string;
  capabilities: string[];
}

/** App login response (POST /v1/sessions) — the token is persisted in the sessionToken cookie. */
export interface AuthSession {
  account: UserAccount;
  session: { token: string };
}
