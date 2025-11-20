import jwt from 'jsonwebtoken';
import { prisma } from '../db';

interface SignedUrlPayload {
  documentId: string;
  userId: string;
  role: string;
  purpose: 'view' | 'download';
  expiresAt: number;
}

const SIGNED_URL_EXPIRY = 15 * 60 * 1000;

export async function generateSignedDocumentUrl(
  documentId: string,
  userId: string,
  role: string,
  purpose: 'view' | 'download' = 'view'
): Promise<{ signedUrl: string; expiresAt: Date }> {
  const document = await prisma.document.findUnique({
    where: { id: documentId }
  });

  if (!document) {
    throw new Error('Document not found');
  }

  const expiresAt = Date.now() + SIGNED_URL_EXPIRY;
  const payload: SignedUrlPayload = {
    documentId,
    userId,
    role,
    purpose,
    expiresAt
  };

  const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
  const token = jwt.sign(payload, jwtSecret, {
    expiresIn: '15m'
  });

  const baseUrl = process.env.API_URL || 'http://localhost:5000';
  const signedUrl = `${baseUrl}/api/documents/download/${documentId}?token=${token}`;

  return {
    signedUrl,
    expiresAt: new Date(expiresAt)
  };
}

export async function verifyDocumentToken(token: string): Promise<SignedUrlPayload> {
  try {
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    const payload = jwt.verify(token, jwtSecret) as SignedUrlPayload;

    if (payload.expiresAt < Date.now()) {
      throw new Error('Token expired');
    }

    return payload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

export async function canAccessDocument(
  documentId: string,
  userId: string,
  role: string
): Promise<boolean> {
  const document = await prisma.document.findUnique({
    where: { id: documentId }
  });

  if (!document) {
    return false;
  }

  if (role === 'admin') {
    return true;
  }

  if (document.userId === userId) {
    return true;
  }

  return false;
}

export async function getDocumentsByUserId(userId: string) {
  return prisma.document.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getDocumentById(documentId: string) {
  return prisma.document.findUnique({
    where: { id: documentId }
  });
}
