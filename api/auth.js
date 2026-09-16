// api/auth.js
// High-performance direct Neon Authentication API
// Supports: Login, Register, Session validation (JWT), and Profile retrieval.
// Zero dependence on Supabase.
import { Client } from '@neondatabase/serverless';
import crypto from 'crypto';

// Minimal JWT generation using native Node.js crypto (zero extra npm dependencies)
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64').toString('utf8');
}

const JWT_SECRET = process.env.JWT_SECRET || 'gama-secure-jwt-secret-key-2026-neon-auth';

function signJWT(payload, expiresInSeconds = 30 * 24 * 3600) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload = { ...payload, exp };
  
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyJWT(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    if (signature !== expectedSig) return null;

    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return null; // Expired
    }
    return payload;
  } catch (_) {
    return null;
  }
}

// Password hashing using native PBKDF2 (secure, standard, zero external packages)
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  // If user has plain password or admin123 default
  if (!stored.includes(':')) {
    return password === stored;
  }
  const [salt, originalHash] = stored.split(':');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === originalHash;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const databaseUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    return res.status(500).json({ error: 'NEON_DATABASE_URL is not configured' });
  }

  const client = new Client(databaseUrl);
  try {
    await client.connect();

    // ── 1. GET /api/auth (Session verification) ──────────────────────────────
    if (req.method === 'GET') {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const decoded = verifyJWT(token);
      if (!decoded || !decoded.uid) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      if (decoded.uid === 'admin-master') {
        return res.status(200).json({
          user: {
            uid: 'admin-master',
            id: 'admin-master',
            name: 'Administrateur',
            email: 'admin@lconq.ma',
            role: 'admin',
            tier: 'premium',
            xp: 0,
            streak: 0,
            rank: null,
            totalStudents: 1200,
            subscription: null,
          }
        });
      }

      const query = await client.query(
        'SELECT id, name, email, role, tier, xp, streak, rank, total_students, phone, city, school, class_id, subscription FROM public.profiles WHERE id = $1 LIMIT 1;',
        [decoded.uid]
      );

      if (query.rows.length === 0) {
        return res.status(404).json({ error: 'User profile not found' });
      }

      const user = query.rows[0];
      return res.status(200).json({
        user: {
          uid: user.id,
          id: user.id,
          name: user.name || 'Utilisateur',
          email: user.email,
          role: user.role || 'student',
          tier: user.tier || 'premium',
          xp: user.xp || 0,
          streak: user.streak || 0,
          rank: user.rank || null,
          totalStudents: user.total_students || 1200,
          phone: user.phone || '',
          city: user.city || '',
          school: user.school || '',
          subscription: user.subscription || null,
        }
      });
    }

    // ── 2. POST /api/auth (Register, Login) ──────────────────────────────────
    if (req.method === 'POST') {
      const { action, email, password, name } = req.body || {};

      if (!action) {
        return res.status(400).json({ error: 'Missing action' });
      }

      // (A) LOGIN ACTION
      if (action === 'login') {
        if (!email || !password) {
          return res.status(400).json({ error: 'Veuillez saisir votre email et mot de passe.' });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // 1. Hardcoded admin emergency check
        if (normalizedEmail === 'admin@lconq.ma' && password === 'admin123') {
          const token = signJWT({ uid: 'admin-master', email: normalizedEmail, role: 'admin' });
          return res.status(200).json({
            token,
            user: {
              uid: 'admin-master',
              id: 'admin-master',
              name: 'Administrateur',
              email: normalizedEmail,
              role: 'admin',
              tier: 'premium',
              xp: 0,
              streak: 0,
              rank: null,
              totalStudents: 1200,
              subscription: null,
            }
          });
        }

        // 2. Query Neon Database for user
        const query = await client.query(
          'SELECT * FROM public.profiles WHERE LOWER(email) = $1 LIMIT 1;',
          [normalizedEmail]
        );

        if (query.rows.length === 0) {
          return res.status(400).json({ error: 'Identifiants invalides. Utilisateur introuvable.' });
        }

        const user = query.rows[0];

        // Check password if set
        if (user.password_hash) {
          const isValid = verifyPassword(password, user.password_hash);
          if (!isValid) {
            return res.status(400).json({ error: 'Mot de passe incorrect.' });
          }
        } else {
          // If no password set yet, set current password as password_hash automatically
          const hashed = hashPassword(password);
          await client.query('UPDATE public.profiles SET password_hash = $1 WHERE id = $2;', [hashed, user.id]);
        }

        const token = signJWT({ uid: user.id, email: user.email, role: user.role || 'student' });
        return res.status(200).json({
          token,
          user: {
            uid: user.id,
            id: user.id,
            name: user.name || 'Utilisateur',
            email: user.email,
            role: user.role || 'student',
            tier: user.tier || 'premium',
            xp: user.xp || 0,
            streak: user.streak || 0,
            rank: user.rank || null,
            totalStudents: user.total_students || 1200,
            phone: user.phone || '',
            city: user.city || '',
            school: user.school || '',
            subscription: user.subscription || null,
          }
        });
      }

      // (B) REGISTER ACTION
      if (action === 'register') {
        if (!email || !password || !name) {
          return res.status(400).json({ error: 'Veuillez remplir tous les champs obligatoires.' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        if (normalizedEmail === 'admin@lconq.ma') {
          return res.status(400).json({ error: 'Inscription impossible avec cette adresse e-mail.' });
        }

        // Check if user already exists
        const existing = await client.query(
          'SELECT id FROM public.profiles WHERE LOWER(email) = $1 LIMIT 1;',
          [normalizedEmail]
        );

        if (existing.rows.length > 0) {
          return res.status(400).json({ error: 'Cette adresse email est déjà enregistrée. Essayez de vous connecter.' });
        }

        const newId = 'u_' + crypto.randomBytes(8).toString('hex');
        const passwordHash = hashPassword(password);
        const now = new Date().toISOString();

        await client.query(
          `INSERT INTO public.profiles 
           (id, name, email, role, tier, xp, streak, total_students, password_hash, joined, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, $10);`,
          [newId, name.trim(), normalizedEmail, 'student', 'premium', 0, 0, 1200, passwordHash, now]
        );

        const token = signJWT({ uid: newId, email: normalizedEmail, role: 'student' });
        return res.status(200).json({
          token,
          user: {
            uid: newId,
            id: newId,
            name: name.trim(),
            email: normalizedEmail,
            role: 'student',
            tier: 'premium',
            xp: 0,
            streak: 0,
            rank: null,
            totalStudents: 1200,
            subscription: null,
          }
        });
      }

      return res.status(400).json({ error: `Unknown action ${action}` });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[Neon Auth Error]:', err);
    return res.status(500).json({ error: err.message || 'Authentication error' });
  } finally {
    await client.end().catch(() => {});
  }
}
