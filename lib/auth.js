import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "@/models/User";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret";

export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

export function comparePassword(password, hashedPassword) {
  return bcrypt.compareSync(password, hashedPassword);
}

export function generateAccessToken(payload) {
  return jwt.sign({ ...payload, tokenType: "access" }, JWT_SECRET, {
    expiresIn: "15m",
  });
}

export function generateRefreshToken(payload) {
  return jwt.sign({ ...payload, tokenType: "refresh" }, JWT_SECRET, {
    expiresIn: "30d",
  });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

export async function getUserFromRequest(request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.split(" ")[1];
  const decoded = verifyToken(token);

  // Legacy tokens issued before the refresh-token rollout do not have a
  // tokenType. Keep accepting them until they expire, but never permit a
  // refresh token to be used as an API access token.
  if (
    !decoded ||
    !decoded.userId ||
    (decoded.tokenType && decoded.tokenType !== "access")
  ) {
    return null;
  }

  const user = await User.findOne({ _id: decoded.userId }).select(
    "-password -verifyToken -resetToken -resetTokenExpiry",
  );

  if (
    !user ||
    (decoded.sessionVersion !== undefined &&
      Number(decoded.sessionVersion) !== Number(user.sessionVersion || 0))
  ) {
    return null;
  }

  return user;
}
