import { useCallback, useEffect, useState } from 'react';
import {
  deleteClient,
  deleteInvoice,
  loadClients,
  loadInvoices,
  loadSeller,
  loadUnbilledTime,
  saveClient,
  saveInvoice,
  saveSeller,
  setInvoiceStatus,
} from '../lib/invoices.js';
import { taskBelongsToProject } from '../lib/invoiceModel.js';

// Loads the signed-in freelancer's seller profile, clients, and invoices
// for the workspace currently on screen. Personal workspace uses null.
export function useInvoices(workspaceId) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [seller, setSeller] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);

  const reload = useCallback(async () => {
    const [sellerRes, clientRes, invoiceRes] = await Promise.all([
      loadSeller(),
      loadClients(workspaceId),
      loadInvoices(workspaceId),
    ]);
    const problem = [sellerRes, clientRes, invoiceRes].find((result) => !result.ok);
    setError(problem?.error || '');
    setSeller(sellerRes.seller || null);
    setUserEmail(sellerRes.userEmail || '');
    setClients(clientRes.clients || []);
    setInvoices(invoiceRes.invoices || []);
    return { sellerRes, clientRes, invoiceRes };
  }, [workspaceId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reload().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const refresh = useCallback(async () => {
    await reload();
  }, [reload]);

  return {
    loading,
    error,
    seller,
    userEmail,
    clients,
    invoices,
    refresh,
    saveSeller: async (next) => {
      const result = await saveSeller(next);
      if (result.ok) setSeller(result.seller);
      return result;
    },
    saveClient: async (client) => {
      const result = await saveClient(client, workspaceId);
      if (result.ok) {
        setClients((prev) => {
          const without = prev.filter((item) => item.id !== result.client.id);
          return [...without, result.client].sort((a, b) => a.name.localeCompare(b.name));
        });
      }
      return result;
    },
    deleteClient: async (clientId) => {
      const result = await deleteClient(clientId);
      if (result.ok) setClients((prev) => prev.filter((item) => item.id !== clientId));
      return result;
    },
    saveInvoice: (draft) => saveInvoice(draft, workspaceId),
    setInvoiceStatus,
    deleteInvoice,
    loadUnbilledForProject: async (project, tasks) => {
      const ids = (tasks || []).filter((task) => taskBelongsToProject(task, project)).map((task) => task.id);
      return loadUnbilledTime(ids);
    },
  };
}
