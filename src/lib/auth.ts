import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import type { AuthUser } from "./types";
import type { RoleName } from "./constants";

const COOKIE_NAME = "sda_session";
const SESSION_DAYS = 7;

type SessionPayload = {
  sub: string;
  email: string;
};

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set to a random string of at least 32 characters.");
  }
  return secret;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function signSession(user: { id: string; email: string }) {
  return jwt.sign({ sub: user.id, email: user.email } satisfies SessionPayload, authSecret(), {
    expiresIn: `${SESSION_DAYS}d`
  });
}

export function setSessionCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60
  });
}

export function clearSessionCookie() {
  cookies().set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, authSecret()) as SessionPayload;
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true }
    });

    if (!user || !user.active) return null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      roleName: user.role.name as RoleName,
      active: user.active,
      unionId: user.unionId,
      conferenceId: user.conferenceId,
      districtId: user.districtId,
      churchId: user.churchId
    };
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireSuperAdmin() {
  const user = await requireUser();
  if (user.roleName !== "Super Admin") redirect("/dashboard");
  return user;
}

export { COOKIE_NAME };
