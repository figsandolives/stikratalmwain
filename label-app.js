(function () {
  const REQUEST_PATH = 'labelPrintRequests';
  const firebaseConfig = {
    apiKey: "AIzaSyAZ4-dUBSKsHP3sTqRE8G9c2AjeclTlIik",
    authDomain: "fawatir-f5a13.firebaseapp.com",
    databaseURL: "https://fawatir-f5a13-default-rtdb.firebaseio.com",
    projectId: "fawatir-f5a13",
    storageBucket: "fawatir-f5a13.firebasestorage.app",
    messagingSenderId: "334207827614",
    appId: "1:334207827614:web:3c053434b04c1dd3ea858f",
    measurementId: "G-W42ECQR0LW"
  };

  const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
  const db = firebase.database(app);
  const $root = document.getElementById('labelApp');
  const state = {
    products: {},
    productInfos: {},
    categories: {},
    config: {},
    activeCategory: '',
    activeSubcategory: '',
    selectedProduct: null,
    selectedDates: null,
    cart: loadCart(),
    view: 'home',
    loading: true
  };

  const appCategories = [
    { id: 'hummus', label: 'hummus', categoryRoots: ['المواعين', 'مواعين', 'mawaeen', 'bowls'], match: ['hummus', 'chickpea', 'حمص'] },
    { id: 'foul', label: 'foul', categoryRoots: ['المواعين', 'مواعين', 'mawaeen', 'bowls'], match: ['foul', 'fool', 'ful', 'fava', 'فول'] },
    { id: 'mutabbal', label: 'mutabbal', categoryRoots: ['المواعين', 'مواعين', 'mawaeen', 'bowls'], match: ['mutabbal', 'moutabal', 'eggplant dip', 'متبل'] },
    {
      id: 'dairy',
      label: 'dairy',
      categoryRoots: ['الالبان', 'الألبان', 'البان', 'dairy'],
      match: ['dairy', 'لبن', 'البان', 'ألبان', 'cheese', 'جبن', 'labnah', 'laban', 'roba'],
      subs: [
        { id: 'all', label: 'all', match: [] },
        { id: 'laban', label: 'laban', match: ['laban', 'لبن'] },
        { id: 'labnah', label: 'labnah', match: ['labnah', 'لبنة'] },
        { id: 'roba', label: 'roba', match: ['roba', 'روبة', 'روب'] },
        { id: 'masl-laban', label: 'masl laban', match: ['masl laban', 'masel laban', 'مصل'] },
        { id: 'nabulsi-cheese', label: 'nabulsi cheese', match: ['nabulsi', 'نابلس'] }
      ]
    },
    { id: 'ferments', label: 'ferments', categoryRoots: ['المخمرات', 'مخمرات', 'ferments'], match: ['ferment', 'مخمر', 'المخمرات'] },
    { id: 'zaytoon', label: 'zaytoon', categoryRoots: ['زيتون فلسطيني', 'زيتون فلسطينى', 'منتجات زيتونة', 'زيتون', 'olives'], match: ['zaytoon', 'olive', 'olives', 'زيتون'] },
    { id: 'baraim', label: 'baraim', categoryRoots: ['البراعم', 'براعم', 'sprouts'], match: ['baraim', 'sprout', 'براعم', 'مبرعم'] }
  ];

  const excludedProductMatchers = [
    'شيبس', 'chips',
    'صينية', 'صنيه', 'صواني', 'صوانى', 'tray',
    'فطاير', 'فطائر', 'فطيره', 'فطيرة', 'pie',
    'كرواسون', 'croissant',
    'سويت', 'sweet',
    'بيض', 'egg',
    'سلة', 'سله', 'basket',
    'درزن', 'dozen',
    'نصف درزن',
    'ربطة خبز', 'خبز هدية',
    'باكج', 'package', 'pack',
    'زيت زيتون', 'olive oil'
  ];

  function loadCart() {
    try {
      return JSON.parse(localStorage.getItem('labelPrinterCart') || '[]');
    } catch (_) {
      return [];
    }
  }

  function saveCart() {
    localStorage.setItem('labelPrinterCart', JSON.stringify(state.cart));
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalize(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function productText(product, categoryPath) {
    return normalize([
      product.nameEn,
      product.nameAr,
      product.name,
      product.code,
      product.barcode,
      categoryPath
    ].join(' '));
  }

  function categoryPathText(categoryId) {
    const names = [];
    let id = categoryId || '';
    let guard = 0;
    while (id && state.categories[id] && guard < 8) {
      const category = state.categories[id];
      names.push(category.nameEn || category.nameAr || category.name || '');
      id = category.parentId || '';
      guard += 1;
    }
    return names.join(' ');
  }

  function matchesAny(text, matchers) {
    return matchers.some((matcher) => text.includes(normalize(matcher)));
  }

  function getVisibleProducts() {
    const category = appCategories.find((item) => item.id === state.activeCategory) || appCategories[0];
    const sub = category.subs?.find((item) => item.id === state.activeSubcategory);
    const allowedCategoryIds = getAllowedCategoryIds(category);
    const sectionKey = getSectionKey(category.id, sub?.id || '');
    const sectionConfig = state.config.sections?.[sectionKey] || {};
    const hiddenIds = new Set(Object.keys(sectionConfig.hidden || {}).filter((id) => sectionConfig.hidden[id]));
    const extraIds = Object.keys(sectionConfig.extra || {}).filter((id) => sectionConfig.extra[id]);
    const rows = Object.entries(state.products)
      .map(([id, product]) => {
        const categoryPath = categoryPathText(product.categoryId);
        return { id, ...product, categoryPath, text: productText(product, categoryPath) };
      })
      .filter((product) => allowedCategoryIds.size === 0 || allowedCategoryIds.has(product.categoryId))
      .filter((product) => !isExcludedMawaeenProduct(product))
      .filter((product) => matchesAny(product.text, category.match))
      .filter((product) => !sub || sub.id === 'all' || matchesAny(product.text, sub.match));
    const byId = new Map(rows.map((product) => [product.id, product]));
    extraIds.forEach((id) => {
      if (byId.has(id) || hiddenIds.has(id) || !state.products[id]) return;
      const product = state.products[id];
      const categoryPath = categoryPathText(product.categoryId);
      byId.set(id, { id, ...product, categoryPath, text: productText(product, categoryPath) });
    });
    const orderedIds = sectionConfig.order || [];
    const orderIndex = new Map(orderedIds.map((id, index) => [id, index]));
    return Array.from(byId.values())
      .filter((product) => !hiddenIds.has(product.id))
      .sort((a, b) => {
        const ai = orderIndex.has(a.id) ? orderIndex.get(a.id) : Number.MAX_SAFE_INTEGER;
        const bi = orderIndex.has(b.id) ? orderIndex.get(b.id) : Number.MAX_SAFE_INTEGER;
        if (ai !== bi) return ai - bi;
        return (a.nameEn || a.nameAr || '').localeCompare(b.nameEn || b.nameAr || '', 'en');
      });
  }

  function getSectionKey(categoryId, subcategoryId = '') {
    return categoryId === 'dairy' && subcategoryId && subcategoryId !== 'all'
      ? `${categoryId}:${subcategoryId}`
      : categoryId;
  }

  function getAllowedCategoryIds(section) {
    const roots = (section?.categoryRoots || []).map(normalize);
    if (!roots.length) return new Set();
    return getCategoryIdsByName(roots);
  }

  function getCategoryIdsByName(rootMatchers) {
    const roots = Object.entries(state.categories)
      .filter(([, category]) => {
        const name = normalize(`${category.nameAr || ''} ${category.nameEn || ''} ${category.name || ''}`);
        return rootMatchers.some((matcher) => name.includes(matcher));
      })
      .map(([id]) => id);
    const ids = new Set(roots);
    let changed = true;
    while (changed) {
      changed = false;
      Object.entries(state.categories).forEach(([id, category]) => {
        if (category.parentId && ids.has(category.parentId) && !ids.has(id)) {
          ids.add(id);
          changed = true;
        }
      });
    }
    return ids;
  }

  function isExcludedMawaeenProduct(product) {
    const text = normalize([product.nameAr, product.nameEn, product.name, product.categoryPath].join(' '));
    if (/[0-9٠-٩]/.test(text)) return true;
    return excludedProductMatchers.some((matcher) => text.includes(normalize(matcher)));
  }

  function arabicLatin(value) {
    const words = normalize(value)
      .replace(/(^|\s)ال/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean);
    const map = {
      'الحمص': 'hummus',
      'حمص': 'hummus',
      'حمصه': 'hummus',
      'الحمصة': 'hummus',
      'الحمصه': 'hummus',
      'مسبحه': 'musabaha',
      'مسبحة': 'musabaha',
      'المبرعم': 'mubaram',
      'مبرعم': 'mubaram',
      'مبرعمه': 'mubarama',
      'المبرعمه': 'mubarama',
      'ساده': 'sada',
      'سادة': 'sada',
      'الساده': 'sada',
      'السادة': 'sada',
      'الفول': 'foul',
      'فول': 'foul',
      'المتبل': 'mutabbal',
      'متبل': 'mutabbal',
      'اللبن': 'laban',
      'لبن': 'laban',
      'اللبنه': 'labnah',
      'لبنه': 'labnah',
      'لبنة': 'labnah',
      'الروبه': 'roba',
      'روبه': 'roba',
      'روبة': 'roba',
      'روب': 'roba',
      'المصل': 'masl',
      'مصل': 'masl',
      'الجبن': 'jibn',
      'جبن': 'jibn',
      'جبنه': 'jibnah',
      'جبنة': 'jibnah',
      'النابلسي': 'nabulsi',
      'نابلسي': 'nabulsi',
      'نابلسيه': 'nabulsiya',
      'الزيتون': 'zaytoon',
      'زيتون': 'zaytoon',
      'المخمر': 'mukhamar',
      'مخمر': 'mukhamar',
      'مخمرات': 'mukhamarat',
      'البراعم': 'baraim',
      'براعم': 'baraim',
      'الاخضر': 'akhdar',
      'اخضر': 'akhdar',
      'الاسود': 'aswad',
      'اسود': 'aswad',
      'حار': 'har',
      'حلو': 'helo',
      'البلدي': 'baladi',
      'بلدي': 'baladi',
      'فلسطيني': 'falastini'
    };
    return words.map((word) => map[word] || transliterateArabic(word)).join(' ');
  }

  function transliterateArabic(value) {
    const map = {
      ا: 'a', ب: 'b', ت: 't', ث: 'th', ج: 'j', ح: 'h', خ: 'kh', د: 'd', ذ: 'th',
      ر: 'r', ز: 'z', س: 's', ش: 'sh', ص: 's', ض: 'd', ط: 't', ظ: 'z', ع: 'a',
      غ: 'gh', ف: 'f', ق: 'q', ك: 'k', ل: 'l', م: 'm', ن: 'n', ه: 'h', و: 'w',
      ي: 'y', ى: 'a', ئ: 'e', ؤ: 'o', ء: '', ة: 'h'
    };
    return String(value || '').split('').map((char) => map[char] || char).join('').replace(/aa+/g, 'a');
  }

  function getProductDisplay(product) {
    const nameEn = (product.nameEn || product.name || '').trim() || arabicLatin(product.nameAr || '');
    const latin = arabicLatin(product.nameAr || nameEn);
    return {
      nameEn,
      latin
    };
  }

  function render() {
    if (state.loading) {
      $root.innerHTML = `
        <section class="splash">
          <div class="printer-mark" aria-hidden="true"><span class="printer-top"></span><span class="printer-body"></span><span class="printer-label"></span></div>
          <h1>Sticker Printer</h1>
          <p>Loading product labels...</p>
        </section>
      `;
      return;
    }

    if (state.view === 'cart') {
      renderCart();
      return;
    }

    if (state.view === 'waiting') {
      $root.innerHTML = `
        <section class="waiting">
          <div class="spinner" aria-hidden="true"></div>
          <h2>Preparing print job</h2>
          <p>Sending selected stickers to the production label printer.</p>
        </section>
      `;
      return;
    }

    if (state.view === 'home') {
      renderHome();
      return;
    }

    if (state.view === 'dairySubs') {
      renderDairySubs();
      return;
    }

    const active = appCategories.find((item) => item.id === state.activeCategory) || appCategories[0];
    const products = getVisibleProducts();
    $root.innerHTML = `
      <header class="topbar">
        <div class="brand-row">
          <button class="icon-btn" type="button" data-action="back" aria-label="Back">‹</button>
          <div class="brand">
            <div class="printer-mark" aria-hidden="true"><span class="printer-top"></span><span class="printer-body"></span><span class="printer-label"></span></div>
            <div>
              <h1>${escapeHtml(active.label)}</h1>
              <small>${products.length} products</small>
            </div>
          </div>
          <button class="cart-btn" type="button" data-action="cart">Cart ${state.cart.length}</button>
        </div>
      </header>

      <section class="product-grid">
        ${products.length ? products.map((product) => {
          const display = getProductDisplay(product);
          return `
            <button class="product-btn" type="button" data-product="${product.id}">
              <span class="product-en">${escapeHtml(display.nameEn)}</span>
              <span class="product-ar-latin">${escapeHtml(display.latin)}</span>
            </button>
          `;
        }).join('') : '<div class="empty">No products in this section yet.</div>'}
      </section>
    `;

    $root.querySelector('[data-action="back"]')?.addEventListener('click', () => {
      state.view = active.id === 'dairy' ? 'dairySubs' : 'home';
      state.activeCategory = '';
      state.activeSubcategory = '';
      render();
    });
    $root.querySelector('[data-action="cart"]')?.addEventListener('click', () => {
      state.view = 'cart';
      render();
    });
    $root.querySelectorAll('[data-product]').forEach((button) => {
      button.addEventListener('click', () => openDateSheet(button.dataset.product));
    });
  }

  function renderHome() {
    const categories = appCategories.map((category) => {
      if (category.id === 'dairy') {
        return { ...category, count: getCategoryCount(category, { subsOnly: false }) };
      }
      return { ...category, count: getCategoryCount(category) };
    });
    $root.innerHTML = `
      <header class="topbar">
        <div class="brand-row">
          <div class="brand">
            <div class="printer-mark" aria-hidden="true"><span class="printer-top"></span><span class="printer-body"></span><span class="printer-label"></span></div>
            <div>
              <h1>Sticker Printer</h1>
              <small>Mawaeen labels only</small>
            </div>
          </div>
          <button class="cart-btn" type="button" data-action="cart">Cart ${state.cart.length}</button>
        </div>
      </header>
      <section class="section-grid">
        ${categories.map((category) => `
          <button class="section-card" type="button" data-section="${category.id}">
            <span>${escapeHtml(category.label)}</span>
            <small>${category.count} products</small>
          </button>
        `).join('')}
      </section>
    `;
    $root.querySelector('[data-action="cart"]')?.addEventListener('click', () => {
      state.view = 'cart';
      render();
    });
    $root.querySelectorAll('[data-section]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.dataset.section;
        if (id === 'dairy') {
          state.view = 'dairySubs';
        } else {
          state.view = 'products';
          state.activeCategory = id;
          state.activeSubcategory = '';
        }
        render();
      });
    });
  }

  function renderDairySubs() {
    const dairy = appCategories.find((item) => item.id === 'dairy');
    const subs = (dairy.subs || []).filter((sub) => sub.id !== 'all');
    $root.innerHTML = `
      <header class="topbar">
        <div class="brand-row">
          <button class="icon-btn" type="button" data-action="back" aria-label="Back">‹</button>
          <div class="brand"><h1>dairy</h1></div>
          <button class="cart-btn" type="button" data-action="cart">Cart ${state.cart.length}</button>
        </div>
      </header>
      <section class="section-grid">
        ${subs.map((sub) => `
          <button class="section-card" type="button" data-sub="${sub.id}">
            <span>${escapeHtml(sub.label)}</span>
            <small>${getCategoryCount(dairy, { sub })} products</small>
          </button>
        `).join('')}
      </section>
    `;
    $root.querySelector('[data-action="back"]')?.addEventListener('click', () => {
      state.view = 'home';
      render();
    });
    $root.querySelector('[data-action="cart"]')?.addEventListener('click', () => {
      state.view = 'cart';
      render();
    });
    $root.querySelectorAll('[data-sub]').forEach((button) => {
      button.addEventListener('click', () => {
        state.view = 'products';
        state.activeCategory = 'dairy';
        state.activeSubcategory = button.dataset.sub;
        render();
      });
    });
  }

  function getCategoryCount(category, options = {}) {
    const previousCategory = state.activeCategory;
    const previousSub = state.activeSubcategory;
    state.activeCategory = category.id;
    state.activeSubcategory = options.sub?.id || '';
    const count = getVisibleProducts().length;
    state.activeCategory = previousCategory;
    state.activeSubcategory = previousSub;
    return count;
  }

  function openDateSheet(productId) {
    const product = state.products[productId];
    if (!product) return;
    state.selectedProduct = { id: productId, ...product };
    const today = new Date().toISOString().slice(0, 10);
    const expiry = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    showSheet(`
      <h2>${escapeHtml(getProductDisplay(product).nameEn)}</h2>
      <div class="field">
        <label for="productionDate">Production date</label>
        <input id="productionDate" type="date" value="${today}" />
      </div>
      <div class="field">
        <label for="expiryDate">Expiry date</label>
        <input id="expiryDate" type="date" value="${expiry}" />
      </div>
      <div class="dialog-actions">
        <button class="secondary-btn" type="button" data-close>Cancel</button>
        <button class="primary-btn" type="button" data-next>Next</button>
      </div>
    `);
    document.querySelector('[data-next]')?.addEventListener('click', () => {
      const productionDate = document.getElementById('productionDate')?.value || '';
      const expiryDate = document.getElementById('expiryDate')?.value || '';
      if (!productionDate || !expiryDate) {
        toast('Please select production and expiry dates.', true);
        return;
      }
      state.selectedDates = { productionDate, expiryDate };
      openQuantitySheet();
    });
  }

  function openQuantitySheet() {
    const product = state.selectedProduct;
    if (!product) return;
    showSheet(`
      <h2>Sticker quantity</h2>
      <div class="field">
        <label for="labelQuantity">Quantity</label>
        <input id="labelQuantity" type="number" min="1" step="1" value="1" inputmode="numeric" />
      </div>
      <div class="dialog-actions">
        <button class="secondary-btn" type="button" data-close>Cancel</button>
        <button class="primary-btn" type="button" data-add>Add</button>
      </div>
    `);
    document.querySelector('[data-add]')?.addEventListener('click', () => {
      const quantity = Math.max(1, Math.floor(Number(document.getElementById('labelQuantity')?.value || 1)));
      const display = getProductDisplay(product);
      const info = state.productInfos[product.id] || {};
      state.cart.push({
        requestItemId: `${product.id}-${Date.now()}`,
        productId: product.id,
        nameEn: display.nameEn,
        nameAr: product.nameAr || '',
        latinName: display.latin,
        ingredients: info.ingredients || '',
        origin: info.origin || '',
        barcode: info.barcode || product.barcode || '',
        productionDate: state.selectedDates.productionDate,
        expiryDate: state.selectedDates.expiryDate,
        quantity
      });
      saveCart();
      closeSheet();
      toast('Added to cart.');
      render();
    });
  }

  function showSheet(content) {
    closeSheet();
    const wrap = document.createElement('div');
    wrap.className = 'sheet-backdrop';
    wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${content}</div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click', (event) => {
      if (event.target === wrap || event.target.closest('[data-close]')) closeSheet();
    });
  }

  function closeSheet() {
    document.querySelector('.sheet-backdrop')?.remove();
  }

  function renderCart() {
    $root.innerHTML = `
      <header class="topbar">
        <div class="brand-row">
          <button class="icon-btn" type="button" data-action="back" aria-label="Back">‹</button>
          <div class="brand"><h1>Print Cart</h1></div>
          <button class="danger-btn" type="button" data-action="clear">Clear</button>
        </div>
      </header>
      <section class="cart-view">
        ${state.cart.length ? state.cart.map((item, index) => `
          <article class="cart-item">
            <div class="cart-row">
              <div>
                <span class="product-en">${escapeHtml(item.nameEn)}</span>
                <span class="product-ar-latin">${escapeHtml(item.latinName)}</span>
              </div>
              <button class="danger-btn" type="button" data-remove="${index}">Remove</button>
            </div>
            <div class="cart-meta">${escapeHtml(item.productionDate)} to ${escapeHtml(item.expiryDate)} · ${item.quantity} stickers</div>
          </article>
        `).join('') : '<div class="empty">Your cart is empty.</div>'}
      </section>
      <footer class="cart-footer">
        <button class="primary-btn" type="button" data-action="print" ${state.cart.length ? '' : 'disabled'}>Print</button>
      </footer>
    `;
    $root.querySelector('[data-action="back"]')?.addEventListener('click', () => {
      state.view = 'products';
      render();
    });
    $root.querySelector('[data-action="clear"]')?.addEventListener('click', () => {
      state.cart = [];
      saveCart();
      render();
    });
    $root.querySelectorAll('[data-remove]').forEach((button) => {
      button.addEventListener('click', () => {
        state.cart.splice(Number(button.dataset.remove), 1);
        saveCart();
        render();
      });
    });
    $root.querySelector('[data-action="print"]')?.addEventListener('click', submitPrintJob);
  }

  async function submitPrintJob() {
    if (!state.cart.length) return;
    state.view = 'waiting';
    render();
    const requestRef = db.ref(REQUEST_PATH).push();
    const requestId = requestRef.key;
    const payload = {
      id: requestId,
      source: 'mobile-label-app',
      status: 'pending',
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      items: state.cart
    };

    try {
      await requestRef.set(payload);
      const result = await waitForPrintResult(requestId);
      if (result.status === 'completed') {
        state.cart = [];
        saveCart();
        showMessage('Printed successfully', 'The selected stickers were sent to the label printer.', false);
      } else if (result.status === 'rejected') {
        showMessage('Print request was rejected on the desktop app.', 'Your cart is still saved.', true);
      } else {
        showMessage(result.error || 'Print failed. Please try again.', 'Your cart is still saved.', true);
      }
    } catch (error) {
      console.error(error);
      showMessage('The desktop app did not confirm printing. Your cart is still saved.', 'Your cart is still saved.', true);
    }
  }

  async function waitForPrintResult(requestId) {
    const start = Date.now();
    const minWaitMs = 1800;
    const maxWaitMs = 14000;
    const requestRef = db.ref(`${REQUEST_PATH}/${requestId}`);
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        requestRef.off('value', onValue);
        resolve(value);
      };
      const onValue = (snapshot) => {
        const request = snapshot.val() || {};
        if (request.status === 'completed' || request.status === 'failed' || request.status === 'rejected') {
          const elapsed = Date.now() - start;
          setTimeout(() => finish(request), Math.max(0, minWaitMs - elapsed));
        }
      };
      requestRef.on('value', onValue);
      setTimeout(() => finish({ status: 'timeout', error: 'The desktop app did not confirm printing. Your cart is still saved.' }), maxWaitMs);
    });
  }

  function showMessage(title, body, isError) {
    state.view = 'message';
    $root.innerHTML = `
      <section class="message-state">
        <div class="${isError ? '' : 'printer-mark'}" aria-hidden="true">${isError ? '<div class="spinner"></div>' : '<span class="printer-top"></span><span class="printer-body"></span><span class="printer-label"></span>'}</div>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(body)}</p>
        <button class="primary-btn" type="button" data-action="return">${isError ? 'Back to cart' : 'Done'}</button>
      </section>
    `;
    $root.querySelector('[data-action="return"]')?.addEventListener('click', () => {
      state.view = isError ? 'cart' : 'home';
      render();
    });
  }

  function toast(message, isError) {
    document.querySelector('.toast')?.remove();
    const el = document.createElement('div');
    el.className = `toast${isError ? ' error' : ''}`;
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  function initData() {
    const paths = [
      ['products', 'products'],
      ['productInfos', 'productInfos'],
      ['productCategories', 'categories'],
      ['labelPrinterConfig', 'config']
    ];
    let seen = 0;
    paths.forEach(([path, key]) => {
      db.ref(path).on('value', (snapshot) => {
        state[key] = snapshot.val() || {};
        seen += 1;
        state.loading = seen < paths.length;
        render();
      });
    });
  }

  initData();
})();
