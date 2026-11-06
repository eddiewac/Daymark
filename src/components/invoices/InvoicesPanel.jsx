import { useEffect, useState } from 'react';
import { useSaveStatus } from '../save/SaveStatus.jsx';
import { useInvoices } from '../../hooks/useInvoices.js';
import { todayStr } from '../../lib/utils.js';
import {
  blankInvoiceDraft,
  buildMailto,
  clientDeleteBlock,
  clientForDocument,
  invoiceActionPayload,
  invoiceTotals,
  projectName,
  sellerForDocument,
  validateInvoice,
} from '../../lib/invoiceModel.js';
import InvoiceList from './InvoiceList.jsx';
import InvoiceEditor from './InvoiceEditor.jsx';
import SellerForm from './SellerForm.jsx';
import ClientsPanel from './ClientsPanel.jsx';
import { styles } from './invoiceUi.jsx';

export default function InvoicesPanel({ workspaceId, projects, tasks }) {
  const api = useInvoices(workspaceId);
  const { runSave } = useSaveStatus();
  const [view, setView] = useState('list');
  const [returnTo, setReturnTo] = useState('list');
  const [draft, setDraft] = useState(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const today = todayStr();

  useEffect(() => {
    setView('list');
    setDraft(null);
    setFormError('');
  }, [workspaceId]);

  const openSeller = (back) => {
    setReturnTo(back);
    setFormError('');
    setView('seller');
  };

  const openClients = (back) => {
    setReturnTo(back);
    setFormError('');
    setView('clients');
  };

  const otherLines = (api.invoices || [])
    .filter((invoice) => invoice.id !== draft?.id)
    .flatMap((invoice) => invoice.lines || []);

  const payloadFor = (current) => invoiceActionPayload(current, api.clients, api.seller);

  const remember = (invoice) => {
    const next = {
      ...invoice,
      lines: invoice.lines || [],
      savedLines: invoice.lines || [],
    };
    setDraft(next);
    return next;
  };

  const persist = async ({ forSend = false } = {}) => {
    if (!draft) return null;
    const payload = payloadFor(draft);
    const errors = validateInvoice(payload, { forSend });
    if (errors.length) {
      setFormError(errors[0]);
      return null;
    }
    if (draft.status && draft.status !== 'draft') return payload;
    setBusy(true);
    setFormError('');
    const result = await runSave(() => api.saveInvoice(payload));
    setBusy(false);
    if (!result?.ok) {
      setFormError(result?.error || 'Could not save the invoice');
      return null;
    }
    remember(result.invoice);
    await api.refresh();
    return { ...result.invoice, seller: api.seller, client: payload.client, savedLines: result.invoice.lines };
  };

  const download = async () => {
    const saved = await persist();
    if (!saved) return;
    const client = clientForDocument(saved, saved.client);
    const { downloadInvoicePdf } = await import('../../lib/invoicePdf.js');
    downloadInvoicePdf({
      invoice: { ...saved, projectName: projectName(projects, saved.projectId) },
      lines: saved.lines,
      seller: api.seller,
      client,
      today,
    });
  };

  const email = async () => {
    const saved = await persist({ forSend: !draft?.status || draft.status === 'draft' });
    if (!saved) return;
    const client = clientForDocument(saved, saved.client);
    if (!client.email) {
      setFormError(
        saved.status && saved.status !== 'draft'
          ? 'This invoice has no client email saved on it.'
          : 'Add an email address on the client, then try again.'
      );
      return;
    }
    const seller = sellerForDocument(saved, api.seller);
    const totals = invoiceTotals(saved.lines, saved.gstEnabled);
    const { downloadInvoicePdf } = await import('../../lib/invoicePdf.js');
    downloadInvoicePdf({
      invoice: { ...saved, projectName: projectName(projects, saved.projectId) },
      lines: saved.lines,
      seller: api.seller,
      client,
      today,
    });
    const mail = buildMailto({ invoice: saved, seller, client, totals });
    window.location.href = mail.href;
  };

  const changeStatus = async (status) => {
    const leavingDraft = (!draft?.status || draft.status === 'draft') && status !== 'draft';
    const saved = await persist({ forSend: leavingDraft });
    if (!saved?.id) return;
    setBusy(true);
    const result = await api.setInvoiceStatus(saved.id, status);
    setBusy(false);
    if (!result?.ok) {
      setFormError(result?.error || 'Could not update the status');
      return;
    }
    setDraft((current) => current && ({
      ...current,
      status: result.status,
      sentAt: result.sentAt,
      paidAt: result.paidAt,
    }));
    await api.refresh();
  };

  const remove = async () => {
    if (!draft?.id) return;
    if (!window.confirm('Delete this draft? Time on it can be invoiced again.')) return;
    setBusy(true);
    const result = await api.deleteInvoice(draft.id);
    setBusy(false);
    if (!result?.ok) {
      setFormError(result?.error || 'Could not delete the invoice');
      return;
    }
    setDraft(null);
    setView('list');
    await api.refresh();
  };

  if (api.loading && (api.invoices || []).length === 0 && !api.seller) {
    return (
      <div style={styles.wrap}>
        <div style={styles.empty}>Loading invoices…</div>
      </div>
    );
  }

  if (view === 'seller') {
    return (
      <SellerForm
        seller={api.seller}
        userEmail={api.userEmail}
        busy={busy}
        error={formError}
        onBack={() => setView(returnTo)}
        onSave={async (next) => {
          setBusy(true);
          setFormError('');
          const result = await runSave(() => api.saveSeller(next));
          setBusy(false);
          if (!result?.ok) {
            setFormError(result?.error || 'Could not save your details');
            return;
          }
          setView(returnTo);
        }}
      />
    );
  }

  if (view === 'clients') {
    return (
      <ClientsPanel
        clients={api.clients || []}
        busy={busy}
        error={formError}
        onBack={() => setView(returnTo)}
        onSave={async (client) => {
          setBusy(true);
          const result = await api.saveClient(client);
          setBusy(false);
          if (!result?.ok) setFormError(result?.error || 'Could not save the client');
          else setFormError('');
          return result;
        }}
        onDelete={async (client) => {
          const block = clientDeleteBlock(client, api.invoices);
          if (block) {
            setFormError(block.error);
            return;
          }
          if (!window.confirm(`Delete ${client.name}?`)) return;
          setBusy(true);
          const result = await api.deleteClient(client);
          setBusy(false);
          if (!result?.ok) setFormError(result?.error || 'Could not delete the client');
          else setFormError('');
        }}
      />
    );
  }

  if (view === 'edit' && draft) {
    return (
      <InvoiceEditor
        draft={draft}
        projects={projects || []}
        tasks={tasks || []}
        clients={api.clients || []}
        seller={api.seller}
        allLines={otherLines}
        today={today}
        busy={busy}
        error={formError}
        onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
        onSave={() => persist()}
        onDelete={remove}
        onStatus={changeStatus}
        onDownload={download}
        onEmail={email}
        onBack={() => setView('list')}
        onCreateClient={async (fields) => {
          setBusy(true);
          const result = await api.saveClient(fields);
          setBusy(false);
          return result;
        }}
        onLoadUnbilled={api.loadUnbilledForProject}
        onEditSeller={() => openSeller('edit')}
      />
    );
  }

  return (
    <div style={styles.wrap}>
      {api.error && <div style={{ ...styles.error, margin: '12px 20px 0' }}>{api.error}</div>}
      <InvoiceList
        invoices={api.invoices || []}
        projects={projects || []}
        today={today}
        onOpen={(invoice) => {
          setFormError('');
          setDraft({ ...invoice, lines: invoice.lines || [], savedLines: invoice.lines || [] });
          setView('edit');
        }}
        onCreate={() => {
          setFormError('');
          setDraft(blankInvoiceDraft(today));
          setView('edit');
        }}
        onSeller={() => openSeller('list')}
        onClients={() => openClients('list')}
      />
    </div>
  );
}
