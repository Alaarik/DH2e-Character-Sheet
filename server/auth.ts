import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { generateToken, AuthUser } from './middleware/auth.js';
import db from './db.js';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();
const DEV_MODE = process.env.DEV_MODE === 'true';
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || '';
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'http://localhost:5173/auth/discord/callback';

// GET /auth/me — Current user info
router.get('/me', (req: Request, res: Response) => {
  if (DEV_MODE) {
    const devUser: AuthUser = {
      discord_id: 'dev-user-001',
      username: 'DevUser',
      avatar_url: undefined,
    };
    // Ensure dev user exists in DB
    db.prepare(`
      INSERT OR IGNORE INTO users (discord_id, username, avatar_url, last_login)
      VALUES (?, ?, ?, datetime('now'))
    `).run(devUser.discord_id, devUser.username, devUser.avatar_url || null);

    res.json({ user: devUser });
    return;
  }

  const token = req.cookies?.token;
  if (!token) {
    res.json({ user: null });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as AuthUser;
    res.json({ user: decoded });
  } catch {
    res.json({ user: null });
  }
});

// GET /auth/discord — Redirect to Discord OAuth
router.get('/discord', (_req: Request, res: Response) => {
  if (DEV_MODE) {
    // In dev mode, just create a session immediately
    const devUser: AuthUser = {
      discord_id: 'dev-user-001',
      username: 'DevUser',
    };
    db.prepare(`
      INSERT OR IGNORE INTO users (discord_id, username, avatar_url, last_login)
      VALUES (?, ?, ?, datetime('now'))
    `).run(devUser.discord_id, devUser.username, null);

    const token = generateToken(devUser);
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.redirect('/');
    return;
  }

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify',
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

// GET /auth/discord/callback — Exchange code for token
router.get('/discord/callback', async (req: Request, res: Response) => {
  const { code } = req.query;
  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Missing code' });
    return;
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenRes.json() as { access_token: string };

    // Fetch user info
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userRes.json() as { id: string; username: string; avatar: string | null };

    const avatarUrl = userData.avatar
      ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
      : null;

    // Upsert user in DB
    db.prepare(`
      INSERT INTO users (discord_id, username, avatar_url, last_login)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(discord_id) DO UPDATE SET
        username = excluded.username,
        avatar_url = excluded.avatar_url,
        last_login = datetime('now')
    `).run(userData.id, userData.username, avatarUrl);

    const user: AuthUser = {
      discord_id: userData.id,
      username: userData.username,
      avatar_url: avatarUrl || undefined,
    };

    const jwtToken = generateToken(user);
    res.cookie('token', jwtToken, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.redirect('/');
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// POST /auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

export default router;
