document.addEventListener('DOMContentLoaded', () => {
    const loginScreen = document.getElementById('login-screen');
    const dashboard = document.getElementById('dashboard');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const toastEl = document.getElementById('admin-toast');


    // ---- LOGIN ----
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('login-user').value.trim();
        const pass = document.getElementById('login-pass').value;

        if (!user || !pass) { loginError.textContent = 'Completá todos los campos'; return; }

        if(user === 'Tusencantos' && pass === 'Tusencantos!') {
            try {
                await auth.signInAnonymously();
            } catch (err) {
                loginError.textContent = 'Error de autenticación. Habilitá Auth Anónimo en Firebase Console.';
            }
        } else {
            loginError.textContent = 'Usuario o contraseña incorrectos';
        }
    });

    auth.onAuthStateChanged(user => {
        if (user) {
            loginScreen.classList.add('hidden');
            dashboard.classList.remove('hidden');
            loadProducts();
            loadOrders();
        }
    });

    document.getElementById('btn-logout').addEventListener('click', async () => {
        await auth.signOut();
        dashboard.classList.add('hidden');
        loginScreen.classList.remove('hidden');
        loginForm.reset();
        loginError.textContent = '';
    });

    // ---- TABS ----
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.addEventListener('click', () => {
            document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            document.getElementById('tab-' + link.dataset.tab).classList.add('active');
        });
    });

    // ---- PRODUCTOS ----
    const productsTbody = document.getElementById('products-tbody');
    const productsEmpty = document.getElementById('products-empty');
    const productModal = document.getElementById('product-modal');
    const productForm = document.getElementById('product-form');

    function initCategorySelect() {
        const sel = document.getElementById('pf-category');
        sel.innerHTML = '<option value="">Seleccionar...</option>';
        CATEGORIES.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            sel.appendChild(opt);
        });
    }

    function initSizesCheckboxes() {
        const container = document.getElementById('pf-sizes');
        container.innerHTML = '';
        ['XS', ...SIZES].forEach(s => {
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" value="${s}"> ${s}`;
            container.appendChild(label);
        });
    }

    initCategorySelect();
    initSizesCheckboxes();

    document.getElementById('btn-add-product').addEventListener('click', () => openProductModal());
    document.getElementById('modal-close').addEventListener('click', () => closeProductModal());
    document.getElementById('btn-cancel-product').addEventListener('click', () => closeProductModal());

    function openProductModal(product, docId) {
        document.getElementById('modal-title').textContent = product ? 'Editar Producto' : 'Nuevo Producto';
        document.getElementById('pf-id').value = docId || '';
        document.getElementById('pf-name').value = product ? product.name : '';
        document.getElementById('pf-price').value = product ? product.price : '';
        document.getElementById('pf-category').value = product ? product.category : '';
        document.getElementById('pf-badge').value = product ? (product.badge || '') : '';
        document.getElementById('pf-description').value = product ? product.description : '';
        document.getElementById('pf-stock').value = product ? (product.stock || 0) : 0;
        document.getElementById('pf-features').value = product ? (product.features || []).join('\n') : '';
        document.getElementById('pf-image-files').value = '';

        // Show existing images preview
        const previewContainer = document.getElementById('pf-images-preview');
        previewContainer.innerHTML = '';
        if (product && product.images && product.images.length > 0) {
            product.images.forEach(url => {
                const img = document.createElement('img');
                img.src = url.startsWith('http') ? url : '../' + url;
                img.alt = 'Preview';
                previewContainer.appendChild(img);
            });
        } else if (product && product.image) {
            const img = document.createElement('img');
            img.src = product.image.startsWith('http') ? product.image : '../' + product.image;
            img.alt = 'Preview';
            previewContainer.appendChild(img);
        }

        const sizesChecks = document.querySelectorAll('#pf-sizes input');
        sizesChecks.forEach(cb => {
            cb.checked = product ? (product.sizes || []).includes(cb.value) : false;
        });

        productModal.classList.remove('hidden');
    }

    function closeProductModal() {
        productModal.classList.add('hidden');
        productForm.reset();
    }

    // Image files preview (append, don't replace)
    document.getElementById('pf-image-files').addEventListener('change', (e) => {
        const previewContainer = document.getElementById('pf-images-preview');
        Array.from(e.target.files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = document.createElement('img');
                img.src = ev.target.result;
                img.alt = 'Preview';
                previewContainer.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
    });

    // Save product
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const docId = document.getElementById('pf-id').value;
        const name = document.getElementById('pf-name').value.trim();
        const price = parseInt(document.getElementById('pf-price').value);
        const category = document.getElementById('pf-category').value;
        const description = document.getElementById('pf-description').value.trim();

        if (!name || !price || !category || !description) {
            showToast('Completá los campos obligatorios', 'error');
            return;
        }

        const sizes = [];
        document.querySelectorAll('#pf-sizes input:checked').forEach(cb => sizes.push(cb.value));

        const features = document.getElementById('pf-features').value
            .split('\n').map(f => f.trim()).filter(f => f);

        let imageUrls = [];

        // Subir imágenes al servidor
        const imageFiles = document.getElementById('pf-image-files').files;
        if (imageFiles.length > 0) {
            try {
                showToast('Subiendo imágenes...', 'info');
                for (const file of imageFiles) {
                    const formData = new FormData();
                    formData.append('image', file);
                    formData.append('secret', 'TusEncantosUpload2026!');
                    const resp = await fetch('../api/upload.php', { method: 'POST', body: formData });
                    const result = await resp.json();
                    if (!resp.ok) throw new Error(result.error || 'Error al subir imagen');
                    imageUrls.push(result.url);
                }
            } catch (err) {
                showToast('Error subiendo imagen: ' + err.message, 'error');
                return;
            }
        }

        // Conservar las imágenes existentes y agregar las nuevas
        if (docId) {
            const existingDoc = await db.collection('products').doc(docId).get();
            if (existingDoc.exists) {
                const existingData = existingDoc.data();
                const existingImages = existingData.images || (existingData.image ? [existingData.image] : []);
                imageUrls = [...existingImages, ...imageUrls];
            }
        }

        const data = {
            name, price, category, description,
            badge: document.getElementById('pf-badge').value.trim(),
            stock: parseInt(document.getElementById('pf-stock').value) || 0,
            image: imageUrls[0] || '',
            images: imageUrls,
            sizes, features,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            if (docId) {
                await db.collection('products').doc(docId).update(data);
                showToast('Producto actualizado', 'success');
            } else {
                data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection('products').add(data);
                showToast('Producto creado', 'success');
            }
            closeProductModal();
            loadProducts();
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
    });

    async function loadProducts() {
        try {
            const snapshot = await db.collection('products').orderBy('createdAt', 'desc').get();
            productsTbody.innerHTML = '';

            if (snapshot.empty) {
                productsEmpty.classList.remove('hidden');
                return;
            }
            productsEmpty.classList.add('hidden');

            snapshot.forEach(doc => {
                const p = doc.data();
                const imgSrc = p.image ? (p.image.startsWith('http') ? p.image : '../' + p.image) : '';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><img src="${escapeAttr(imgSrc)}" alt="${escapeAttr(p.name)}"></td>
                    <td><strong>${escapeHtml(p.name)}</strong></td>
                    <td>${escapeHtml(p.category)}</td>
                    <td>$${p.price ? p.price.toLocaleString('es-AR') : '0'}</td>
                    <td>${p.stock != null ? p.stock : 0}</td>
                    <td>${(p.sizes || []).join(', ')}</td>
                    <td>
                        <div class="action-btns">
                            <button class="btn-edit" data-id="${doc.id}">Editar</button>
                            <button class="btn-delete" data-id="${doc.id}" data-name="${escapeAttr(p.name)}">Eliminar</button>
                        </div>
                    </td>
                `;
                productsTbody.appendChild(tr);
            });

            productsTbody.querySelectorAll('.btn-edit').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const doc = await db.collection('products').doc(btn.dataset.id).get();
                    if (doc.exists) openProductModal(doc.data(), doc.id);
                });
            });

            productsTbody.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (!confirm('¿Eliminar "' + btn.dataset.name + '"?')) return;
                    try {
                        await db.collection('products').doc(btn.dataset.id).delete();
                        showToast('Producto eliminado', 'success');
                        loadProducts();
                    } catch (err) {
                        showToast('Error: ' + err.message, 'error');
                    }
                });
            });
        } catch (err) {
            showToast('Error cargando productos: ' + err.message, 'error');
        }
    }

    // ---- PEDIDOS ----
    const ordersTbody = document.getElementById('orders-tbody');
    const ordersEmpty = document.getElementById('orders-empty');
    const orderModal = document.getElementById('order-modal');
    const orderDetail = document.getElementById('order-detail');

    document.getElementById('order-modal-close').addEventListener('click', () => orderModal.classList.add('hidden'));

    async function loadOrders() {
        try {
            const snapshot = await db.collection('orders').orderBy('createdAt', 'desc').get();
            ordersTbody.innerHTML = '';

            if (snapshot.empty) {
                ordersEmpty.classList.remove('hidden');
                return;
            }
            ordersEmpty.classList.add('hidden');

            snapshot.forEach(doc => {
                const o = doc.data();
                const date = o.createdAt ? o.createdAt.toDate().toLocaleDateString('es-AR') : '-';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><code style="font-size:.72rem">${doc.id.slice(0, 8)}...</code></td>
                    <td>${escapeHtml((o.shipping?.name || '') + ' ' + (o.shipping?.lastname || ''))}</td>
                    <td>${escapeHtml(o.shipping?.email || '')}</td>
                    <td>$${o.total ? o.total.toLocaleString('es-AR') : '0'}</td>
                    <td><span class="status-badge ${o.status || 'pending'}">${statusLabel(o.status)}</span></td>
                    <td>${date}</td>
                    <td>
                        <div class="action-btns">
                            <button class="btn-view" data-id="${doc.id}">Ver</button>
                        </div>
                    </td>
                `;
                ordersTbody.appendChild(tr);
            });

            ordersTbody.querySelectorAll('.btn-view').forEach(btn => {
                btn.addEventListener('click', () => showOrderDetail(btn.dataset.id));
            });
        } catch (err) {
            showToast('Error cargando pedidos: ' + err.message, 'error');
        }
    }

    function statusLabel(s) {
        const map = { pending: 'Pendiente', paid: 'Pagado', cancelled: 'Cancelado', shipped: 'Enviado' };
        return map[s] || s || 'Pendiente';
    }

    async function showOrderDetail(orderId) {
        try {
            const doc = await db.collection('orders').doc(orderId).get();
            if (!doc.exists) return;
            const o = doc.data();
            const date = o.createdAt ? o.createdAt.toDate().toLocaleString('es-AR') : '-';

            let itemsHtml = '';
            (o.items || []).forEach(item => {
                const imgSrc = item.image ? (item.image.startsWith('http') ? item.image : '../' + item.image) : '';
                itemsHtml += `
                    <div class="order-item-row">
                        <img src="${escapeAttr(imgSrc)}" alt="${escapeAttr(item.name)}">
                        <div class="item-info">${escapeHtml(item.name)} — Talle: ${escapeHtml(item.size)} x${item.qty}</div>
                        <div class="item-price">$${(item.price * item.qty).toLocaleString('es-AR')}</div>
                    </div>
                `;
            });

            let billingHtml = '';
            if (o.billing) {
                billingHtml = `
                    <div class="order-detail-section">
                        <h4>Facturación</h4>
                        <p><strong>Nombre:</strong> ${escapeHtml(o.billing.name + ' ' + o.billing.lastname)}</p>
                        <p><strong>Email:</strong> ${escapeHtml(o.billing.email)}</p>
                        <p><strong>Teléfono:</strong> ${escapeHtml(o.billing.phone)}</p>
                        <p><strong>Dirección:</strong> ${escapeHtml(o.billing.address)}</p>
                    </div>
                `;
            }

            orderDetail.innerHTML = `
                <div class="order-detail-section">
                    <h4>Información General</h4>
                    <p><strong>ID:</strong> ${doc.id}</p>
                    <p><strong>Fecha:</strong> ${date}</p>
                    <p><strong>Total:</strong> $${o.total ? o.total.toLocaleString('es-AR') : '0'}</p>
                    <p><strong>Estado:</strong>
                        <select class="order-status-select" data-id="${doc.id}">
                            <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>Pendiente</option>
                            <option value="paid" ${o.status === 'paid' ? 'selected' : ''}>Pagado</option>
                            <option value="shipped" ${o.status === 'shipped' ? 'selected' : ''}>Enviado</option>
                            <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>Cancelado</option>
                        </select>
                    </p>
                </div>
                <div class="order-detail-section">
                    <h4>Envío</h4>
                    <p><strong>Nombre:</strong> ${escapeHtml((o.shipping?.name || '') + ' ' + (o.shipping?.lastname || ''))}</p>
                    <p><strong>Email:</strong> ${escapeHtml(o.shipping?.email || '')}</p>
                    <p><strong>Teléfono:</strong> ${escapeHtml(o.shipping?.phone || '')}</p>
                    <p><strong>Dirección:</strong> ${escapeHtml(o.shipping?.address || '')}</p>
                    ${o.shipping?.message ? `<p><strong>Mensaje:</strong> ${escapeHtml(o.shipping.message)}</p>` : ''}
                </div>
                ${billingHtml}
                <div class="order-detail-section">
                    <h4>Productos</h4>
                    <div class="order-items-list">${itemsHtml}</div>
                </div>
            `;

            orderDetail.querySelector('.order-status-select').addEventListener('change', async (e) => {
                try {
                    await db.collection('orders').doc(e.target.dataset.id).update({ status: e.target.value });
                    showToast('Estado actualizado', 'success');
                    loadOrders();
                } catch (err) {
                    showToast('Error: ' + err.message, 'error');
                }
            });

            orderModal.classList.remove('hidden');
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
    }

    // ---- UTILIDADES ----
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }

    function escapeAttr(str) {
        return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    let toastTimer;
    function showToast(msg, type) {
        clearTimeout(toastTimer);
        toastEl.textContent = msg;
        toastEl.className = 'admin-toast visible ' + (type || 'info');
        toastTimer = setTimeout(() => { toastEl.className = 'admin-toast'; }, 3500);
    }
});
