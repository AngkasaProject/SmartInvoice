import { compare } from "bcryptjs";

const PBKDF2_ITERATIONS = 100_000;
const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function derivePasswordKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index++) {
    mismatch |= left[index] ^ right[index];
  }
  return mismatch === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await derivePasswordKey(password, salt, PBKDF2_ITERATIONS);
  return [
    "pbkdf2-sha256",
    PBKDF2_ITERATIONS,
    toBase64(salt),
    toBase64(derived),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  const [algorithm, iterationsValue, saltValue, keyValue] =
    encodedHash.split("$");

  if (algorithm === "pbkdf2-sha256") {
    const iterations = Number(iterationsValue);
    if (
      !Number.isInteger(iterations) ||
      iterations < 1 ||
      iterations > 100_000 ||
      !saltValue ||
      !keyValue
    ) {
      return false;
    }
    try {
      const expected = fromBase64(keyValue);
      const actual = await derivePasswordKey(
        password,
        fromBase64(saltValue),
        iterations,
      );
      return equalBytes(actual, expected);
    } catch {
      return false;
    }
  }

  if (/^\$2[aby]\$/.test(encodedHash)) {
    return compare(password, encodedHash);
  }

  if (/^[a-f\d]{64}$/i.test(encodedHash)) {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(password),
    );
    const actual = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    let mismatch = 0;
    for (let index = 0; index < actual.length; index++) {
      mismatch |=
        actual.charCodeAt(index) ^
        encodedHash.toLowerCase().charCodeAt(index);
    }
    return mismatch === 0;
  }

  return false;
}
