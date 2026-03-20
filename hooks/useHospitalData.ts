import { useState, useEffect, useCallback } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy, limit, doc, deleteDoc, writeBatch, getDocs, where } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { 
  Patient, 
  HospitalUnit, 
  PatientMovement, 
  PatientStatus, 
  MovementType, 
  Collaborator,
  AccessLog
} from '../types';

export const useHospitalData = (currentUser: Collaborator | null) => {
  const [units, setUnits] = useState<HospitalUnit[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [movements, setMovements] = useState<PatientMovement[]>([]);
  const [users, setUsers] = useState<Collaborator[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubUnits = onSnapshot(collection(db, 'units'), (snapshot) => {
      const unitsData = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        capacity: doc.data().capacity,
        bedNames: doc.data().bedNames || []
      })) as HospitalUnit[];
      setUnits(unitsData);
    });

    const unsubPatients = onSnapshot(query(collection(db, 'patients')), (snapshot) => {
      const patientsData = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            unitId: data.unitId,
            bed: data.bed,
            sesId: data.sesId,
            name: data.name,
            gender: data.gender,
            age: data.age,
            entryDateHospital: data.entryDateHospital,
            admissionDate: data.admissionDate,
            dischargeDate: data.dischargeDate,
            origin: data.origin,
            externalDestination: data.externalDestination,
            diagnosis: data.diagnosis,
            etiologicalAgent: data.etiologicalAgent,
            status: data.status,
            isolationType: data.isolationType,
            isExtra: data.isExtra,
            blockReason: data.blockReason,
            pendingTasks: data.pendingTasks || []
          } as Patient;
        })
        .filter(p => ![PatientStatus.DISCHARGED, PatientStatus.DECEASED, PatientStatus.EVASION, PatientStatus.TRANSFERRED].includes(p.status));
      setPatients(patientsData);
    });

    const unsubMovements = onSnapshot(query(collection(db, 'movements'), orderBy('date', 'desc'), limit(2000)), (snapshot) => {
      const movementsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PatientMovement[];
      setMovements(movementsData);
    });

    let unsubUsers = () => {};
    let unsubLogs = () => {};

    if (currentUser?.role === 'admin') {
      unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        const usersData = snapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data()
        })) as Collaborator[];
        setUsers(usersData);
      });

      unsubLogs = onSnapshot(query(collection(db, 'access_logs'), orderBy('timestamp', 'desc'), limit(500)), (snapshot) => {
        const logsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as AccessLog[];
        setAccessLogs(logsData);
      });
    }

    setLoading(false);

    return () => {
      unsubUnits();
      unsubPatients();
      unsubMovements();
      unsubUsers();
      unsubLogs();
    };
  }, [currentUser?.role]);

  const deleteUnitCascade = async (unitId: string) => {
    setLoading(true);
    try {
      const batch = writeBatch(db);
      
      const patientsQuery = query(collection(db, 'patients'), where('unitId', '==', unitId));
      const patientsSnap = await getDocs(patientsQuery);
      
      patientsSnap.docs.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });

      batch.delete(doc(db, 'units', unitId));
      await batch.commit();

      return true;
    } catch (e: any) {
      toast.error("Erro ao excluir unidade: " + (e.message || "Erro de banco de dados"));
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { units, patients, movements, users, accessLogs, loading, fetchData, deleteUnitCascade };
};
