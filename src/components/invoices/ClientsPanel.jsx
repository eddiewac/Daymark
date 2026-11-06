import { useState } from 'react';
import { Field, styles } from './invoiceUi.jsx';

export default function ClientsPanel({ clients, busy, error, onSave, onDelete, onBack }) {
  const [editing, setEditing] = useState(null);

  return (
    <div style={styles.wrap}>
      <div style={styles.scroll}>
        <button type="button" style={styles.back} onClick={onBack}>← Back</button>
        <div style={styles.head}>
          <div style={styles.titleBlock}>
            <h2 style={styles.title}>Clients</h2>
            <p style={styles.sub}>People and companies you bill from this workspace. Only you can see them.</p>
          </div>
          <button
            type="button"
            style={styles.primary}
            onClick={() => setEditing({ id: null, name: '', company: '', email: '', address: '' })}
          >
            New client
          </button>
        </div>
        {error && <div style={styles.error}>{error}</div>}
        {editing && (
          <ClientEditor
            client={editing}
            busy={busy}
            onCancel={() => setEditing(null)}
            onSave={async (fields) => {
              const result = await onSave({ ...editing, ...fields });
              if (result?.ok) setEditing(null);
              return result;
            }}
          />
        )}
        {clients.length === 0 ? (
          <div style={styles.empty}>No clients yet.</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Company</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th} />
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td style={styles.td}>{client.name}</td>
                    <td style={styles.td}>{client.company || '—'}</td>
                    <td style={styles.td}>{client.email || '—'}</td>
                    <td style={styles.td}>
                      <div style={styles.actions}>
                        <button type="button" style={styles.ghost} onClick={() => setEditing(client)}>Edit</button>
                        <button
                          type="button"
                          style={styles.danger}
                          disabled={busy}
                          onClick={() => onDelete(client)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ClientEditor({ client, busy, onSave, onCancel }) {
  const [name, setName] = useState(client.name || '');
  const [company, setCompany] = useState(client.company || '');
  const [email, setEmail] = useState(client.email || '');
  const [address, setAddress] = useState(client.address || '');
  const [error, setError] = useState('');

  return (
    <form
      style={{ ...styles.card, marginBottom: 14 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setError('');
        const result = await onSave({ name, company, email, address });
        if (result && !result.ok) setError(result.error || 'Could not save client');
      }}
    >
      {error && <div style={styles.error}>{error}</div>}
      <div style={styles.grid}>
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} style={styles.field} maxLength={200} required />
        </Field>
        <Field label="Company">
          <input value={company} onChange={(e) => setCompany(e.target.value)} style={styles.field} maxLength={200} />
        </Field>
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={styles.field} maxLength={200} />
        </Field>
        <Field label="Address">
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} style={{ ...styles.field, ...styles.area }} maxLength={500} />
        </Field>
      </div>
      <div style={{ ...styles.actions, marginTop: 10 }}>
        <button type="submit" style={styles.primary} disabled={busy}>Save client</button>
        <button type="button" style={styles.ghost} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
