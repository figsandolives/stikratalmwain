(function () {
  const TARGET_DEVICE_ID = 'dev-xxp7w0ue-plpo';
  const REQUEST_PATH = 'labelPrintRequests';

  if (window.__labelPrintBridgeStarted) return;
  window.__labelPrintBridgeStarted = true;

  function getDeviceId() {
    return localStorage.getItem('deviceId') || '';
  }

  function zplSafe(value, maxLength) {
    return String(value || '')
      .replace(/\^/g, '')
      .replace(/~/g, '')
      .replace(/\r?\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength || 120);
  }

  function buildMobileLabelZpl(item) {
    const title = zplSafe(item.nameEn || item.latinName || item.nameAr, 52);
    const subtitle = zplSafe(item.latinName || item.nameAr || '', 56);
    const ingredients = zplSafe(item.ingredients || '', 92);
    const origin = zplSafe(item.origin || '', 44);
    const productionDate = zplSafe(item.productionDate || '', 20);
    const expiryDate = zplSafe(item.expiryDate || '', 20);
    const barcode = zplSafe(item.barcode || '', 40);
    const copies = Math.max(1, Math.floor(Number(item.quantity || 1)));
    const lines = [
      '^XA',
      '^CI28',
      '^PW456',
      '^LL304',
      '^LH0,0',
      '^PR4',
      '^MD24',
      '^FO10,10^GB436,284,3^FS',
      `^FO24,26^A0N,32,32^FB408,1,0,C^FD${title}^FS`,
      `^FO24,62^A0N,22,22^FB408,1,0,C^FD${subtitle}^FS`,
      `^FO28,96^A0N,18,18^FB400,3,3,R^FDIngredients: ${ingredients || '-'}^FS`,
      `^FO28,170^A0N,19,19^FB400,1,0,R^FDOrigin: ${origin || '-'}^FS`,
      `^FO236,204^A0N,21,21^FB190,1,0,R^FDProd: ${productionDate || '-'}^FS`,
      `^FO28,204^A0N,21,21^FB190,1,0,L^FDExp: ${expiryDate || '-'}^FS`
    ];
    if (barcode) {
      lines.push(`^FO64,236^BY2,2,42^BCN,42,N,N,N^FD${barcode}^FS`);
      lines.push(`^FO28,280^A0N,12,12^FB400,1,0,C^FD${barcode}^FS`);
    }
    lines.push(`^PQ${copies}`);
    lines.push('^XZ');
    return lines.join('\n');
  }

  async function printRequest(requestId, request) {
    if (!window.figsDesktop?.isDesktopApp || !window.figsDesktop?.printZpl) {
      throw new Error('Desktop printer bridge is not available.');
    }
    const items = Array.isArray(request.items) ? request.items : Object.values(request.items || {});
    if (!items.length) throw new Error('No stickers in request.');
    for (const item of items) {
      const zpl = buildMobileLabelZpl(item);
      await window.figsDesktop.printZpl({ zpl });
    }
    await firebase.database().ref(`${REQUEST_PATH}/${requestId}`).update({
      status: 'completed',
      printedAt: firebase.database.ServerValue.TIMESTAMP,
      printedByDeviceId: TARGET_DEVICE_ID
    });
  }

  function startBridge() {
    if (!window.firebase?.database) return;
    if (getDeviceId() !== TARGET_DEVICE_ID) return;

    const ref = firebase.database().ref(REQUEST_PATH);
    ref.orderByChild('targetDeviceId').equalTo(TARGET_DEVICE_ID).on('child_added', async (snapshot) => {
      const request = snapshot.val() || {};
      if (request.status !== 'pending') return;
      try {
        await snapshot.ref.update({
          status: 'printing',
          startedAt: firebase.database.ServerValue.TIMESTAMP,
          printedByDeviceId: TARGET_DEVICE_ID
        });
        await printRequest(snapshot.key, request);
      } catch (error) {
        console.error('Mobile label print request failed:', error);
        await snapshot.ref.update({
          status: 'failed',
          error: error?.message || String(error || 'Print failed'),
          failedAt: firebase.database.ServerValue.TIMESTAMP,
          printedByDeviceId: TARGET_DEVICE_ID
        });
      }
    });

    ref.orderByChild('targetDeviceId').equalTo(TARGET_DEVICE_ID).on('child_changed', async (snapshot) => {
      const request = snapshot.val() || {};
      if (request.status !== 'pending') return;
      try {
        await snapshot.ref.update({
          status: 'printing',
          startedAt: firebase.database.ServerValue.TIMESTAMP,
          printedByDeviceId: TARGET_DEVICE_ID
        });
        await printRequest(snapshot.key, request);
      } catch (error) {
        console.error('Mobile label print request failed:', error);
        await snapshot.ref.update({
          status: 'failed',
          error: error?.message || String(error || 'Print failed'),
          failedAt: firebase.database.ServerValue.TIMESTAMP,
          printedByDeviceId: TARGET_DEVICE_ID
        });
      }
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(startBridge, 900);
  });
})();
