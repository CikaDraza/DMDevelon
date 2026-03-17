import jwt, { decode } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "@/models/User";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret";

export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

export function comparePassword(password, hashedPassword) {
  return bcrypt.compareSync(password, hashedPassword);
}

export function generateToken(payload, expiresIn = "7d") {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
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

  if (!decoded || !decoded.userId) {
    return null;
  }

  const user = await User.findOne({ _id: decoded.userId }).select(
    "-password -resetToken -resetTokenExpiry",
  );
  console.log(user);
  return user;
}
