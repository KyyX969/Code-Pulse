import { Octokit } from '@octokit/rest';
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { Router } from 'express';
import {
  config,
  isGitHubOAuthConfigured,
  isSupabaseConfigured,
  isVercelOAuthConfigured,
} from '../config.ts';
import { getStore, isSupabaseStoreActive } from '../db/index.ts';
import { toPublicUser } from '../db/types.ts';
import { parseCookies, requireAuth, SESSION_COOKIE_NAME } from '../middleware/auth.ts';
import {
  encryptToken,
  hashPassword,
  signSessionToken,
  verifyPassword,
} from '../utils/crypto.ts';

function createEphemeralSupabaseClient(useServiceKey = false) {
  const key = useServiceKey
    ? config.supabase.serviceRoleKey
    : config.supabase.anonKey || config.supabase.serviceRoleKey;
  return createClient(config.supabase.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const authRouter = Router();

const IS_SECURE_COOKIE =
  config.appUrl.startsWith('https://') || Boolean(process.env.VERCEL);

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: IS_SECURE_COOKIE,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

authRouter.get('/me', async (req, res) => {
  const store = await getStore();
  const allUsers = (await store.listUsers()).map(toPublicUser);
  res.json({
    user: req.currentUser ? toPublicUser(req.currentUser) : null,
    users: allUsers,
    capabilities: {
      mode: isSupabaseConfigured() ? 'supabase' : 'local',
      githubOAuthConfigured: isGitHubOAuthConfigured(),
      vercelOAuthConfigured: isVercelOAuthConfigured(),
      webhookSecretConfigured: Boolean(config.github.webhookSecret),
      iceServers: config.iceServers,
    },
  });
});

authRouter.post('/register', async (req, res) => {
  const { email, password, username, displayName, role } = req.body as {
    email?: string;
    password?: string;
    username?: string;
    displayName?: string;
    role?: 'leader' | 'member';
  };

  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanUsername = (username || '').trim().replace(/^@/, '');
  const cleanName = (displayName || '').trim() || cleanUsername;
  const safeRole = role === 'leader' ? 'leader' : 'member';

  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  if (!password || password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' });
    return;
  }
  if (!cleanUsername || !/^[a-zA-Z0-9_-]{2,32}$/.test(cleanUsername)) {
    res.status(400).json({
      error: 'Username must be 2–32 characters (letters, numbers, - or _).',
    });
    return;
  }

  const store = await getStore();
  if (await store.getUserByEmail(cleanEmail)) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }
  if (await store.getUserByUsername(cleanUsername)) {
    res.status(409).json({ error: 'This username is already taken.' });
    return;
  }

  let authUserId: string | undefined;
  if (isSupabaseStoreActive()) {
    const supabaseAdmin = createEphemeralSupabaseClient(true);
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: {
        username: cleanUsername,
        display_name: cleanName,
        role: safeRole,
      },
    });
    if (error || !data.user) {
      res.status(400).json({ error: error?.message || 'Unable to register account.' });
      return;
    }
    authUserId = data.user.id;
  }

  const user = await store.upsertUser({
    id: authUserId,
    email: cleanEmail,
    username: cleanUsername,
    displayName: cleanName,
    role: safeRole,
    passwordHash: isSupabaseStoreActive() ? null : hashPassword(password),
  });

  const sessionToken = signSessionToken(user.id);
  res.cookie(SESSION_COOKIE_NAME, sessionToken, COOKIE_OPTIONS);
  res.status(201).json({ user: toPublicUser(user) });
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  const cleanEmail = (email || '').trim().toLowerCase();

  if (!cleanEmail || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const store = await getStore();

  if (isSupabaseStoreActive()) {
    const supabaseClient = createEphemeralSupabaseClient(false);
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error || !data.user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    let user =
      (await store.getUserById(data.user.id)) ||
      (await store.getUserByEmail(cleanEmail));

    if (!user) {
      const meta = (data.user.user_metadata || {}) as Record<string, unknown>;
      const fallbackUsername =
        typeof meta.username === 'string' && meta.username
          ? meta.username
          : cleanEmail.split('@')[0];
      user = await store.upsertUser({
        id: data.user.id,
        email: cleanEmail,
        username: fallbackUsername,
        displayName:
          typeof meta.display_name === 'string' && meta.display_name
            ? meta.display_name
            : fallbackUsername,
        role: meta.role === 'leader' ? 'leader' : 'member',
      });
    }

    const sessionToken = signSessionToken(user.id);
    res.cookie(SESSION_COOKIE_NAME, sessionToken, COOKIE_OPTIONS);
    res.json({ user: toPublicUser(user) });
    return;
  }

  const user = await store.getUserByEmail(cleanEmail);
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const sessionToken = signSessionToken(user.id);
  res.cookie(SESSION_COOKIE_NAME, sessionToken, COOKIE_OPTIONS);
  res.json({ user: toPublicUser(user) });
});

type GitHubOAuthIntent = 'login' | 'register' | 'connect' | 'auto';

function clearGitHubOAuthCookies(res: import('express').Response) {
  res.clearCookie('cp_oauth_state', { path: '/' });
  res.clearCookie('cp_oauth_intent', { path: '/' });
  res.clearCookie('cp_oauth_return', { path: '/' });
}

authRouter.get('/github', (req, res) => {
  if (!isGitHubOAuthConfigured()) {
    res.redirect(`${config.appUrl}/?auth_error=github_oauth_not_configured`);
    return;
  }

  const rawIntent = String(req.query.intent || '').trim().toLowerCase();
  const intent: GitHubOAuthIntent =
    rawIntent === 'login' || rawIntent === 'register' || rawIntent === 'connect'
      ? rawIntent
      : req.currentUser
        ? 'connect'
        : 'auto';

  const returnTo = String(req.query.return_to || '').trim().toLowerCase();
  const state = crypto.randomBytes(16).toString('hex');
  const oauthCookieOpts = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: IS_SECURE_COOKIE,
    maxAge: 10 * 60 * 1000,
    path: '/',
  };

  res.cookie('cp_oauth_state', state, oauthCookieOpts);
  res.cookie('cp_oauth_intent', intent, oauthCookieOpts);
  if (returnTo === 'onboarding') {
    res.cookie('cp_oauth_return', 'onboarding', oauthCookieOpts);
  } else {
    res.clearCookie('cp_oauth_return', { path: '/' });
  }

  const params = new URLSearchParams({
    client_id: config.github.clientId,
    redirect_uri: config.github.callbackUrl,
    scope: 'repo admin:repo_hook read:user user:email',
    state,
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

authRouter.get('/github/callback', async (req, res) => {
  const code = String(req.query.code || '');
  const state = String(req.query.state || '');
  const cookies = parseCookies(req.headers.cookie);
  const rawIntent = (cookies.cp_oauth_intent || '').trim().toLowerCase();
  const intent: GitHubOAuthIntent =
    rawIntent === 'login' || rawIntent === 'register' || rawIntent === 'connect'
      ? rawIntent
      : req.currentUser
        ? 'connect'
        : 'auto';
  const returnTo = (cookies.cp_oauth_return || '').trim().toLowerCase();

  if (!code || !state || cookies.cp_oauth_state !== state) {
    clearGitHubOAuthCookies(res);
    res.redirect(`${config.appUrl}/?auth_error=invalid_oauth_state`);
    return;
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: config.github.clientId,
        client_secret: config.github.clientSecret,
        code,
        redirect_uri: config.github.callbackUrl,
      }),
    });

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      error_description?: string;
    };

    if (!tokenData.access_token) {
      clearGitHubOAuthCookies(res);
      res.redirect(`${config.appUrl}/?auth_error=github_token_exchange_failed`);
      return;
    }

    const octokit = new Octokit({ auth: tokenData.access_token });
    const { data: ghUser } = await octokit.rest.users.getAuthenticated();

    let resolvedEmail = ghUser.email;
    if (!resolvedEmail) {
      try {
        const { data: emails } = await octokit.rest.users.listEmailsForAuthenticatedUser();
        const primary = emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified);
        resolvedEmail = primary?.email ?? null;
      } catch {
        resolvedEmail = null;
      }
    }

    const store = await getStore();
    const existing =
      (await store.getUserByGithubId(String(ghUser.id))) ||
      (resolvedEmail ? await store.getUserByEmail(resolvedEmail) : null) ||
      (await store.getUserByUsername(ghUser.login));

    const encryptedGithubToken = encryptToken(tokenData.access_token);

    // 1. Authenticated account linking (Vault / Settings / Onboarding Step 1)
    if (intent === 'connect' && req.currentUser) {
      if (existing && existing.id !== req.currentUser.id) {
        clearGitHubOAuthCookies(res);
        const onboardingSuffix = returnTo === 'onboarding' ? '&onboarding=1' : '';
        res.redirect(
          `${config.appUrl}/?github_connect_error=already_linked&gh_user=${encodeURIComponent(ghUser.login)}${onboardingSuffix}`,
        );
        return;
      }

      const linkedUser = await store.upsertUser({
        id: req.currentUser.id,
        githubId: String(ghUser.id),
        username: req.currentUser.username,
        displayName: req.currentUser.displayName || ghUser.name || ghUser.login,
        avatarUrl: ghUser.avatar_url || req.currentUser.avatarUrl,
        email: req.currentUser.email || resolvedEmail,
        role: req.currentUser.role,
        githubTokenEncrypted: encryptedGithubToken,
      });

      const sessionToken = signSessionToken(linkedUser.id);
      clearGitHubOAuthCookies(res);
      res.cookie(SESSION_COOKIE_NAME, sessionToken, COOKIE_OPTIONS);
      res.redirect(
        `${config.appUrl}/?github=connected${returnTo === 'onboarding' ? '&onboarding=1' : ''}`,
      );
      return;
    }

    // 2. Strict Sign In with GitHub — requires an existing CodePulse account
    if (intent === 'login') {
      if (!existing) {
        clearGitHubOAuthCookies(res);
        res.redirect(
          `${config.appUrl}/?auth_mode=register&auth_error=github_account_not_found&gh_user=${encodeURIComponent(ghUser.login)}`,
        );
        return;
      }

      const signedInUser = await store.upsertUser({
        id: existing.id,
        githubId: String(ghUser.id),
        username: existing.username || ghUser.login,
        displayName: ghUser.name || existing.displayName || ghUser.login,
        avatarUrl: ghUser.avatar_url || existing.avatarUrl,
        email: existing.email || resolvedEmail,
        role: existing.role,
        githubTokenEncrypted: encryptedGithubToken,
      });

      const sessionToken = signSessionToken(signedInUser.id);
      clearGitHubOAuthCookies(res);
      res.cookie(SESSION_COOKIE_NAME, sessionToken, COOKIE_OPTIONS);
      res.redirect(`${config.appUrl}/?github=signed_in`);
      return;
    }

    // 3. Strict Sign Up with GitHub — only creates brand-new accounts + launches onboarding
    if (intent === 'register') {
      if (existing) {
        clearGitHubOAuthCookies(res);
        res.redirect(
          `${config.appUrl}/?auth_mode=login&auth_error=github_account_exists&gh_user=${encodeURIComponent(ghUser.login)}`,
        );
        return;
      }

      const newUser = await store.upsertUser({
        githubId: String(ghUser.id),
        username: ghUser.login,
        displayName: ghUser.name || ghUser.login,
        avatarUrl: ghUser.avatar_url,
        email: resolvedEmail,
        role: 'member',
        githubTokenEncrypted: encryptedGithubToken,
      });

      const sessionToken = signSessionToken(newUser.id);
      clearGitHubOAuthCookies(res);
      res.cookie(SESSION_COOKIE_NAME, sessionToken, COOKIE_OPTIONS);
      res.redirect(`${config.appUrl}/?github=registered&onboarding=1`);
      return;
    }

    // 4. Fallback / legacy direct connect
    const user = await store.upsertUser({
      id: req.currentUser?.id || existing?.id,
      githubId: String(ghUser.id),
      username: existing?.username || ghUser.login,
      displayName: ghUser.name || existing?.displayName || ghUser.login,
      avatarUrl: ghUser.avatar_url,
      email: existing?.email || resolvedEmail,
      role: existing?.role || 'member',
      githubTokenEncrypted: encryptedGithubToken,
    });

    const sessionToken = signSessionToken(user.id);
    clearGitHubOAuthCookies(res);
    res.cookie(SESSION_COOKIE_NAME, sessionToken, COOKIE_OPTIONS);
    res.redirect(
      `${config.appUrl}/?github=${existing ? 'connected' : 'registered&onboarding=1'}`,
    );
  } catch {
    clearGitHubOAuthCookies(res);
    res.redirect(`${config.appUrl}/?auth_error=github_oauth_exception`);
  }
});

authRouter.get('/vercel', requireAuth, (_req, res) => {
  if (!isVercelOAuthConfigured()) {
    res.status(501).json({
      error:
        'Vercel OAuth is not configured. Set VERCEL_CLIENT_ID and VERCEL_CLIENT_SECRET in .env, or link a Vercel Personal Access Token.',
    });
    return;
  }

  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('cp_vercel_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/',
  });

  const params = new URLSearchParams({
    client_id: config.vercel.clientId,
    redirect_uri: config.vercel.redirectUri,
    state,
  });

  res.redirect(`https://vercel.com/oauth/authorize?${params.toString()}`);
});

authRouter.get('/vercel/callback', requireAuth, async (req, res) => {
  const code = String(req.query.code || '');
  const state = String(req.query.state || '');
  const cookies = parseCookies(req.headers.cookie);

  if (!code || !state || cookies.cp_vercel_state !== state) {
    res.redirect(`${config.appUrl}/?auth_error=invalid_vercel_state`);
    return;
  }

  try {
    const body = new URLSearchParams({
      client_id: config.vercel.clientId,
      client_secret: config.vercel.clientSecret,
      code,
      redirect_uri: config.vercel.redirectUri,
    });

    const tokenRes = await fetch('https://api.vercel.com/v2/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      team_id?: string | null;
    };

    if (!tokenData.access_token) {
      res.redirect(`${config.appUrl}/?auth_error=vercel_token_exchange_failed`);
      return;
    }

    const profileRes = await fetch('https://api.vercel.com/v2/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profileJson = (await profileRes.json()) as {
      user?: { username?: string };
    };

    const store = await getStore();
    await store.upsertUser({
      id: req.currentUser!.id,
      username: req.currentUser!.username,
      displayName: req.currentUser!.displayName,
      vercelTokenEncrypted: encryptToken(tokenData.access_token),
      vercelTeamId: tokenData.team_id || null,
      vercelUsername: profileJson.user?.username || req.currentUser!.username,
    });

    res.clearCookie('cp_vercel_state', { path: '/' });
    res.redirect(`${config.appUrl}/?vercel=connected`);
  } catch {
    res.redirect(`${config.appUrl}/?auth_error=vercel_oauth_exception`);
  }
});

authRouter.post('/vercel/token', requireAuth, async (req, res) => {
  const { token } = req.body as { token?: string };
  if (!token || token.trim().length < 10) {
    res.status(400).json({ error: 'Valid Vercel access token is required' });
    return;
  }

  const trimmed = token.trim();
  let vercelUsername = req.currentUser!.username;

  // Verify token against Vercel API unless explicitly running offline demo token
  if (!trimmed.startsWith('demo_')) {
    try {
      const verifyRes = await fetch('https://api.vercel.com/v2/user', {
        headers: { Authorization: `Bearer ${trimmed}` },
      });
      if (!verifyRes.ok) {
        res.status(400).json({ error: 'Invalid Vercel access token (API check failed)' });
        return;
      }
      const data = (await verifyRes.json()) as { user?: { username?: string } };
      vercelUsername = data.user?.username || vercelUsername;
    } catch {
      res.status(502).json({ error: 'Unable to reach Vercel API to verify token' });
      return;
    }
  } else {
    vercelUsername = `${req.currentUser!.username}-vercel`;
  }

  const store = await getStore();
  const updated = await store.upsertUser({
    id: req.currentUser!.id,
    username: req.currentUser!.username,
    displayName: req.currentUser!.displayName,
    vercelTokenEncrypted: encryptToken(trimmed),
    vercelUsername,
  });

  res.json({ user: toPublicUser(updated) });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

