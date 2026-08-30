import { initializeApp, deleteApp } from 'firebase/app';
import { 
  initializeFirestore, 
  collection, 
  getDocs, 
  setDoc, 
  doc, 
  deleteDoc, 
  writeBatch 
} from 'firebase/firestore';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  type User
} from 'firebase/auth';
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'firebase/storage';
import { Student, Guardian, Enrollment, ContraturnoSegment, FinancialMovement } from './types';
import { 
  INITIAL_STUDENTS, 
  INITIAL_GUARDIANS, 
  INITIAL_ENROLLMENTS, 
  INITIAL_CONTRATURNO_SEGMENTS, 
  INITIAL_FINANCIAL_MOVEMENTS 
} from './data';
import {
  IMPORTED_STUDENTS,
  getImportedGuardians,
  getImportedEnrollments,
  getImportedContraturnos
} from './importedStudents';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase with the custom database ID and enable long polling
const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);
export const auth = getAuth(app);

/**
 * Login individual por e-mail e senha (Firebase Authentication). As contas da
 * equipe são criadas manualmente no Firebase Console (Authentication → Users
 * → Add user) — não existe cadastro público dentro do app, o que é
 * intencional: só quem a escola autorizou tem acesso.
 */
export async function signIn(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

export function watchAuthState(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export async function requestPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Login anônimo, usado só para quem abre o link público da Carta de Intenção
 * (?alunoId=... ou ?carta=...). Os pais não têm conta própria — mas como as
 * regras do Firestore agora exigem `request.auth != null` para qualquer
 * leitura, sem isso o link ficaria bloqueado antes mesmo de mostrar a carta.
 * O login anônimo satisfaz a regra de segurança sem exigir e-mail/senha.
 */
export async function signInAsPublicVisitor(): Promise<void> {
  await signInAnonymously(auth);
}

/**
 * Cria uma conta nova para alguém da equipe (e-mail + senha), direto pelo
 * app, sem precisar abrir o Firebase Console para isso. Usa uma instância
 * secundária e temporária do Firebase só para esse cadastro — assim, quem
 * está criando o acesso NÃO é deslogado da própria sessão no processo
 * (limitação normal do SDK do Firebase para o navegador: criar uma conta
 * loga automaticamente com ela, então criamos e destruímos essa instância
 * separada em vez de usar a principal).
 */
export async function createTeamMemberAccount(email: string, password: string): Promise<void> {
  const secondaryApp = initializeApp(firebaseConfig, `criar-acesso-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    await createUserWithEmailAndPassword(secondaryAuth, email, password);
  } finally {
    await firebaseSignOut(secondaryAuth).catch(() => {});
    await deleteApp(secondaryApp);
  }
}

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Checks if the Firestore database is empty or has old mock data. If so, automatically
 * seeds it with the 67 real students from the Sítio-Escola Geranium dataset.
 */
export async function seedDatabaseIfEmpty() {
  const studentsRef = collection(db, 'students');
  let studentsSnap;
  try {
    studentsSnap = await getDocs(studentsRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'students');
  }

  // We seed if it is empty, if it contains old mock student "student_1", or if student count is less than 60
  const needsSeeding = studentsSnap.empty || studentsSnap.docs.some(d => d.id === 'student_1') || studentsSnap.size < 60;
  
  if (!needsSeeding) {
    console.log('Database already populated with official Sítio Geranium data. Skipping seed.');
    return;
  }
  
  console.log('Firestore needs initial seed. Cleaning up and automatically seeding the 67 real Sítio-Escola Geranium students...');
  
  // Clean first to prevent mixed mock/real data
  await clearAllDatabaseCollections();

  const batch = writeBatch(db);

  // 1. Seed Students
  IMPORTED_STUDENTS.forEach((student) => {
    const docRef = doc(db, 'students', student.id);
    batch.set(docRef, student);
  });

  // 2. Seed Guardians
  const guardiansList = getImportedGuardians();
  guardiansList.forEach((guardian) => {
    const docRef = doc(db, 'guardians', guardian.id);
    batch.set(docRef, guardian);
  });

  // 3. Seed Enrollments
  const enrollmentsList = getImportedEnrollments();
  enrollmentsList.forEach((enrollment) => {
    const docRef = doc(db, 'enrollments', enrollment.id);
    batch.set(docRef, enrollment);
  });

  // 4. Seed Contraturnos
  const contraturnosList = getImportedContraturnos();
  contraturnosList.forEach((segment) => {
    const docRef = doc(db, 'contraturnos', segment.id);
    batch.set(docRef, segment);
  });

  try {
    await batch.commit();
    console.log('Automatic seeding of 67 real Sítio Geranium students completed successfully!');
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'batch_automatic_seed');
  }
}

/**
 * Deletes all documents from the Firestore database collections to allow a clean state/import.
 */
export async function clearAllDatabaseCollections(): Promise<void> {
  const collections = ['students', 'guardians', 'enrollments', 'contraturnos', 'movements'];
  for (const colName of collections) {
    try {
      const colRef = collection(db, colName);
      const snap = await getDocs(colRef);
      const batch = writeBatch(db);
      snap.docs.forEach((d) => {
        batch.delete(d.ref);
      });
      await batch.commit();
      console.log(`Cleared collection: ${colName}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `clear_${colName}`);
    }
  }
}

/**
 * Fetch all documents from a Firestore collection
 */
export async function getCollectionData<T>(collectionName: string): Promise<T[]> {
  try {
    const colRef = collection(db, collectionName);
    const snap = await getDocs(colRef);
    return snap.docs.map(d => d.data() as T);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, collectionName);
  }
}

/**
 * Add or update a document in a collection
 */
export async function saveDocument<T extends { id: string }>(collectionName: string, data: T): Promise<void> {
  try {
    const docRef = doc(db, collectionName, data.id);
    await setDoc(docRef, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${collectionName}/${data.id}`);
  }
}

/**
 * Delete a document from a collection
 */
export async function deleteDocument(collectionName: string, id: string): Promise<void> {
  try {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${collectionName}/${id}`);
  }
}

/**
 * Migração única: copia Guardian.contato (campo antigo) para Guardian.telefone
 * (campo novo) em todos os responsáveis já cadastrados, e remove o campo antigo.
 *
 * Idempotente e segura para rodar mais de uma vez: só mexe em documentos que
 * ainda têm `contato` preenchido e `telefone` vazio. Nenhum dado é perdido —
 * cada documento é regravado por completo (setDoc sem merge), então o campo
 * `contato` deixa de existir no Firestore assim que o objeto novo é salvo.
 *
 * Chame esta função uma vez (ex: um botão em Configurações, ou uma linha
 * temporária no bootstrap do app) e depois pode remover a chamada.
 */
export async function migrateGuardianContatoParaTelefone(): Promise<{ migrados: number; total: number }> {
  const guardians = await getCollectionData<Guardian>('guardians');
  let migrados = 0;

  for (const guardian of guardians) {
    const precisaMigrar = !!guardian.contato && !guardian.telefone;
    if (!precisaMigrar) continue;

    const { contato, ...resto } = guardian;
    const guardianAtualizado: Guardian = {
      ...resto,
      telefone: contato as string,
    };

    await saveDocument('guardians', guardianAtualizado);
    migrados++;
  }

  return { migrados, total: guardians.length };
}

/**
 * Envia (ou substitui) o arquivo de um documento do Pack de Matrícula no
 * Firebase Storage e devolve a URL pública de download. Cada documento tem
 * um `docId` fixo (ex: 'ficha_dados_gerais') — subir um arquivo novo com o
 * mesmo docId simplesmente sobrescreve o anterior no Storage.
 */
export async function uploadPackDocument(docId: string, file: File): Promise<string> {
  const extension = file.name.split('.').pop() || 'pdf';
  const fileRef = storageRef(storage, `pack-documents/${docId}.${extension}`);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}

/**
 * Remove o arquivo de um documento do Pack de Matrícula do Storage.
 * O caminho precisa incluir a extensão exata que foi usada no upload.
 */
export async function deletePackDocumentFile(storagePath: string): Promise<void> {
  try {
    await deleteObject(storageRef(storage, storagePath));
  } catch (error) {
    // Arquivo pode já não existir — não é um erro crítico para o usuário.
    console.warn('Não foi possível remover o arquivo do Storage:', error);
  }
}

