import { useState } from 'react';
import { safeLogoSrc } from '../../lib/invoiceModel.js';
import { Field, styles } from './invoiceUi.jsx';

export default function SellerForm({ seller, userEmail, busy, error, onSave, onBack }) {
  const [businessName, setBusinessName] = useState(seller?.businessName || '');
  const [abn, setAbn] = useState(seller?.abn || '');
  const [address, setAddress] = useState(seller?.address || '');
  const [email, setEmail] = useState(seller?.email || userEmail || '');
  const [paymentInstructions, setPaymentInstructions] = useState(seller?.paymentInstructions || '');
  const [logoData, setLogoData] = useState(seller?.logoData || '');
  const [logoWidth, setLogoWidth] = useState(seller?.logoWidth || null);
  const [logoHeight, setLogoHeight] = useState(seller?.logoHeight || null);
  const [localError, setLocalError] = useState('');

  const logo = safeLogoSrc(logoData);

  return (
    <div style={styles.wrap}>
      <div style={styles.scroll}>
        <button type="button" style={styles.back} onClick={onBack}>← Back</button>
        <div style={styles.head}>
          <div style={styles.titleBlock}>
            <h2 style={styles.title}>Your details</h2>
            <p style={styles.sub}>
              Shown once on every invoice you send. These belong to you, not the workspace.
              Teammates cannot see your invoices. Daymark does not collect the payment — write
              however you want to be paid.
            </p>
          </div>
        </div>
        {(error || localError) && <div style={styles.error}>{error || localError}</div>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setLocalError('');
            onSave({
              businessName,
              abn,
              address,
              email,
              paymentInstructions,
              logoData: logo,
              logoWidth: logo ? logoWidth : null,
              logoHeight: logo ? logoHeight : null,
            });
          }}
        >
          <div style={styles.grid}>
            <Field label="Business or your name">
              <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} style={styles.field} maxLength={200} required />
            </Field>
            <Field label="ABN (if you have one)">
              <input value={abn} onChange={(e) => setAbn(e.target.value)} style={styles.field} maxLength={20} />
            </Field>
            <Field label="Email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={styles.field} maxLength={200} />
            </Field>
            <Field label="Address">
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} style={{ ...styles.field, ...styles.area }} maxLength={500} />
            </Field>
          </div>
          <div style={{ marginTop: 12 }}>
            <Field label="Payment instructions">
              <textarea
                value={paymentInstructions}
                onChange={(e) => setPaymentInstructions(e.target.value)}
                style={{ ...styles.field, ...styles.area, minHeight: 110 }}
                maxLength={2000}
                placeholder={'PayID: name@bank\nBSB 062-000  Account 12345678\nUse the invoice number as the reference.'}
              />
            </Field>
          </div>
          <div style={{ marginTop: 12 }}>
            <span style={styles.label}>Logo (optional)</span>
            {logo && <img src={logo} alt="" style={styles.logo} />}
            <div style={{ ...styles.actions, marginTop: 8 }}>
              <label style={styles.ghost}>
                Choose image
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    try {
                      const next = await readLogo(file);
                      setLogoData(next.logoData);
                      setLogoWidth(next.logoWidth);
                      setLogoHeight(next.logoHeight);
                      setLocalError('');
                    } catch (err) {
                      setLocalError(err?.message || 'Could not read that image');
                    }
                  }}
                />
              </label>
              {logo && (
                <button
                  type="button"
                  style={styles.ghost}
                  onClick={() => {
                    setLogoData('');
                    setLogoWidth(null);
                    setLogoHeight(null);
                  }}
                >
                  Remove logo
                </button>
              )}
            </div>
          </div>
          <div style={{ ...styles.actions, marginTop: 16 }}>
            <button type="submit" style={styles.primary} disabled={busy}>Save details</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function readLogo(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg)$/.test(file.type || '')) {
      reject(new Error('Logo must be a PNG or JPEG.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 480;
        const scale = Math.min(1, max / Math.max(img.width, img.height, 1));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const logoData = canvas.toDataURL('image/jpeg', 0.85);
        if (logoData.length > 180000) {
          reject(new Error('Logo is too large. Use a smaller image.'));
          return;
        }
        resolve({ logoData, logoWidth: width, logoHeight: height });
      };
      img.onerror = () => reject(new Error('Could not read that image.'));
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}
