import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Card, CardStatus, CardTemplate } from '../types';
import { demoStore } from './demoStore';

const CARDS_COLLECTION = 'cards';
const TEMPLATES_COLLECTION = 'cardTemplates';

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export async function findUniqueSlug(baseSlug: string, excludeCardId?: string): Promise<string> {
  let slugCandidate = baseSlug || 'card';
  let counter = 1;
  let isUnique = false;

  while (!isUnique) {
    const colRef = collection(db, CARDS_COLLECTION);
    const q = query(colRef, where('publicSlug', '==', slugCandidate), limit(1));
    const snap = await getDocs(q);

    if (snap.empty || (excludeCardId && snap.docs[0].id === excludeCardId)) {
      isUnique = true;
      return slugCandidate;
    }

    counter++;
    slugCandidate = `${baseSlug}-${counter}`;
  }

  return slugCandidate;
}

export async function getCardById(cardId: string): Promise<Card | null> {
  const docRef = doc(db, CARDS_COLLECTION, cardId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Card;
}

export async function getCardBySlug(slug: string): Promise<Card | null> {
  if (!auth.currentUser) {
    return demoStore.getCardBySlug(slug);
  }

  try {
    const colRef = collection(db, CARDS_COLLECTION);
    const q = query(colRef, where('publicSlug', '==', slug), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return demoStore.getCardBySlug(slug);
    const firstDoc = snap.docs[0];
    return { id: firstDoc.id, ...firstDoc.data() } as Card;
  } catch (err) {
    console.warn(`Error querying card by slug ${slug} from Firestore, falling back to demoStore:`, err);
    return demoStore.getCardBySlug(slug);
  }
}

export async function getCardByEmployeeId(employeeId: string): Promise<Card | null> {
  const colRef = collection(db, CARDS_COLLECTION);
  const q = query(colRef, where('employeeId', '==', employeeId), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Card;
}

export async function getCardsByCompany(companyId: string): Promise<Card[]> {
  if (!auth.currentUser) {
    return demoStore.getCards().filter((c) => c.companyId === companyId);
  }

  try {
    const colRef = collection(db, CARDS_COLLECTION);
    const q = query(colRef, where('companyId', '==', companyId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Card));
  } catch (err) {
    console.warn(`Error querying cards for company ${companyId}:`, err);
    return demoStore.getCards().filter((c) => c.companyId === companyId);
  }
}

export async function createCard(
  data: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>,
  customId?: string
): Promise<Card> {
  const colRef = collection(db, CARDS_COLLECTION);
  const docRef = customId ? doc(db, CARDS_COLLECTION, customId) : doc(colRef);
  const now = new Date().toISOString();

  const newCard: Card = {
    ...data,
    id: docRef.id,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(docRef, newCard);
  return newCard;
}

export async function updateCard(cardId: string, updates: Partial<Card>): Promise<void> {
  const docRef = doc(db, CARDS_COLLECTION, cardId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

// Built-in Default Templates
export const DEFAULT_TEMPLATES: CardTemplate[] = [
  {
    id: 'classic',
    name: 'Executive Classic',
    description: 'Timeless corporate layout with refined typography, badge header, and balanced contrast.',
    configuration: {
      layout: 'classic',
      badgeStyle: 'rounded',
      headerStyle: 'solid',
    },
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'modern',
    name: 'Neo Modern',
    description: 'Contemporary rounded silhouette with subtle brand accents, floating action dock, and clean geometry.',
    configuration: {
      layout: 'modern',
      badgeStyle: 'pill',
      headerStyle: 'gradient',
    },
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'minimal',
    name: 'Nordic Minimal',
    description: 'High-clarity monochromatic grid emphasizing crisp typographic hierarchy and streamlined actions.',
    configuration: {
      layout: 'minimal',
      badgeStyle: 'square',
      headerStyle: 'minimal',
    },
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export async function getCardTemplates(): Promise<CardTemplate[]> {
  try {
    const colRef = collection(db, TEMPLATES_COLLECTION);
    const snap = await getDocs(colRef);
    if (snap.empty) {
      return DEFAULT_TEMPLATES;
    }
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as CardTemplate[];
  } catch (err) {
    console.warn('Falling back to default templates:', err);
    return DEFAULT_TEMPLATES;
  }
}
